package com.taskflow.time;

import com.taskflow.common.ConflictException;
import com.taskflow.common.ForbiddenException;
import com.taskflow.common.NotFoundException;
import com.taskflow.task.Task;
import com.taskflow.task.TaskRepository;
import com.taskflow.task.TaskService;
import com.taskflow.time.TimeDtos.LoggerResponse;
import com.taskflow.time.TimeDtos.TimeEntryResponse;
import com.taskflow.time.TimeDtos.TimeSummaryResponse;
import com.taskflow.user.User;
import com.taskflow.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

/**
 * Time spent on tasks, to compare with their estimate. Like the tasks, everyone can see it; the task's owner and
 * assignee can start a timer, log time by hand and set the estimate. Each user runs one timer at a time: starting
 * one stops the other. Only the person who logged an entry can delete it.
 */
@Service
@Transactional
public class TimeTrackingService {

    private final TimeEntryRepository entries;
    private final TaskRepository tasks;
    private final UserRepository users;
    private final Clock clock;

    @Autowired
    public TimeTrackingService(TimeEntryRepository entries, TaskRepository tasks, UserRepository users) {
        this(entries, tasks, users, Clock.systemDefaultZone());
    }

    TimeTrackingService(TimeEntryRepository entries, TaskRepository tasks, UserRepository users, Clock clock) {
        this.entries = entries;
        this.tasks = tasks;
        this.users = users;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public TimeSummaryResponse summary(User user, Long taskId) {
        return summary(user, loadTask(taskId));
    }

    public TimeSummaryResponse start(User user, Long taskId) {
        Task task = loadLoggable(user, taskId);
        LocalDateTime now = now();
        for (TimeEntry running : entries.findByUserIdAndEndedAtIsNull(user.getId())) {
            if (Objects.equals(running.getTask().getId(), taskId)) {
                throw new ConflictException("Your timer is already running on this task");
            }
            running.stop(now);
        }
        entries.save(new TimeEntry(task, users.getReferenceById(user.getId()), now));
        return summary(user, task);
    }

    public TimeSummaryResponse stop(User user, Long taskId) {
        Task task = loadTask(taskId);
        List<TimeEntry> running = entries.findByUserIdAndEndedAtIsNull(user.getId()).stream()
                .filter(e -> Objects.equals(e.getTask().getId(), taskId))
                .toList();
        if (running.isEmpty()) {
            throw new ConflictException("You have no timer running on this task");
        }
        LocalDateTime now = now();
        running.forEach(e -> e.stop(now));
        return summary(user, task);
    }

    public TimeSummaryResponse log(User user, Long taskId, int minutes, String note) {
        Task task = loadLoggable(user, taskId);
        String text = note == null || note.isBlank() ? null : note.strip();
        entries.save(new TimeEntry(task, users.getReferenceById(user.getId()), now(), Duration.ofMinutes(minutes),
                text));
        return summary(user, task);
    }

    public TimeSummaryResponse delete(User user, Long taskId, Long entryId) {
        TimeEntry entry = entries.findById(entryId)
                .filter(e -> Objects.equals(e.getTask().getId(), taskId))
                .orElseThrow(() -> new NotFoundException("Time entry " + entryId + " not found"));
        if (!isAuthor(user, entry)) {
            throw new ForbiddenException("Only the person who logged this time can delete it");
        }
        entries.delete(entry);
        return summary(user, entry.getTask());
    }

    public TimeSummaryResponse setEstimate(User user, Long taskId, Integer minutes) {
        Task task = loadLoggable(user, taskId);
        task.setEstimateMinutes(minutes);
        tasks.saveAndFlush(task);
        return summary(user, task);
    }

    private TimeSummaryResponse summary(User user, Task task) {
        LocalDateTime now = now();
        List<TimeEntryResponse> list = entries.findByTaskIdOrderByStartedAtDescIdDesc(task.getId()).stream()
                .map(e -> toResponse(e, user, now))
                .toList();
        long logged = list.stream().filter(e -> !e.running()).mapToLong(TimeEntryResponse::seconds).sum();
        return new TimeSummaryResponse(task.getEstimateMinutes(), logged, TaskService.canEdit(user, task), list);
    }

    private static TimeEntryResponse toResponse(TimeEntry e, User caller, LocalDateTime now) {
        LoggerResponse user = e.getUser() == null ? null
                : new LoggerResponse(e.getUser().getId(), e.getUser().getFullName());
        long seconds = e.isRunning() ? Math.max(0, Duration.between(e.getStartedAt(), now).toSeconds())
                : e.getSeconds();
        boolean mine = isAuthor(caller, e);
        return new TimeEntryResponse(e.getId(), user, e.getStartedAt(), e.getEndedAt(), seconds, e.isRunning(), mine,
                e.getNote());
    }

    private static boolean isAuthor(User user, TimeEntry e) {
        return e.getUser() != null && Objects.equals(e.getUser().getId(), user.getId());
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock);
    }

    private Task loadTask(Long id) {
        return tasks.findById(id).orElseThrow(() -> new NotFoundException("Task " + id + " not found"));
    }

    private Task loadLoggable(User user, Long id) {
        Task task = loadTask(id);
        if (!TaskService.canEdit(user, task)) {
            throw new ForbiddenException("Only the task's owner or assignee can track time on it");
        }
        return task;
    }
}
