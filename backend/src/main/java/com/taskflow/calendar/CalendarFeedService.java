package com.taskflow.calendar;

import com.taskflow.auth.UserTokenService;
import com.taskflow.common.NotFoundException;
import com.taskflow.meeting.Meeting;
import com.taskflow.meeting.MeetingRepository;
import com.taskflow.meeting.ParticipantStatus;
import com.taskflow.user.User;
import com.taskflow.user.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

/**
 * iCalendar export of meetings: a single meeting as a downloadable .ics file, and a private subscription feed
 * (a secret URL that Google Calendar, Outlook or Apple Calendar poll to keep a read-only copy in sync).
 */
@Service
public class CalendarFeedService {

    /** The feed covers recent history and the coming years. */
    private static final int FEED_PAST_DAYS = 90;
    private static final int FEED_FUTURE_YEARS = 5;

    private final MeetingRepository meetings;
    private final UserRepository users;
    private final ZoneId zone;
    private final String frontendUrl;

    public CalendarFeedService(MeetingRepository meetings, UserRepository users,
                               @Value("${app.timezone}") ZoneId zone,
                               @Value("${app.frontend-url}") String frontendUrl) {
        this.meetings = meetings;
        this.users = users;
        this.zone = zone;
        this.frontendUrl = frontendUrl.replaceAll("/+$", "");
    }

    @Transactional(readOnly = true)
    public String meetingIcs(User user, Long meetingId) {
        Meeting meeting = meetings.findVisibleById(meetingId, user.getId(), user.getEmail())
                .orElseThrow(() -> new NotFoundException("Meeting not found"));
        return IcsWriter.write(meeting.getTitle(), List.of(meeting), zone, Instant.now());
    }

    /** The feed of the user owning {@code token}: meetings they organize or are invited to and haven't declined. */
    @Transactional(readOnly = true)
    public String feed(String token) {
        User user = users.findByCalendarFeedToken(token)
                .orElseThrow(() -> new NotFoundException("Unknown calendar feed"));
        LocalDateTime now = LocalDateTime.now(zone);
        List<Meeting> visible = meetings.findVisible(user.getId(), user.getEmail(),
                        now.minusDays(FEED_PAST_DAYS), now.plusYears(FEED_FUTURE_YEARS)).stream()
                .filter(m -> m.isOwnedBy(user)
                        || m.participantFor(user).map(p -> p.getStatus() != ParticipantStatus.DECLINED).orElse(false))
                .toList();
        return IcsWriter.write("TaskFlow — " + user.getFullName(), visible, zone, Instant.now());
    }

    /** The current feed URL, or {@code null} when none is enabled. */
    public String feedUrl(User principal) {
        return users.findById(principal.getId()).map(User::getCalendarFeedToken).map(this::url).orElse(null);
    }

    /** Creates a new secret URL; any previously shared URL stops working. */
    @Transactional
    public String regenerate(User principal) {
        User user = reload(principal);
        user.setCalendarFeedToken(UserTokenService.randomToken());
        return url(user.getCalendarFeedToken());
    }

    @Transactional
    public void disable(User principal) {
        reload(principal).setCalendarFeedToken(null);
    }

    private User reload(User principal) {
        return users.findById(principal.getId()).orElseThrow(() -> new NotFoundException("User not found"));
    }

    private String url(String token) {
        return frontendUrl + "/api/calendar/feed/" + token;
    }
}
