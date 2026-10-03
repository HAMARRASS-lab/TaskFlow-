package com.taskflow.task;

import com.taskflow.task.TaskDtos.StatusUpdateRequest;
import com.taskflow.task.TaskDtos.TaskRequest;
import com.taskflow.task.TaskDtos.TaskResponse;
import com.taskflow.user.User;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    @GetMapping
    public List<TaskResponse> list(@AuthenticationPrincipal User user,
                                   @RequestParam(required = false) TaskStatus status) {
        return taskService.findAll(user, status);
    }

    @GetMapping("/{id}")
    public TaskResponse get(@AuthenticationPrincipal User user, @PathVariable Long id) {
        return taskService.findOne(user, id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TaskResponse create(@AuthenticationPrincipal User user, @Valid @RequestBody TaskRequest request) {
        return taskService.create(user, request);
    }

    @PutMapping("/{id}")
    public TaskResponse update(@AuthenticationPrincipal User user, @PathVariable Long id,
                               @Valid @RequestBody TaskRequest request) {
        return taskService.update(user, id, request);
    }

    @PatchMapping("/{id}/status")
    public TaskResponse updateStatus(@AuthenticationPrincipal User user, @PathVariable Long id,
                                     @Valid @RequestBody StatusUpdateRequest request) {
        return taskService.updateStatus(user, id, request.status());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal User user, @PathVariable Long id) {
        taskService.delete(user, id);
    }
}
