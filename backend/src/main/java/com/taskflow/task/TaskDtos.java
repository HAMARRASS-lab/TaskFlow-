package com.taskflow.task;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class TaskDtos {

    private TaskDtos() {
    }

    /**
     * @param labels    replaces the task's labels (trimmed, lower-cased, de-duplicated); {@code null} keeps them
     * @param checklist replaces the task's checklist in this order — items with the {@code id} of an existing item
     *                  update it, the others are added; {@code null} keeps it
     */
    public record TaskRequest(
            @NotBlank @Size(max = 200) String title,
            @Size(max = 2000) String description,
            TaskStatus status,
            TaskPriority priority,
            LocalDate dueDate,
            @Size(max = 10) List<@NotBlank @Size(max = 30) String> labels,
            @Size(max = 50) List<@Valid @NotNull ChecklistItemRequest> checklist) {

        /** A request without labels or checklist (both left unchanged on update). */
        public TaskRequest(String title, String description, TaskStatus status, TaskPriority priority,
                           LocalDate dueDate) {
            this(title, description, status, priority, dueDate, null, null);
        }
    }

    public record ChecklistItemRequest(Long id, @NotBlank @Size(max = 200) String title, boolean done) {
    }

    public record StatusUpdateRequest(@NotNull TaskStatus status) {
    }

    public record ChecklistToggleRequest(@NotNull Boolean done) {
    }

    public record ChecklistItemResponse(Long id, String title, boolean done) {
    }

    public record TaskResponse(
            Long id,
            String title,
            String description,
            TaskStatus status,
            TaskPriority priority,
            LocalDate dueDate,
            List<String> labels,
            List<ChecklistItemResponse> checklist,
            LocalDateTime createdAt,
            LocalDateTime updatedAt) {

        static TaskResponse from(Task task) {
            return new TaskResponse(task.getId(), task.getTitle(), task.getDescription(), task.getStatus(),
                    task.getPriority(), task.getDueDate(),
                    task.getLabels().stream().sorted().toList(),
                    task.getChecklist().stream()
                            .map(i -> new ChecklistItemResponse(i.getId(), i.getTitle(), i.isDone()))
                            .toList(),
                    task.getCreatedAt(), task.getUpdatedAt());
        }
    }

    public record TaskOwnerSummary(Long id, String fullName, String email, long todo, long inProgress, long done,
                                   long total) {

        public TaskOwnerSummary(Long id, String fullName, String email, long todo, long inProgress, long done) {
            this(id, fullName, email, todo, inProgress, done, todo + inProgress + done);
        }
    }
}
