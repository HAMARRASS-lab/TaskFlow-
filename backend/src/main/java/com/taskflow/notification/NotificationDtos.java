package com.taskflow.notification;

import java.time.LocalDateTime;

public final class NotificationDtos {

    private NotificationDtos() {
    }

    public record ActorResponse(Long id, String fullName) {
    }

    /**
     * @param actor   who did it, {@code null} if their account was deleted
     * @param subject the task or meeting title
     */
    public record NotificationResponse(Long id, NotificationType type, ActorResponse actor, Long taskId,
                                       Long meetingId, String subject, boolean read, LocalDateTime createdAt) {

        static NotificationResponse from(Notification n) {
            ActorResponse actor = n.getActor() == null ? null
                    : new ActorResponse(n.getActor().getId(), n.getActor().getFullName());
            return new NotificationResponse(n.getId(), n.getType(), actor, n.getTaskId(), n.getMeetingId(),
                    n.getSubject(), n.getReadAt() != null, n.getCreatedAt());
        }
    }

    public record UnreadCountResponse(long count) {
    }
}
