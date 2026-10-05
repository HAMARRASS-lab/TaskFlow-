package com.taskflow.meeting;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** A meeting participant: a free-text name, or an email (lower-cased) that may match a registered user. */
@Embeddable
public class MeetingParticipant {

    @Column(name = "participant", nullable = false)
    private String participant;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 20)
    private ParticipantStatus status = ParticipantStatus.PENDING;

    protected MeetingParticipant() {
    }

    public MeetingParticipant(String participant, ParticipantStatus status) {
        this.participant = participant;
        this.status = status;
    }

    /** Trims and lower-cases emails so they match {@code users.email}; names are kept as typed. */
    public static String normalize(String participant) {
        String value = participant.trim();
        return value.contains("@") ? value.toLowerCase() : value;
    }

    public String getParticipant() { return participant; }
    public ParticipantStatus getStatus() { return status; }
    public void setStatus(ParticipantStatus status) { this.status = status; }
}
