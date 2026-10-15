package com.taskflow.calendar;

import com.taskflow.meeting.Meeting;
import com.taskflow.meeting.MeetingParticipant;
import com.taskflow.meeting.ParticipantStatus;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Serializes meetings as an iCalendar (RFC 5545) document, readable by Google Calendar, Outlook and Apple Calendar.
 * Meeting times are stored as local date-times in the app's time zone and written in UTC.
 */
public final class IcsWriter {

    private static final DateTimeFormatter UTC = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'");
    private static final String CRLF = "\r\n";
    private static final int MAX_LINE_OCTETS = 75;

    private IcsWriter() {
    }

    public static String write(String calendarName, List<Meeting> meetings, ZoneId zone, Instant now) {
        StringBuilder out = new StringBuilder();
        line(out, "BEGIN:VCALENDAR");
        line(out, "VERSION:2.0");
        line(out, "PRODID:-//TaskFlow//Meetings//EN");
        line(out, "CALSCALE:GREGORIAN");
        line(out, "METHOD:PUBLISH");
        line(out, "X-WR-CALNAME:" + escape(calendarName));
        for (Meeting m : meetings) {
            line(out, "BEGIN:VEVENT");
            line(out, "UID:meeting-" + m.getId() + "@taskflow");
            line(out, "DTSTAMP:" + UTC.format(now.atOffset(ZoneOffset.UTC)));
            line(out, "DTSTART:" + utc(m.getStartAt(), zone));
            line(out, "DTEND:" + utc(m.getEndAt(), zone));
            // audit timestamps come from LocalDateTime.now(), i.e. the server's zone, not the meeting zone
            if (m.getUpdatedAt() != null) line(out, "LAST-MODIFIED:" + utc(m.getUpdatedAt(), ZoneId.systemDefault()));
            line(out, "SUMMARY:" + escape(m.getTitle()));
            if (m.getLocation() != null && !m.getLocation().isBlank()) {
                line(out, "LOCATION:" + escape(m.getLocation()));
            }
            String description = description(m);
            if (!description.isEmpty()) line(out, "DESCRIPTION:" + escape(description));
            line(out, "ORGANIZER;CN=" + param(m.getOwner().getFullName()) + ":mailto:" + m.getOwner().getEmail());
            for (MeetingParticipant p : m.getParticipants()) {
                if (p.getParticipant().contains("@")) {
                    line(out, "ATTENDEE;PARTSTAT=" + partStat(p.getStatus()) + ":mailto:" + p.getParticipant());
                }
            }
            line(out, "STATUS:CONFIRMED");
            line(out, "END:VEVENT");
        }
        line(out, "END:VCALENDAR");
        return out.toString();
    }

    /** The description, plus participants without an email (they can't be ATTENDEEs). */
    private static String description(Meeting m) {
        List<String> names = m.getParticipants().stream()
                .map(MeetingParticipant::getParticipant)
                .filter(p -> !p.contains("@"))
                .toList();
        String text = m.getDescription() == null ? "" : m.getDescription().strip();
        if (!names.isEmpty()) {
            text += (text.isEmpty() ? "" : "\n\n") + "Participants: " + String.join(", ", names);
        }
        return text;
    }

    private static String utc(LocalDateTime local, ZoneId zone) {
        return UTC.format(local.atZone(zone).withZoneSameInstant(ZoneOffset.UTC));
    }

    private static String partStat(ParticipantStatus status) {
        return switch (status) {
            case ACCEPTED -> "ACCEPTED";
            case DECLINED -> "DECLINED";
            case PENDING -> "NEEDS-ACTION";
        };
    }

    /** TEXT value escaping (RFC 5545 §3.3.11). */
    static String escape(String value) {
        return value.replace("\\", "\\\\")
                .replace(";", "\\;")
                .replace(",", "\\,")
                .replace("\r\n", "\\n")
                .replace("\n", "\\n")
                .replace("\r", "\\n");
    }

    /** A parameter value: quoted, as it may contain ':' ';' ','; DQUOTE and control characters aren't allowed. */
    private static String param(String value) {
        return "\"" + value.replaceAll("[\"\\p{Cntrl}]", "") + "\"";
    }

    /** Appends a content line, folded at 75 octets without splitting a UTF-8 character (RFC 5545 §3.1). */
    static void line(StringBuilder out, String content) {
        int octets = 0;
        for (int i = 0; i < content.length(); ) {
            int cp = content.codePointAt(i);
            int size = new String(Character.toChars(cp)).getBytes(StandardCharsets.UTF_8).length;
            if (octets + size > MAX_LINE_OCTETS) {
                out.append(CRLF).append(' ');
                octets = 1;
            }
            out.appendCodePoint(cp);
            octets += size;
            i += Character.charCount(cp);
        }
        out.append(CRLF);
    }
}
