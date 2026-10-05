package com.taskflow.meeting;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;
import java.util.List;

public final class MeetingDtos {

    private MeetingDtos() {
    }

    public record MeetingRequest(
            @NotBlank @Size(max = 200) String title,
            @Size(max = 2000) String description,
            @Size(max = 255) String location,
            @NotNull LocalDateTime startAt,
            @NotNull LocalDateTime endAt,
            @Size(max = 50) List<@NotBlank @Size(max = 255) String> participants) {
    }

    /** An invitee's answer: ACCEPTED or DECLINED. */
    public record RespondRequest(@NotNull ParticipantStatus status) {
    }

    public record OrganizerResponse(String email, String fullName) {
    }

    /** {@code fullName} is set when the participant is a registered user (and so sees the meeting). */
    public record ParticipantResponse(String participant, String fullName, ParticipantStatus status) {
    }

    /**
     * @param organizedByMe whether the current user organizes the meeting (and can edit / delete it)
     * @param myStatus      the current user's answer when invited, {@code null} for the organizer
     */
    public record MeetingResponse(
            Long id,
            String title,
            String description,
            String location,
            LocalDateTime startAt,
            LocalDateTime endAt,
            OrganizerResponse organizer,
            boolean organizedByMe,
            ParticipantStatus myStatus,
            List<ParticipantResponse> participants,
            LocalDateTime createdAt,
            LocalDateTime updatedAt) {
    }
}
