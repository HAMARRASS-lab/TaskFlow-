package com.taskflow.task;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalDateTime;

public final class TaskDtos {

    private TaskDtos() {
    }

    public record TaskRequest(
            @NotBlank @Size(max = 200) String title,
            @Size(max = 2000) String description,
            TaskStatus status,
            TaskPriority priority,
            LocalDate dueDate) {
    }

    public record StatusUpdateRequest(@NotNull TaskStatus status) {
    }

    public record TaskResponse(
            Long id,
            String title,
            String description,
            TaskStatus status,
            TaskPriority priority,
            LocalDate dueDate,
            LocalDateTime createdAt,
            LocalDateTime updatedAt) {

        static TaskResponse from(Task task) {
            return new TaskResponse(task.getId(), task.getTitle(), task.getDescription(), task.getStatus(),
                    task.getPriority(), task.getDueDate(), task.getCreatedAt(), task.getUpdatedAt());
        }
    }

    public record TaskOwnerSummary(Long id, String fullName, String email, long todo, long inProgress, long done,
                                   long total) {

        public TaskOwnerSummary(Long id, String fullName, String email, long todo, long inProgress, long done) {
            this(id, fullName, email, todo, inProgress, done, todo + inProgress + done);
        }
    }
}
