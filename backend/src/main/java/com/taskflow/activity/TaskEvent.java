package com.taskflow.activity;

import com.taskflow.task.Task;
import com.taskflow.user.User;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

/** One change in a task's history. {@code null} values mean "none" (no due date, unassigned). */
@Entity
@Table(name = "task_events")
public class TaskEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_id", nullable = false)
    private Task task;

    /** {@code null} once the user who made the change is deleted. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id")
    private User actor;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 20)
    private TaskEventType type;

    @Column(name = "old_value", length = 200)
    private String oldValue;

    @Column(name = "new_value", length = 200)
    private String newValue;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    protected TaskEvent() {
    }

    public TaskEvent(Task task, User actor, TaskEventType type, String oldValue, String newValue) {
        this.task = task;
        this.actor = actor;
        this.type = type;
        this.oldValue = oldValue;
        this.newValue = newValue;
    }

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Task getTask() { return task; }
    public User getActor() { return actor; }
    public TaskEventType getType() { return type; }
    public String getOldValue() { return oldValue; }
    public String getNewValue() { return newValue; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
