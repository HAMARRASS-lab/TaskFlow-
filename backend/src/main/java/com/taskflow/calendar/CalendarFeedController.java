package com.taskflow.calendar;

import com.taskflow.user.User;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;

@RestController
public class CalendarFeedController {

    static final MediaType TEXT_CALENDAR = new MediaType("text", "calendar", StandardCharsets.UTF_8);

    private final CalendarFeedService calendarFeedService;

    public CalendarFeedController(CalendarFeedService calendarFeedService) {
        this.calendarFeedService = calendarFeedService;
    }

    public record FeedResponse(String url) {
    }

    /** One meeting as a file to import into another calendar. */
    @GetMapping("/api/meetings/{id}/ics")
    public ResponseEntity<String> meetingIcs(@AuthenticationPrincipal User user, @PathVariable Long id) {
        return ResponseEntity.ok()
                .contentType(TEXT_CALENDAR)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename("meeting-" + id + ".ics").build().toString())
                .body(calendarFeedService.meetingIcs(user, id));
    }

    /** Public: polled by calendar apps, authenticated by the secret token in the URL. */
    @GetMapping("/api/calendar/feed/{token}")
    public ResponseEntity<String> feed(@PathVariable String token) {
        return ResponseEntity.ok()
                .contentType(TEXT_CALENDAR)
                .cacheControl(CacheControl.noStore())
                .body(calendarFeedService.feed(token));
    }

    @GetMapping("/api/calendar/feed")
    public FeedResponse feedUrl(@AuthenticationPrincipal User user) {
        return new FeedResponse(calendarFeedService.feedUrl(user));
    }

    @PostMapping("/api/calendar/feed")
    public FeedResponse regenerateFeed(@AuthenticationPrincipal User user) {
        return new FeedResponse(calendarFeedService.regenerate(user));
    }

    @DeleteMapping("/api/calendar/feed")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void disableFeed(@AuthenticationPrincipal User user) {
        calendarFeedService.disable(user);
    }
}
