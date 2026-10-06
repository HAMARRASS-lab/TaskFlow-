package com.taskflow.task;

import com.taskflow.task.TaskDtos.TaskOwnerSummary;
import com.taskflow.task.TaskDtos.TaskResponse;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Read-only browsing of the tasks created by every user. */
@RestController
@RequestMapping("/api/users")
public class TaskOwnerController {

    private final TaskService taskService;

    public TaskOwnerController(TaskService taskService) {
        this.taskService = taskService;
    }

    @GetMapping("/task-owners")
    public List<TaskOwnerSummary> owners() {
        return taskService.findOwners();
    }

    @GetMapping("/{id}/tasks")
    public List<TaskResponse> tasks(@PathVariable Long id, @RequestParam(required = false) TaskStatus status) {
        return taskService.findByOwner(id, status);
    }
}
