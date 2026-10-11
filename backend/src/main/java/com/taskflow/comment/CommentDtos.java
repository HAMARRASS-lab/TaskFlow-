package com.taskflow.comment;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public final class CommentDtos {

    private CommentDtos() {
    }

    public record CommentRequest(@NotBlank @Size(max = 2000) String body) {
    }

    public record AuthorResponse(Long id, String fullName) {
    }

    /** @param canDelete whether the current user may delete it: its author, the task's owner or an admin */
    public record CommentResponse(Long id, String body, AuthorResponse author, LocalDateTime createdAt,
                                  boolean canDelete) {
    }
}
