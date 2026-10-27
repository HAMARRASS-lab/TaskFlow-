package com.taskflow.time;

import com.taskflow.task.Task;
import com.taskflow.user.User;
import jakarta.persistence.*;

import java.time.Duration;
import java.time.LocalDateTime;

/** Time spent on a task: a timer (running while {@code endedAt} is {@code null}) or a duration logged by hand. */
@Entity
@Table(name = "time_entries")
public class TimeEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_id", nullable = false)
    private Task task;

    /** {@code null} once the user who logged the time is deleted. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;

    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    /** {@code null} while the timer runs. */
    private Long seconds;

    @Column(length = 200)
    private String note;

    protected TimeEntry() {
    }

    /** A timer started at {@code startedAt}. */
    public TimeEntry(Task task, User user, LocalDateTime startedAt) {
        this.task = task;
        this.user = user;
        this.startedAt = startedAt;
    }

    /** Time logged by hand, ending at {@code endedAt}. */
    public TimeEntry(Task task, User user, LocalDateTime endedAt, Duration duration, String note) {
        this(task, user, endedAt.minus(duration));
        this.endedAt = endedAt;
        this.seconds = duration.toSeconds();
        this.note = note;
    }

    public boolean isRunning() {
        return endedAt == null;
    }

    public void stop(LocalDateTime now) {
        endedAt = now;
        seconds = Math.max(0, Duration.between(startedAt, now).toSeconds());
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Task getTask() { return task; }
    public User getUser() { return user; }
    public LocalDateTime getStartedAt() { return startedAt; }
    public LocalDateTime getEndedAt() { return endedAt; }
    public Long getSeconds() { return seconds; }
    public String getNote() { return note; }
}
