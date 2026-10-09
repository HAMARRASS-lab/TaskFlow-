package com.taskflow.task;

import com.taskflow.common.NotFoundException;
import com.taskflow.task.TaskDtos.TaskOwnerSummary;
import com.taskflow.task.TaskDtos.TaskRequest;
import com.taskflow.task.TaskDtos.TaskResponse;
import com.taskflow.task.TaskRepository.OwnerStatusCount;
import com.taskflow.user.User;
import com.taskflow.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@Transactional
public class TaskService {

    private final TaskRepository tasks;
    private final UserRepository users;

    public TaskService(TaskRepository tasks, UserRepository users) {
        this.tasks = tasks;
        this.users = users;
    }

    @Transactional(readOnly = true)
    public List<TaskResponse> findAll(User owner, TaskStatus status) {
        List<Task> result = status == null
                ? tasks.findByOwnerIdOrderByCreatedAtDesc(owner.getId())
                : tasks.findByOwnerIdAndStatusOrderByCreatedAtDesc(owner.getId(), status);
        return result.stream().map(TaskResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public TaskResponse findOne(User owner, Long id) {
        return TaskResponse.from(load(owner, id));
    }

    /** Every user who has created at least one task, with per-status counts, sorted by name. */
    @Transactional(readOnly = true)
    public List<TaskOwnerSummary> findOwners() {
        Map<Long, long[]> counts = new LinkedHashMap<>();
        Map<Long, OwnerStatusCount> owners = new LinkedHashMap<>();
        for (OwnerStatusCount row : tasks.countByOwnerAndStatus()) {
            owners.putIfAbsent(row.getOwnerId(), row);
            counts.computeIfAbsent(row.getOwnerId(), id -> new long[TaskStatus.values().length])[row.getStatus().ordinal()] =
                    row.getCount();
        }
        return owners.values().stream()
                .map(o -> {
                    long[] c = counts.get(o.getOwnerId());
                    return new TaskOwnerSummary(o.getOwnerId(), o.getFullName(), o.getEmail(),
                            c[TaskStatus.TODO.ordinal()], c[TaskStatus.IN_PROGRESS.ordinal()], c[TaskStatus.DONE.ordinal()]);
                })
                .sorted(Comparator.comparing(TaskOwnerSummary::fullName, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    /** Read-only view of another user's tasks. */
    @Transactional(readOnly = true)
    public List<TaskResponse> findByOwner(Long ownerId, TaskStatus status) {
        return findAll(loadUser(ownerId), status);
    }

    public TaskResponse create(User owner, TaskRequest request) {
        Task task = new Task();
        task.setOwner(owner);
        apply(task, request);
        return TaskResponse.from(tasks.save(task));
    }

    /** Admin: creates a task owned by (assigned to) another user. */
    public TaskResponse createFor(Long userId, TaskRequest request) {
        return create(loadUser(userId), request);
    }

    /** Admin: moves a task to another user. */
    public TaskResponse reassign(Long id, Long userId) {
        Task task = tasks.findById(id).orElseThrow(() -> new NotFoundException("Task " + id + " not found"));
        task.setOwner(loadUser(userId));
        return TaskResponse.from(tasks.saveAndFlush(task));
    }

    public TaskResponse update(User owner, Long id, TaskRequest request) {
        Task task = load(owner, id);
        apply(task, request);
        return TaskResponse.from(tasks.saveAndFlush(task));
    }

    public TaskResponse updateStatus(User owner, Long id, TaskStatus status) {
        Task task = load(owner, id);
        task.setStatus(status);
        return TaskResponse.from(tasks.saveAndFlush(task));
    }

    public void delete(User owner, Long id) {
        tasks.delete(load(owner, id));
    }

    private User loadUser(Long id) {
        return users.findById(id).orElseThrow(() -> new NotFoundException("User " + id + " not found"));
    }

    private Task load(User owner, Long id) {
        return tasks.findByIdAndOwnerId(id, owner.getId())
                .orElseThrow(() -> new NotFoundException("Task " + id + " not found"));
    }

    private static void apply(Task task, TaskRequest request) {
        task.setTitle(request.title().trim());
        task.setDescription(request.description());
        task.setDueDate(request.dueDate());
        if (request.status() != null) {
            task.setStatus(request.status());
        }
        if (request.priority() != null) {
            task.setPriority(request.priority());
        }
    }
}
