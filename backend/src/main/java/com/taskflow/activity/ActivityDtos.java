package com.taskflow.activity;

import java.time.LocalDateTime;

public final class ActivityDtos {

    private ActivityDtos() {
    }

    public record ActorResponse(Long id, String fullName) {
    }

    /**
     * @param actor    {@code null} when the user who made the change has since been deleted
     * @param oldValue the previous value: a status or priority name, an ISO date or the assignee's name;
     *                 {@code null} = none (and always for {@code CREATED})
     */
    public record TaskEventResponse(Long id, TaskEventType type, String oldValue, String newValue,
                                    ActorResponse actor, LocalDateTime createdAt) {

        static TaskEventResponse from(TaskEvent e) {
            ActorResponse actor = e.getActor() == null ? null
                    : new ActorResponse(e.getActor().getId(), e.getActor().getFullName());
            return new TaskEventResponse(e.getId(), e.getType(), e.getOldValue(), e.getNewValue(), actor,
                    e.getCreatedAt());
        }
    }
}
