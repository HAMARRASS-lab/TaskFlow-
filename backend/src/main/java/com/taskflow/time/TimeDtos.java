package com.taskflow.time;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;
import java.util.List;

public final class TimeDtos {

    /** Longest duration that can be logged by hand at once: a full day. */
    public static final int MAX_LOGGED_MINUTES = 24 * 60;

    private TimeDtos() {
    }

    /** @param minutes {@code null} removes the estimate */
    public record EstimateRequest(@Min(1) @Max(99_999) Integer minutes) {
    }

    public record LogTimeRequest(@NotNull @Min(1) @Max(MAX_LOGGED_MINUTES) Integer minutes,
                                 @Size(max = 200) String note) {
    }

    public record LoggerResponse(Long id, String fullName) {
    }

    /**
     * @param user    {@code null} when the user who logged the time has since been deleted
     * @param seconds for a running timer, the time elapsed so far (measured by the server, so clients count on from
     *                there whatever their clock or time zone)
     * @param mine    whether the caller logged it (and so can delete it, or stop it while it runs)
     */
    public record TimeEntryResponse(Long id, LoggerResponse user, LocalDateTime startedAt, LocalDateTime endedAt,
                                    long seconds, boolean running, boolean mine, String note) {
    }

    /**
     * @param loggedSeconds the finished entries' total; running timers are not counted until stopped
     * @param canLog        whether the caller may start a timer, log time or set the estimate (the task's owner or
     *                      assignee)
     * @param entries       newest first, running timers included
     */
    public record TimeSummaryResponse(Integer estimateMinutes, long loggedSeconds, boolean canLog,
                                      List<TimeEntryResponse> entries) {
    }
}
