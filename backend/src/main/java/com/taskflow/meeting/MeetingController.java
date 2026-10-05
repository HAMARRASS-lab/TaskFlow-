package com.taskflow.meeting;

import com.taskflow.meeting.MeetingDtos.MeetingRequest;
import com.taskflow.meeting.MeetingDtos.MeetingResponse;
import com.taskflow.meeting.MeetingDtos.RespondRequest;
import com.taskflow.user.User;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/meetings")
public class MeetingController {

    private final MeetingService meetingService;

    public MeetingController(MeetingService meetingService) {
        this.meetingService = meetingService;
    }

    @GetMapping
    public List<MeetingResponse> list(
            @AuthenticationPrincipal User user,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {
        return meetingService.findAll(user, from, to);
    }

    /** Upcoming meetings shared with the current user that they have not answered yet. */
    @GetMapping("/invitations")
    public List<MeetingResponse> invitations(@AuthenticationPrincipal User user) {
        return meetingService.findInvitations(user);
    }

    @GetMapping("/{id}")
    public MeetingResponse get(@AuthenticationPrincipal User user, @PathVariable Long id) {
        return meetingService.findOne(user, id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MeetingResponse create(@AuthenticationPrincipal User user, @Valid @RequestBody MeetingRequest request) {
        return meetingService.create(user, request);
    }

    @PutMapping("/{id}")
    public MeetingResponse update(@AuthenticationPrincipal User user, @PathVariable Long id,
                                  @Valid @RequestBody MeetingRequest request) {
        return meetingService.update(user, id, request);
    }

    @PatchMapping("/{id}/response")
    public MeetingResponse respond(@AuthenticationPrincipal User user, @PathVariable Long id,
                                   @Valid @RequestBody RespondRequest request) {
        return meetingService.respond(user, id, request.status());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal User user, @PathVariable Long id) {
        meetingService.delete(user, id);
    }
}
