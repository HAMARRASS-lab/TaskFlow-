package com.taskflow.digest;

import com.taskflow.meeting.Meeting;
import com.taskflow.meeting.MeetingRepository;
import com.taskflow.meeting.ParticipantStatus;
import com.taskflow.task.Task;
import com.taskflow.task.TaskRepository;
import com.taskflow.task.TaskStatus;
import com.taskflow.user.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/** Builds the daily email digest: overdue tasks, tasks due this week and today's meetings. */
@Service
public class DigestService {

    static final int UPCOMING_DAYS = 7;
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("EEE d MMM", Locale.ENGLISH);
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");

    private final TaskRepository tasks;
    private final MeetingRepository meetings;
    private final String frontendUrl;

    public DigestService(TaskRepository tasks, MeetingRepository meetings,
                         @Value("${app.frontend-url}") String frontendUrl) {
        this.tasks = tasks;
        this.meetings = meetings;
        this.frontendUrl = frontendUrl.replaceAll("/+$", "");
    }

    /** The digest body for {@code today}, or empty when there is nothing to report (no email is sent then). */
    @Transactional(readOnly = true)
    public Optional<String> build(User user, LocalDate today) {
        List<Task> open = tasks.findByOwnerIdAndStatusNotAndDueDateLessThanEqualOrderByDueDateAsc(
                user.getId(), TaskStatus.DONE, today.plusDays(UPCOMING_DAYS));
        List<Task> overdue = open.stream().filter(t -> t.getDueDate().isBefore(today)).toList();
        List<Task> upcoming = open.stream().filter(t -> !t.getDueDate().isBefore(today)).toList();
        List<Meeting> todaysMeetings = meetings.findVisible(user.getId(), user.getEmail(),
                        today.atStartOfDay(), today.plusDays(1).atStartOfDay()).stream()
                .filter(m -> m.isOwnedBy(user)
                        || m.participantFor(user).map(p -> p.getStatus() != ParticipantStatus.DECLINED).orElse(false))
                .toList();

        if (overdue.isEmpty() && upcoming.isEmpty() && todaysMeetings.isEmpty()) {
            return Optional.empty();
        }

        StringBuilder text = new StringBuilder("Good morning %s, here is your day in TaskFlow.\n"
                .formatted(user.getFullName()));
        if (!todaysMeetings.isEmpty()) {
            text.append("\nMEETINGS TODAY\n");
            todaysMeetings.forEach(m -> text.append("  • %s–%s  %s%s\n".formatted(
                    TIME.format(m.getStartAt()), TIME.format(m.getEndAt()), m.getTitle(),
                    m.getLocation() == null || m.getLocation().isBlank() ? "" : " (" + m.getLocation() + ")")));
        }
        if (!overdue.isEmpty()) {
            text.append("\nOVERDUE\n");
            overdue.forEach(t -> text.append(taskLine(t)));
        }
        if (!upcoming.isEmpty()) {
            text.append("\nDUE IN THE NEXT %d DAYS\n".formatted(UPCOMING_DAYS));
            upcoming.forEach(t -> text.append(taskLine(t)));
        }
        text.append("""

                Open your board: %s/tasks

                You receive this email because the daily digest is on. You can turn it off from the account menu in TaskFlow.
                """.formatted(frontendUrl));
        return Optional.of(text.toString());
    }

    private static String taskLine(Task t) {
        return "  • %s  %s [%s]\n".formatted(DAY.format(t.getDueDate()), t.getTitle(), t.getPriority());
    }
}
