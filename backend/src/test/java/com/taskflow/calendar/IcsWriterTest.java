package com.taskflow.calendar;

import com.taskflow.meeting.Meeting;
import com.taskflow.meeting.MeetingParticipant;
import com.taskflow.meeting.ParticipantStatus;
import com.taskflow.user.User;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class IcsWriterTest {

    private static final ZoneId PARIS = ZoneId.of("Europe/Paris");
    private static final Instant NOW = Instant.parse("2026-10-15T08:00:00Z");

    private Meeting meeting() {
        User owner = new User("alice@test.com", "hash", "Alice Martin");
        owner.setId(1L);
        Meeting m = new Meeting();
        m.setId(42L);
        m.setOwner(owner);
        m.setTitle("Sprint review; demo, Q&A");
        m.setDescription("Line one\nLine two");
        m.setLocation("Room A");
        // summer time in Paris: UTC+2
        m.setStartAt(LocalDateTime.of(2026, 7, 1, 9, 30));
        m.setEndAt(LocalDateTime.of(2026, 7, 1, 10, 30));
        m.setParticipants(List.of(
                new MeetingParticipant("bob@test.com", ParticipantStatus.ACCEPTED),
                new MeetingParticipant("carol@test.com", ParticipantStatus.PENDING),
                new MeetingParticipant("Dave (external)", ParticipantStatus.PENDING)));
        return m;
    }

    @Test
    void writesAnEventInUtcWithEscapedTextAndAttendees() {
        String ics = IcsWriter.write("Team", List.of(meeting()), PARIS, NOW);

        assertThat(ics).startsWith("BEGIN:VCALENDAR\r\n").endsWith("END:VCALENDAR\r\n");
        assertThat(ics).contains(
                "UID:meeting-42@taskflow\r\n",
                "DTSTAMP:20261015T080000Z\r\n",
                "DTSTART:20260701T073000Z\r\n",
                "DTEND:20260701T083000Z\r\n",
                "SUMMARY:Sprint review\\; demo\\, Q&A\r\n",
                "LOCATION:Room A\r\n",
                "DESCRIPTION:Line one\\nLine two\\n\\nParticipants: Dave (external)\r\n",
                "ORGANIZER;CN=\"Alice Martin\":mailto:alice@test.com\r\n",
                "ATTENDEE;PARTSTAT=ACCEPTED:mailto:bob@test.com\r\n",
                "ATTENDEE;PARTSTAT=NEEDS-ACTION:mailto:carol@test.com\r\n");
        assertThat(ics).doesNotContain("mailto:Dave");
    }

    @Test
    void foldsLongLinesAt75OctetsWithoutSplittingCharacters() {
        StringBuilder out = new StringBuilder();
        IcsWriter.line(out, "SUMMARY:" + "é".repeat(60));

        String[] lines = out.toString().split("\r\n");
        assertThat(lines).hasSizeGreaterThan(1);
        Arrays.stream(lines).forEach(l -> assertThat(l.getBytes(StandardCharsets.UTF_8).length).isLessThanOrEqualTo(75));
        String unfolded = out.toString().replace("\r\n ", "");
        assertThat(unfolded).isEqualTo("SUMMARY:" + "é".repeat(60) + "\r\n");
    }

    @Test
    void escapesBackslashesFirst() {
        assertThat(IcsWriter.escape("a\\b;c")).isEqualTo("a\\\\b\\;c");
    }
}
