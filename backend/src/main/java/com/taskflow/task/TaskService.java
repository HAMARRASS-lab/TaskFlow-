package com.taskflow.task;

import com.taskflow.common.NotFoundException;
import com.taskflow.task.TaskDtos.TaskRequest;
import com.taskflow.task.TaskDtos.TaskResponse;
import com.taskflow.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class TaskService {

    private final TaskRepository tasks;

    public TaskService(TaskRepository tasks) {
        this.tasks = tasks;
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

    public TaskResponse create(User owner, TaskRequest request) {
        Task task = new Task();
        task.setOwner(owner);
        apply(task, request);
        return TaskResponse.from(tasks.save(task));
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
