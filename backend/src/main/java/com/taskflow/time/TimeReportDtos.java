package com.taskflow.time;

import java.time.LocalDate;
import java.util.List;

public final class TimeReportDtos {

    /** Longest period a report can cover, so a typo in a date doesn't load every entry ever logged. */
    public static final int MAX_DAYS = 366;

    /** How many tasks the report lists, the ones with the most time first. */
    public static final int TOP_TASKS = 10;

    private TimeReportDtos() {
    }

    /** @param id {@code null} for time logged by users who have since been deleted */
    public record UserTotal(Long id, String fullName, long seconds) {
    }

    /** @param label {@code null} for tasks without a label */
    public record LabelTotal(String label, long seconds) {
    }

    /** @param weekStart the Monday the week starts on */
    public record WeekTotal(LocalDate weekStart, long seconds) {
    }

    public record TaskTotal(Long id, String title, Integer estimateMinutes, long seconds) {
    }

    /**
     * Finished time entries started between {@code from} and {@code to} (both included); running timers count once
     * stopped.
     *
     * @param byUser  the most time first
     * @param byLabel the most time first, untagged tasks last; an entry on a task with several labels counts for each,
     *                so these may add up to more than the total
     * @param byWeek  every week the period touches, oldest first, including those with no time
     * @param topTasks the {@value #TOP_TASKS} tasks with the most time
     */
    public record TimeReportResponse(LocalDate from, LocalDate to, Long userId, long totalSeconds, int entryCount,
                                     List<UserTotal> byUser, List<LabelTotal> byLabel, List<WeekTotal> byWeek,
                                     List<TaskTotal> topTasks) {
    }
}
