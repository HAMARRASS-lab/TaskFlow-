package com.taskflow.admin;

import com.taskflow.admin.AdminDtos.AdminUserResponse;
import com.taskflow.admin.AdminDtos.AssigneeRequest;
import com.taskflow.admin.AdminDtos.CreateUserRequest;
import com.taskflow.admin.AdminDtos.TransferRequest;
import com.taskflow.admin.AdminDtos.UpdateUserRequest;
import com.taskflow.task.TaskDtos.TaskRequest;
import com.taskflow.task.TaskDtos.TaskResponse;
import com.taskflow.task.TaskService;
import com.taskflow.user.User;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Admin-only endpoints (ROLE_ADMIN enforced in SecurityConfig). */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService adminService;
    private final TaskService taskService;

    public AdminController(AdminService adminService, TaskService taskService) {
        this.adminService = adminService;
        this.taskService = taskService;
    }

    @GetMapping("/users")
    public List<AdminUserResponse> users() {
        return adminService.findAll();
    }

    @PostMapping("/users")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminUserResponse create(@Valid @RequestBody CreateUserRequest request) {
        return adminService.create(request);
    }

    @PutMapping("/users/{id}")
    public AdminUserResponse update(@AuthenticationPrincipal User admin, @PathVariable Long id,
                                    @Valid @RequestBody UpdateUserRequest request) {
        return adminService.update(admin, id, request);
    }

    @DeleteMapping("/users/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal User admin, @PathVariable Long id) {
        adminService.delete(admin, id);
    }

    /** Creates a task owned by the given user: it shows up on their board. */
    @PostMapping("/users/{id}/tasks")
    @ResponseStatus(HttpStatus.CREATED)
    public TaskResponse assignNew(@AuthenticationPrincipal User admin, @PathVariable Long id,
                                  @Valid @RequestBody TaskRequest request) {
        return taskService.createFor(admin, id, request);
    }

    /** Gives an existing task (its ownership) to another user. */
    @PatchMapping("/tasks/{id}/owner")
    public TaskResponse transfer(@PathVariable Long id, @Valid @RequestBody TransferRequest request) {
        return taskService.transferOwnership(id, request.userId());
    }

    /** Assigns any task to any user ({@code userId} null unassigns it). */
    @PatchMapping("/tasks/{id}/assignee")
    public TaskResponse assign(@AuthenticationPrincipal User admin, @PathVariable Long id,
                               @RequestBody AssigneeRequest request) {
        return taskService.assign(admin, id, request.userId());
    }
}
