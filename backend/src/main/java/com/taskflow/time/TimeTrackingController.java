package com.taskflow.time;

import com.taskflow.time.TimeDtos.EstimateRequest;
import com.taskflow.time.TimeDtos.LogTimeRequest;
import com.taskflow.time.TimeDtos.TimeSummaryResponse;
import com.taskflow.user.User;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** Every endpoint answers with the task's updated time summary. */
@RestController
@RequestMapping("/api/tasks/{taskId}/time")
public class TimeTrackingController {

    private final TimeTrackingService timeService;

    public TimeTrackingController(TimeTrackingService timeService) {
        this.timeService = timeService;
    }

    @GetMapping
    public TimeSummaryResponse summary(@AuthenticationPrincipal User user, @PathVariable Long taskId) {
        return timeService.summary(user, taskId);
    }

    /** Starts the caller's timer on the task, stopping the one they may have running on another task. */
    @PostMapping("/start")
    public TimeSummaryResponse start(@AuthenticationPrincipal User user, @PathVariable Long taskId) {
        return timeService.start(user, taskId);
    }

    @PostMapping("/stop")
    public TimeSummaryResponse stop(@AuthenticationPrincipal User user, @PathVariable Long taskId) {
        return timeService.stop(user, taskId);
    }

    /** Logs time spent without the timer, ending now. */
    @PostMapping("/entries")
    public TimeSummaryResponse log(@AuthenticationPrincipal User user, @PathVariable Long taskId,
                                   @Valid @RequestBody LogTimeRequest request) {
        return timeService.log(user, taskId, request.minutes(), request.note());
    }

    @DeleteMapping("/entries/{entryId}")
    public TimeSummaryResponse delete(@AuthenticationPrincipal User user, @PathVariable Long taskId,
                                      @PathVariable Long entryId) {
        return timeService.delete(user, taskId, entryId);
    }

    @PutMapping("/estimate")
    public TimeSummaryResponse setEstimate(@AuthenticationPrincipal User user, @PathVariable Long taskId,
                                           @Valid @RequestBody EstimateRequest request) {
        return timeService.setEstimate(user, taskId, request.minutes());
    }
}
