package com.taskflow.reminder;

import com.taskflow.notification.NotificationService;
import com.taskflow.notification.NotificationType;
import com.taskflow.task.Task;
import com.taskflow.task.TaskRepository;
import com.taskflow.task.TaskStatus;
import com.taskflow.user.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Tells the user responsible for a task (its assignee, or its owner when unassigned) the day before it is due and
 * once it is overdue: a notification in the bell, and an email if their address is verified. Each goes out once per
 * due date, so a rescheduled task is reminded again.
 */
@Service
public class DueDateReminderService {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("EEE d MMM", Locale.ENGLISH);

    private final TaskRepository tasks;
    private final NotificationService notifications;
    private final String frontendUrl;

    public DueDateReminderService(TaskRepository tasks, NotificationService notifications,
                                  @Value("${app.frontend-url}") String frontendUrl) {
        this.tasks = tasks;
        this.notifications = notifications;
        this.frontendUrl = frontendUrl.replaceAll("/+$", "");
    }

    /** An email to send once the reminders are committed. */
    public record ReminderEmail(String to, String subject, String body) {
    }

    /** Records the reminders due on {@code today} and returns the emails to send for them. */
    @Transactional
    public List<ReminderEmail> remind(LocalDate today) {
        List<ReminderEmail> emails = new ArrayList<>();

        List<Task> dueSoon = tasks.findNeedingDueReminder(today.plusDays(1), TaskStatus.DONE);
        for (Task task : dueSoon) {
            User recipient = responsible(task);
            notifications.taskDeadline(recipient, task, NotificationType.TASK_DUE_SOON);
            if (recipient.isEmailVerified()) {
                emails.add(email(recipient, "Due tomorrow: " + task.getTitle(),
                        "\"%s\" is due tomorrow (%s).".formatted(task.getTitle(), DAY.format(task.getDueDate())), task));
            }
        }

        List<Task> overdue = tasks.findNeedingOverdueNotice(today, TaskStatus.DONE);
        for (Task task : overdue) {
            User recipient = responsible(task);
            notifications.taskDeadline(recipient, task, NotificationType.TASK_OVERDUE);
            if (recipient.isEmailVerified()) {
                emails.add(email(recipient, "Overdue: " + task.getTitle(),
                        "\"%s\" was due on %s and is not done yet.".formatted(task.getTitle(), DAY.format(task.getDueDate())),
                        task));
            }
        }

        if (!dueSoon.isEmpty()) {
            tasks.markDueReminderSent(dueSoon.stream().map(Task::getId).toList());
        }
        if (!overdue.isEmpty()) {
            tasks.markOverdueNoticeSent(overdue.stream().map(Task::getId).toList());
        }
        return emails;
    }

    private static User responsible(Task task) {
        return task.getAssignee() != null ? task.getAssignee() : task.getOwner();
    }

    private ReminderEmail email(User recipient, String subject, String line, Task task) {
        String body = """
                Hi %s,

                %s Priority: %s.

                Open your board: %s/tasks
                """.formatted(recipient.getFullName(), line, task.getPriority(), frontendUrl);
        return new ReminderEmail(recipient.getEmail(), subject, body);
    }
}
