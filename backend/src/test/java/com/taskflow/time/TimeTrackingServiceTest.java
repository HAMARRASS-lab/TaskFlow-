package com.taskflow.time;

import com.taskflow.common.ConflictException;
import com.taskflow.common.ForbiddenException;
import com.taskflow.common.NotFoundException;
import com.taskflow.task.Task;
import com.taskflow.task.TaskRepository;
import com.taskflow.time.TimeDtos.TimeSummaryResponse;
import com.taskflow.user.User;
import com.taskflow.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TimeTrackingServiceTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 27, 14, 0);

    @Mock
    private TimeEntryRepository entries;

    @Mock
    private TaskRepository tasks;

    @Mock
    private UserRepository users;

    private TimeTrackingService service;

    private User alice;
    private User bob;
    private Task task;

    @BeforeEach
    void setUp() {
        service = new TimeTrackingService(entries, tasks, users,
                Clock.fixed(NOW.toInstant(ZoneOffset.UTC), ZoneOffset.UTC));
        alice = user(1L, "Alice");
        bob = user(2L, "Bob");
        task = task(10L, alice);
    }

    private static User user(Long id, String name) {
        User user = new User(name.toLowerCase() + "@test.com", "hash", name);
        user.setId(id);
        return user;
    }

    private static Task task(Long id, User owner) {
        Task task = new Task();
        task.setId(id);
        task.setTitle("Ship it");
        task.setOwner(owner);
        return task;
    }

    private void given(Task... list) {
        for (Task t : list) {
            when(tasks.findById(t.getId())).thenReturn(Optional.of(t));
        }
    }

    @Test
    void startingATimerStopsTheOneRunningOnAnotherTask() {
        Task other = task(11L, alice);
        TimeEntry running = new TimeEntry(other, alice, NOW.minusMinutes(25));
        given(task);
        when(entries.findByUserIdAndEndedAtIsNull(1L)).thenReturn(List.of(running));
        when(users.getReferenceById(1L)).thenReturn(alice);

        service.start(alice, 10L);

        assertThat(running.isRunning()).isFalse();
        assertThat(running.getSeconds()).isEqualTo(25 * 60);
        ArgumentCaptor<TimeEntry> saved = ArgumentCaptor.forClass(TimeEntry.class);
        verify(entries).save(saved.capture());
        assertThat(saved.getValue().getTask()).isSameAs(task);
        assertThat(saved.getValue().getStartedAt()).isEqualTo(NOW);
        assertThat(saved.getValue().isRunning()).isTrue();
    }

    @Test
    void startingTwiceOnTheSameTaskIsAConflict() {
        given(task);
        when(entries.findByUserIdAndEndedAtIsNull(1L)).thenReturn(List.of(new TimeEntry(task, alice, NOW)));

        assertThatThrownBy(() -> service.start(alice, 10L)).isInstanceOf(ConflictException.class);
        verify(entries, never()).save(any());
    }

    @Test
    void stoppingWithoutARunningTimerIsAConflict() {
        given(task);
        when(entries.findByUserIdAndEndedAtIsNull(1L)).thenReturn(List.of());

        assertThatThrownBy(() -> service.stop(alice, 10L)).isInstanceOf(ConflictException.class);
    }

    @Test
    void onlyTheOwnerOrAssigneeCanTrackTime() {
        given(task);

        assertThatThrownBy(() -> service.start(bob, 10L)).isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> service.log(bob, 10L, 30, null)).isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> service.setEstimate(bob, 10L, 60)).isInstanceOf(ForbiddenException.class);

        task.setAssignee(bob);
        when(users.getReferenceById(2L)).thenReturn(bob);
        service.log(bob, 10L, 30, null);
        verify(entries).save(any(TimeEntry.class));
    }

    @Test
    void summaryTotalsFinishedEntriesAndReportsTheRunningTimerElapsedSoFar() {
        given(task);
        task.setEstimateMinutes(120);
        TimeEntry logged = new TimeEntry(task, alice, NOW.minusHours(1), Duration.ofMinutes(45), "review");
        TimeEntry stopped = new TimeEntry(task, bob, NOW.minusHours(3));
        stopped.stop(NOW.minusHours(2));
        TimeEntry running = new TimeEntry(task, alice, NOW.minusMinutes(10));
        when(entries.findByTaskIdOrderByStartedAtDescIdDesc(10L)).thenReturn(List.of(running, logged, stopped));

        TimeSummaryResponse summary = service.summary(bob, 10L);

        assertThat(summary.estimateMinutes()).isEqualTo(120);
        assertThat(summary.loggedSeconds()).isEqualTo(45 * 60 + 60 * 60);
        assertThat(summary.canLog()).isFalse();
        assertThat(summary.entries().get(0).running()).isTrue();
        assertThat(summary.entries().get(0).seconds()).isEqualTo(10 * 60);
        assertThat(summary.entries()).extracting(TimeDtos.TimeEntryResponse::mine).containsExactly(false, false, true);
        assertThat(summary.entries().get(1).note()).isEqualTo("review");
    }

    @Test
    void loggedNotesAreTrimmedAndBlankOnesDropped() {
        given(task);
        when(users.getReferenceById(1L)).thenReturn(alice);
        ArgumentCaptor<TimeEntry> saved = ArgumentCaptor.forClass(TimeEntry.class);

        service.log(alice, 10L, 90, "  pairing  ");
        service.log(alice, 10L, 15, "   ");

        verify(entries, times(2)).save(saved.capture());
        assertThat(saved.getAllValues()).extracting(TimeEntry::getNote).containsExactly("pairing", null);
        assertThat(saved.getAllValues().get(0).getSeconds()).isEqualTo(90 * 60);
        assertThat(saved.getAllValues().get(0).getStartedAt()).isEqualTo(NOW.minusMinutes(90));
    }

    @Test
    void onlyTheAuthorCanDeleteAnEntry() {
        TimeEntry entry = new TimeEntry(task, alice, NOW, Duration.ofMinutes(5), null);
        entry.setId(5L);
        when(entries.findById(5L)).thenReturn(Optional.of(entry));

        assertThatThrownBy(() -> service.delete(bob, 10L, 5L)).isInstanceOf(ForbiddenException.class);

        service.delete(alice, 10L, 5L);
        verify(entries).delete(entry);
    }

    @Test
    void anEntryOfAnotherTaskIsNotFound() {
        TimeEntry entry = new TimeEntry(task(11L, alice), alice, NOW, Duration.ofMinutes(5), null);
        when(entries.findById(5L)).thenReturn(Optional.of(entry));

        assertThatThrownBy(() -> service.delete(alice, 10L, 5L)).isInstanceOf(NotFoundException.class);
    }
}
