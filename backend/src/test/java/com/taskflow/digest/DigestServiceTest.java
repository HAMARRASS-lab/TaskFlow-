package com.taskflow.digest;

import com.taskflow.meeting.Meeting;
import com.taskflow.meeting.MeetingParticipant;
import com.taskflow.meeting.MeetingRepository;
import com.taskflow.meeting.ParticipantStatus;
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
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DigestServiceTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 15);

    @Mock
    private TaskRepository tasks;

    @Mock
    private MeetingRepository meetings;

    private DigestService service;
    private User alice;

    @BeforeEach
    void setUp() {
        service = new DigestService(tasks, meetings, "https://taskflow.example/");
        alice = new User("alice@test.com", "hash", "Alice");
        alice.setId(1L);
    }

    private Task task(String title, LocalDate due) {
        Task t = new Task();
        t.setTitle(title);
        t.setDueDate(due);
        t.setPriority(TaskPriority.HIGH);
        return t;
    }

    private Meeting meeting(String title, User owner, MeetingParticipant... participants) {
        Meeting m = new Meeting();
        m.setTitle(title);
        m.setOwner(owner);
        m.setStartAt(TODAY.atTime(9, 0));
        m.setEndAt(TODAY.atTime(10, 0));
        m.setParticipants(List.of(participants));
        return m;
    }

    @Test
    void listsOverdueAndUpcomingTasksAndTodaysMeetings() {
        when(tasks.findDueForResponsible(1L, TaskStatus.DONE, TODAY.plusDays(7)))
                .thenReturn(List.of(task("Send invoice", TODAY.minusDays(2)), task("Ship v2", TODAY.plusDays(1))));
        User bob = new User("bob@test.com", "hash", "Bob");
        bob.setId(2L);
        when(meetings.findVisible(eq(1L), eq("alice@test.com"), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(
                        meeting("Stand-up", alice),
                        meeting("Declined sync", bob, new MeetingParticipant("alice@test.com", ParticipantStatus.DECLINED))));

        String body = service.build(alice, TODAY).orElseThrow();

        assertThat(body).contains("Good morning Alice", "MEETINGS TODAY", "09:00–10:00  Stand-up",
                "OVERDUE", "Tue 13 Oct  Send invoice [HIGH]", "DUE IN THE NEXT 7 DAYS", "Fri 16 Oct  Ship v2",
                "https://taskflow.example/tasks");
        assertThat(body).doesNotContain("Declined sync");
        assertThat(body.indexOf("Send invoice")).isLessThan(body.indexOf("DUE IN THE NEXT"));
    }

    @Test
    void sendsNothingOnAnEmptyDay() {
        when(tasks.findDueForResponsible(any(), any(), any()))
                .thenReturn(List.of());
        when(meetings.findVisible(any(), any(), any(), any())).thenReturn(List.of());

        assertThat(service.build(alice, TODAY)).isEmpty();
    }
}
