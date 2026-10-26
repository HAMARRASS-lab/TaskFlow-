package com.taskflow.activity;

import com.taskflow.activity.ActivityDtos.TaskEventResponse;
import com.taskflow.common.NotFoundException;
import com.taskflow.task.Task;
import com.taskflow.task.TaskPriority;
import com.taskflow.task.TaskRepository;
import com.taskflow.task.TaskStatus;
import com.taskflow.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Activity history of every task: its creation, then each change of status, priority, assignee or due date. Like
 * the tasks and their comments, histories are visible to all users. Events are recorded by {@code TaskService}.
 */
@Service
@Transactional
public class TaskActivityService {

    private final TaskEventRepository events;
    private final TaskRepository tasks;

    public TaskActivityService(TaskEventRepository events, TaskRepository tasks) {
        this.events = events;
        this.tasks = tasks;
    }

    /** The tracked fields of a task before a change, to compare with it afterwards. */
    public record Snapshot(TaskStatus status, TaskPriority priority, User assignee, LocalDate dueDate) {

        public static Snapshot of(Task task) {
            return new Snapshot(task.getStatus(), task.getPriority(), task.getAssignee(), task.getDueDate());
        }
    }

    /** Oldest first. */
    @Transactional(readOnly = true)
    public List<TaskEventResponse> findAll(Long taskId) {
        if (!tasks.existsById(taskId)) {
            throw new NotFoundException("Task " + taskId + " not found");
        }
        return events.findByTaskIdOrderByCreatedAtAscIdAsc(taskId).stream()
                .map(TaskEventResponse::from)
                .toList();
    }

    /** {@code task} must already be saved. */
    public void created(User actor, Task task) {
        events.save(new TaskEvent(task, actor, TaskEventType.CREATED, null, null));
    }

    /** Records one event per tracked field that differs between {@code before} and the task now. */
    public void changed(User actor, Task task, Snapshot before) {
        List<TaskEvent> changes = new ArrayList<>();
        add(changes, task, actor, TaskEventType.STATUS, name(before.status()), name(task.getStatus()));
        add(changes, task, actor, TaskEventType.PRIORITY, name(before.priority()), name(task.getPriority()));
        if (!Objects.equals(id(before.assignee()), id(task.getAssignee()))) {
            changes.add(new TaskEvent(task, actor, TaskEventType.ASSIGNEE, fullName(before.assignee()),
                    fullName(task.getAssignee())));
        }
        add(changes, task, actor, TaskEventType.DUE_DATE, text(before.dueDate()), text(task.getDueDate()));
        if (!changes.isEmpty()) {
            events.saveAll(changes);
        }
    }

    private static void add(List<TaskEvent> changes, Task task, User actor, TaskEventType type, String oldValue,
                            String newValue) {
        if (!Objects.equals(oldValue, newValue)) {
            changes.add(new TaskEvent(task, actor, type, oldValue, newValue));
        }
    }

    private static String name(Enum<?> value) {
        return value == null ? null : value.name();
    }

    private static String text(LocalDate date) {
        return date == null ? null : date.toString();
    }

    private static Long id(User user) {
        return user == null ? null : user.getId();
    }

    private static String fullName(User user) {
        return user == null ? null : user.getFullName();
    }
}
