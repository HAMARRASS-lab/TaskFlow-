package com.taskflow.time;

import com.taskflow.common.BadRequestException;
import com.taskflow.task.Task;
import com.taskflow.time.TimeReportDtos.LabelTotal;
import com.taskflow.time.TimeReportDtos.TaskTotal;
import com.taskflow.time.TimeReportDtos.TimeReportResponse;
import com.taskflow.time.TimeReportDtos.UserTotal;
import com.taskflow.time.TimeReportDtos.WeekTotal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/**
 * Time logged over a period, totalled per user, label, week and task, and the entries themselves as CSV. Like the
 * time on a task, everyone can see it. Entries count on the day they started.
 */
@Service
@Transactional(readOnly = true)
public class TimeReportService {

    private final TimeEntryRepository entries;

    public TimeReportService(TimeEntryRepository entries) {
        this.entries = entries;
    }

    /** @param userId only this user's time, or everyone's when {@code null} */
    public TimeReportResponse report(LocalDate from, LocalDate to, Long userId) {
        List<TimeEntry> list = load(from, to, userId);
        long total = list.stream().mapToLong(TimeEntry::getSeconds).sum();
        return new TimeReportResponse(from, to, userId, total, list.size(), byUser(list), byLabel(list),
                byWeek(list, from, to), topTasks(list));
    }

    public String csv(LocalDate from, LocalDate to, Long userId) {
        return TimeReportCsv.write(load(from, to, userId));
    }

    private List<TimeEntry> load(LocalDate from, LocalDate to, Long userId) {
        if (from.isAfter(to)) {
            throw new BadRequestException("The start date must not be after the end date");
        }
        if (ChronoUnit.DAYS.between(from, to) >= TimeReportDtos.MAX_DAYS) {
            throw new BadRequestException("A report covers at most " + TimeReportDtos.MAX_DAYS + " days");
        }
        return entries.findFinishedBetween(from.atStartOfDay(), to.plusDays(1).atStartOfDay(), userId);
    }

    private static List<UserTotal> byUser(List<TimeEntry> list) {
        Map<Long, UserTotal> totals = new LinkedHashMap<>();
        for (TimeEntry e : list) {
            Long id = e.getUser() == null ? null : e.getUser().getId();
            String name = e.getUser() == null ? "Deleted user" : e.getUser().getFullName();
            totals.merge(id, new UserTotal(id, name, e.getSeconds()),
                    (a, b) -> new UserTotal(a.id(), a.fullName(), a.seconds() + b.seconds()));
        }
        return totals.values().stream()
                .sorted(Comparator.comparingLong(UserTotal::seconds).reversed().thenComparing(UserTotal::fullName))
                .toList();
    }

    private static List<LabelTotal> byLabel(List<TimeEntry> list) {
        Map<String, Long> totals = new LinkedHashMap<>();
        long untagged = 0;
        for (TimeEntry e : list) {
            if (e.getTask().getLabels().isEmpty()) {
                untagged += e.getSeconds();
            }
            for (String label : e.getTask().getLabels()) {
                totals.merge(label, e.getSeconds(), Long::sum);
            }
        }
        List<LabelTotal> result = new ArrayList<>(totals.entrySet().stream()
                .map(t -> new LabelTotal(t.getKey(), t.getValue()))
                .sorted(Comparator.comparingLong(LabelTotal::seconds).reversed().thenComparing(LabelTotal::label))
                .toList());
        if (untagged > 0) {
            result.add(new LabelTotal(null, untagged));
        }
        return result;
    }

    private static List<WeekTotal> byWeek(List<TimeEntry> list, LocalDate from, LocalDate to) {
        Map<LocalDate, Long> totals = new LinkedHashMap<>();
        for (LocalDate week = monday(from); !week.isAfter(to); week = week.plusWeeks(1)) {
            totals.put(week, 0L);
        }
        for (TimeEntry e : list) {
            totals.merge(monday(e.getStartedAt().toLocalDate()), e.getSeconds(), Long::sum);
        }
        return totals.entrySet().stream().map(t -> new WeekTotal(t.getKey(), t.getValue())).toList();
    }

    private static List<TaskTotal> topTasks(List<TimeEntry> list) {
        Map<Long, Long> totals = new LinkedHashMap<>();
        Map<Long, Task> tasks = new LinkedHashMap<>();
        for (TimeEntry e : list) {
            totals.merge(e.getTask().getId(), e.getSeconds(), Long::sum);
            tasks.putIfAbsent(e.getTask().getId(), e.getTask());
        }
        Function<Long, TaskTotal> toTotal = id -> {
            Task t = tasks.get(id);
            return new TaskTotal(id, t.getTitle(), t.getEstimateMinutes(), totals.get(id));
        };
        return totals.keySet().stream()
                .map(toTotal)
                .sorted(Comparator.comparingLong(TaskTotal::seconds).reversed().thenComparing(TaskTotal::id))
                .limit(TimeReportDtos.TOP_TASKS)
                .toList();
    }

    private static LocalDate monday(LocalDate day) {
        return day.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }
}
