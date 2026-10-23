package com.taskflow.reminder;

import com.taskflow.notification.NotificationService;
import com.taskflow.notification.NotificationType;
import com.taskflow.reminder.DueDateReminderService.ReminderEmail;
import com.taskflow.task.Task;
import com.taskflow.task.TaskPriority;
import com.taskflow.task.TaskRepository;
import com.taskflow.task.TaskStatus;
import com.taskflow.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DueDateReminderServiceTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 15);

    @Mock
    private TaskRepository tasks;

    @Mock
    private NotificationService notifications;

    private DueDateReminderService service;
    private User alice;
    private User bob;

    @BeforeEach
    void setUp() {
        service = new DueDateReminderService(tasks, notifications, "https://taskflow.example/");
        alice = user(1L, "alice@test.com", "Alice", true);
        bob = user(2L, "bob@test.com", "Bob", false);
    }

    private static User user(Long id, String email, String name, boolean verified) {
        User u = new User(email, "hash", name);
        u.setId(id);
        u.setEmailVerified(verified);
        return u;
    }

    private static Task task(Long id, String title, LocalDate due, User owner, User assignee) {
        Task t = new Task();
        t.setId(id);
        t.setTitle(title);
        t.setDueDate(due);
        t.setPriority(TaskPriority.HIGH);
        t.setOwner(owner);
        t.setAssignee(assignee);
        return t;
    }

    @Test
    void remindsTheAssigneeOfTomorrowsTaskAndEmailsThemWhenVerified() {
        Task ship = task(10L, "Ship v2", TODAY.plusDays(1), bob, alice);
        when(tasks.findNeedingDueReminder(TODAY.plusDays(1), TaskStatus.DONE)).thenReturn(List.of(ship));
        when(tasks.findNeedingOverdueNotice(TODAY, TaskStatus.DONE)).thenReturn(List.of());

        List<ReminderEmail> emails = service.remind(TODAY);

        verify(notifications).taskDeadline(alice, ship, NotificationType.TASK_DUE_SOON);
        verify(tasks).markDueReminderSent(List.of(10L));
        verify(tasks, never()).markOverdueNoticeSent(any());
        assertThat(emails).singleElement().satisfies(e -> {
            assertThat(e.to()).isEqualTo("alice@test.com");
            assertThat(e.subject()).isEqualTo("Due tomorrow: Ship v2");
            assertThat(e.body()).contains("Hi Alice", "\"Ship v2\" is due tomorrow (Fri 16 Oct).",
                    "Priority: HIGH", "https://taskflow.example/tasks");
        });
    }

    @Test
    void tellsTheOwnerOfAnUnassignedOverdueTaskInTheBellOnlyWhenTheirEmailIsUnverified() {
        Task invoice = task(11L, "Send invoice", TODAY.minusDays(1), bob, null);
        when(tasks.findNeedingDueReminder(TODAY.plusDays(1), TaskStatus.DONE)).thenReturn(List.of());
        when(tasks.findNeedingOverdueNotice(TODAY, TaskStatus.DONE)).thenReturn(List.of(invoice));

        List<ReminderEmail> emails = service.remind(TODAY);

        verify(notifications).taskDeadline(bob, invoice, NotificationType.TASK_OVERDUE);
        verify(tasks).markOverdueNoticeSent(List.of(11L));
        assertThat(emails).isEmpty();
    }

    @Test
    void doesNothingWhenNoTaskIsDue() {
        when(tasks.findNeedingDueReminder(any(), any())).thenReturn(List.of());
        when(tasks.findNeedingOverdueNotice(any(), any())).thenReturn(List.of());

        assertThat(service.remind(TODAY)).isEmpty();
        verify(tasks, never()).markDueReminderSent(any());
        verify(tasks, never()).markOverdueNoticeSent(any());
    }
}
