package com.taskflow.comment;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;
import java.util.List;

public final class CommentDtos {

    private CommentDtos() {
    }

    /**
     * @param mentionedUserIds users picked in the "@" autocomplete; only those whose "@Full Name" is still in the
     *                         body are notified. Optional.
     */
    public record CommentRequest(@NotBlank @Size(max = 2000) String body,
                                 @Size(max = 20) List<Long> mentionedUserIds) {

        public CommentRequest(String body) {
            this(body, null);
        }
    }

    public record AuthorResponse(Long id, String fullName) {
    }

    /** @param canDelete whether the current user may delete it: its author, the task's owner or an admin */
    public record CommentResponse(Long id, String body, AuthorResponse author, LocalDateTime createdAt,
                                  boolean canDelete) {
    }
}
