package com.taskflow.task;

import com.taskflow.common.BadRequestException;
import com.taskflow.common.ForbiddenException;
import com.taskflow.common.NotFoundException;
import com.taskflow.task.TaskDtos.ChecklistItemRequest;
import com.taskflow.task.TaskDtos.TaskOwnerSummary;
import com.taskflow.task.TaskDtos.TaskRequest;
import com.taskflow.task.TaskDtos.TaskResponse;
import com.taskflow.task.TaskRepository.OwnerStatusCount;
import com.taskflow.user.User;
import com.taskflow.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Tasks are created by an owner and can be assigned to a teammate and watched by others. Everyone can read every
 * task (see the Team page); the owner and the assignee can change it; only the owner can delete it.
 */
@Service
@Transactional
public class TaskService {

    private final TaskRepository tasks;
    private final UserRepository users;

    public TaskService(TaskRepository tasks, UserRepository users) {
        this.tasks = tasks;
        this.users = users;
    }

    /** The user's board: tasks they created, are assigned to or watch. */
    @Transactional(readOnly = true)
    public List<TaskResponse> findAll(User user, TaskStatus status) {
        return tasks.findOnBoardOf(user.getId()).stream()
                .filter(t -> status == null || t.getStatus() == status)
                .map(TaskResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public TaskResponse findOne(User user, Long id) {
        return TaskResponse.from(loadTask(id));
    }

    /**
     * Every user who has created or is assigned at least one task, with per-status counts of those tasks, sorted by
     * name.
     */
    @Transactional(readOnly = true)
    public List<TaskOwnerSummary> findOwners() {
        Map<Long, long[]> counts = new LinkedHashMap<>();
        Map<Long, OwnerStatusCount> owners = new LinkedHashMap<>();
        List<OwnerStatusCount> rows = new ArrayList<>(tasks.countByOwnerAndStatus());
        rows.addAll(tasks.countByAssigneeAndStatus());
        for (OwnerStatusCount row : rows) {
            owners.putIfAbsent(row.getOwnerId(), row);
            counts.computeIfAbsent(row.getOwnerId(), id -> new long[TaskStatus.values().length])[row.getStatus().ordinal()] +=
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

    /** Read-only view of another user's tasks: those they created or are assigned to. */
    @Transactional(readOnly = true)
    public List<TaskResponse> findByOwner(Long ownerId, TaskStatus status) {
        return tasks.findForMember(loadUser(ownerId).getId()).stream()
                .filter(t -> status == null || t.getStatus() == status)
                .map(TaskResponse::from)
                .toList();
    }

    public TaskResponse create(User owner, TaskRequest request) {
        Task task = new Task();
        task.setOwner(owner);
        apply(task, request);
        return TaskResponse.from(tasks.save(task));
    }

    /** Admin: creates a task owned by another user. */
    public TaskResponse createFor(Long userId, TaskRequest request) {
        return create(loadUser(userId), request);
    }

    /** Admin: gives the task (its ownership) to another user. */
    public TaskResponse transferOwnership(Long id, Long userId) {
        Task task = loadTask(id);
        task.setOwner(loadUser(userId));
        return TaskResponse.from(tasks.saveAndFlush(task));
    }

    /** Admin: assigns any task to any user, or unassigns it ({@code userId} null). */
    public TaskResponse assign(Long id, Long userId) {
        Task task = loadTask(id);
        task.setAssignee(userId == null ? null : loadMember(userId));
        task.touch();
        return TaskResponse.from(tasks.saveAndFlush(task));
    }

    public TaskResponse update(User user, Long id, TaskRequest request) {
        Task task = loadEditable(user, id);
        apply(task, request);
        return TaskResponse.from(tasks.saveAndFlush(task));
    }

    public TaskResponse updateStatus(User user, Long id, TaskStatus status) {
        Task task = loadEditable(user, id);
        task.setStatus(status);
        return TaskResponse.from(tasks.saveAndFlush(task));
    }

    public TaskResponse toggleChecklistItem(User user, Long id, Long itemId, boolean done) {
        Task task = loadEditable(user, id);
        ChecklistItem item = task.getChecklist().stream()
                .filter(i -> itemId.equals(i.getId()))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Checklist item " + itemId + " not found"));
        item.setDone(done);
        task.touch();
        return TaskResponse.from(tasks.saveAndFlush(task));
    }

    public void delete(User user, Long id) {
        Task task = loadTask(id);
        if (!isOwner(user, task)) {
            throw new ForbiddenException("Only the task's owner can delete it");
        }
        tasks.delete(task);
    }

    /** Anyone can follow (or stop following) any task: it then shows up, read-only, on their board. */
    public TaskResponse setWatching(User user, Long id, boolean watching) {
        Task task = loadTask(id);
        boolean watched = task.getWatchers().stream().anyMatch(w -> Objects.equals(w.getId(), user.getId()));
        if (watching && !watched) {
            task.getWatchers().add(users.getReferenceById(user.getId()));
        } else if (!watching && watched) {
            task.getWatchers().removeIf(w -> Objects.equals(w.getId(), user.getId()));
        }
        return TaskResponse.from(tasks.saveAndFlush(task));
    }

    /** Whether the user may change the task (not delete it): its owner or its assignee. */
    static boolean canEdit(User user, Task task) {
        return isOwner(user, task)
                || task.getAssignee() != null && Objects.equals(task.getAssignee().getId(), user.getId());
    }

    private static boolean isOwner(User user, Task task) {
        return Objects.equals(task.getOwner().getId(), user.getId());
    }

    private User loadUser(Long id) {
        return users.findById(id).orElseThrow(() -> new NotFoundException("User " + id + " not found"));
    }

    private Task loadTask(Long id) {
        return tasks.findById(id).orElseThrow(() -> new NotFoundException("Task " + id + " not found"));
    }

    private Task loadEditable(User user, Long id) {
        Task task = loadTask(id);
        if (!canEdit(user, task)) {
            throw new ForbiddenException("Only the task's owner or assignee can change it");
        }
        return task;
    }

    private void apply(Task task, TaskRequest request) {
        task.setTitle(request.title().trim());
        task.setDescription(request.description());
        task.setDueDate(request.dueDate());
        if (request.status() != null) {
            task.setStatus(request.status());
        }
        if (request.priority() != null) {
            task.setPriority(request.priority());
        }
        if (request.labels() != null) {
            task.getLabels().clear();
            request.labels().stream().map(TaskService::normalizeLabel).forEach(task.getLabels()::add);
            task.touch();
        }
        if (request.checklist() != null) {
            applyChecklist(task, request.checklist());
            task.touch();
        }
        Long currentAssignee = task.getAssignee() == null ? null : task.getAssignee().getId();
        if (!Objects.equals(currentAssignee, request.assigneeId())) {
            task.setAssignee(request.assigneeId() == null ? null : loadMember(request.assigneeId()));
            task.touch();
        }
        if (request.watcherIds() != null) {
            Set<Long> ids = new HashSet<>(request.watcherIds());
            List<User> watchers = users.findAllById(ids);
            if (watchers.size() != ids.size()) {
                throw new BadRequestException("Unknown watcher");
            }
            task.getWatchers().clear();
            task.getWatchers().addAll(watchers);
        }
    }

    /** A user named in a request: an unknown id is the client's mistake (400), not a missing resource. */
    private User loadMember(Long id) {
        return users.findById(id).orElseThrow(() -> new BadRequestException("Unknown assignee"));
    }

    /** "  Front End " → "front end", so the same label is never stored twice with different casing. */
    static String normalizeLabel(String label) {
        return label.strip().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    /** Replaces the checklist, keeping (and updating) the items whose id is in the request. */
    private static void applyChecklist(Task task, List<ChecklistItemRequest> requested) {
        Map<Long, ChecklistItem> existing = task.getChecklist().stream()
                .filter(i -> i.getId() != null)
                .collect(Collectors.toMap(ChecklistItem::getId, Function.identity(), (a, b) -> a));
        List<ChecklistItem> items = new ArrayList<>();
        for (ChecklistItemRequest r : requested) {
            ChecklistItem item = r.id() == null ? null : existing.remove(r.id());
            if (item == null) {
                item = new ChecklistItem();
                item.setTask(task);
            }
            item.setTitle(r.title().strip());
            item.setDone(r.done());
            item.setPosition(items.size());
            items.add(item);
        }
        task.getChecklist().clear();
        task.getChecklist().addAll(items);
    }
}
