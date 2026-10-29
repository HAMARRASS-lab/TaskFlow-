package com.taskflow.time;

import com.taskflow.common.BadRequestException;
import com.taskflow.task.Task;
import com.taskflow.time.TimeReportDtos.LabelTotal;
import com.taskflow.time.TimeReportDtos.TaskTotal;
import com.taskflow.time.TimeReportDtos.TimeReportResponse;
import com.taskflow.time.TimeReportDtos.UserTotal;
import com.taskflow.time.TimeReportDtos.WeekTotal;
import com.taskflow.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TimeReportServiceTest {

    /** Wednesday 7 to Tuesday 20 October 2026: three weeks, starting on Mondays the 5th, 12th and 19th. */
    private static final LocalDate FROM = LocalDate.of(2026, 10, 7);
    private static final LocalDate TO = LocalDate.of(2026, 10, 20);

    @Mock
    private TimeEntryRepository entries;

    private TimeReportService service;

    private User alice;
    private User bob;
    private Task docs;
    private Task build;

    @BeforeEach
    void setUp() {
        service = new TimeReportService(entries);
        alice = user(1L, "Alice");
        bob = user(2L, "Bob");
        docs = task(10L, "Write the docs", 120, "docs", "backend");
        build = task(11L, "Fix the build", null);
    }

    private static User user(Long id, String name) {
        User user = new User(name.toLowerCase() + "@test.com", "hash", name);
        user.setId(id);
        return user;
    }

    private static Task task(Long id, String title, Integer estimate, String... labels) {
        Task task = new Task();
        task.setId(id);
        task.setTitle(title);
        task.setEstimateMinutes(estimate);
        task.getLabels().addAll(List.of(labels));
        return task;
    }

    private static TimeEntry entry(Task task, User user, String endedAt, int minutes) {
        return new TimeEntry(task, user, LocalDateTime.parse(endedAt), Duration.ofMinutes(minutes), null);
    }

    @Test
    void totalsPerUserLabelWeekAndTask() {
        when(entries.findFinishedBetween(FROM.atStartOfDay(), TO.plusDays(1).atStartOfDay(), null)).thenReturn(List.of(
                entry(docs, alice, "2026-10-07T10:00", 60),
                entry(build, bob, "2026-10-08T10:00", 30),
                entry(docs, bob, "2026-10-19T10:00", 90),
                entry(build, null, "2026-10-20T10:00", 15)));

        TimeReportResponse report = service.report(FROM, TO, null);

        assertThat(report.totalSeconds()).isEqualTo(195 * 60);
        assertThat(report.entryCount()).isEqualTo(4);
        assertThat(report.byUser()).containsExactly(
                new UserTotal(2L, "Bob", 120 * 60),
                new UserTotal(1L, "Alice", 60 * 60),
                new UserTotal(null, "Deleted user", 15 * 60));
        // both of docs' labels get its time; untagged comes last
        assertThat(report.byLabel()).containsExactly(
                new LabelTotal("backend", 150 * 60),
                new LabelTotal("docs", 150 * 60),
                new LabelTotal(null, 45 * 60));
        // the empty week in the middle is listed too
        assertThat(report.byWeek()).containsExactly(
                new WeekTotal(LocalDate.of(2026, 10, 5), 90 * 60),
                new WeekTotal(LocalDate.of(2026, 10, 12), 0),
                new WeekTotal(LocalDate.of(2026, 10, 19), 105 * 60));
        assertThat(report.topTasks()).containsExactly(
                new TaskTotal(10L, "Write the docs", 120, 150 * 60),
                new TaskTotal(11L, "Fix the build", null, 45 * 60));
    }

    @Test
    void anEmptyPeriodStillListsItsWeeks() {
        LocalDate monday = LocalDate.of(2026, 10, 26);
        when(entries.findFinishedBetween(any(), any(), eq(1L))).thenReturn(List.of());

        TimeReportResponse report = service.report(monday, monday, 1L);

        assertThat(report.totalSeconds()).isZero();
        assertThat(report.userId()).isEqualTo(1L);
        assertThat(report.byWeek()).containsExactly(new WeekTotal(monday, 0));
        assertThat(report.byUser()).isEmpty();
        assertThat(report.byLabel()).isEmpty();
    }

    @Test
    void onlyTheTenTasksWithTheMostTimeAreListed() {
        List<TimeEntry> list = new java.util.ArrayList<>();
        for (int i = 1; i <= 12; i++) {
            list.add(entry(task((long) i, "Task " + i, null), alice, "2026-10-08T10:00", i));
        }
        when(entries.findFinishedBetween(any(), any(), any())).thenReturn(list);

        List<TaskTotal> top = service.report(FROM, TO, null).topTasks();

        assertThat(top).hasSize(TimeReportDtos.TOP_TASKS);
        assertThat(top.get(0).id()).isEqualTo(12L);
        assertThat(top.get(9).id()).isEqualTo(3L);
    }

    @Test
    void rejectsBackwardsOrTooLongPeriods() {
        assertThatThrownBy(() -> service.report(TO, FROM, null)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.csv(FROM, FROM.plusDays(TimeReportDtos.MAX_DAYS), null))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(entries);
    }

    @Test
    void writesTheEntriesAsCsv() {
        when(entries.findFinishedBetween(any(), any(), any())).thenReturn(List.of(
                new TimeEntry(docs, alice, LocalDateTime.parse("2026-10-07T10:00"), Duration.ofMinutes(90),
                        "Draft, \"v1\""),
                entry(task(12L, "=SUM(A1)", null), null, "2026-10-08T09:30", 45)));

        String csv = service.csv(FROM, TO, null);

        assertThat(csv.split("\r\n")).containsExactly(
                TimeReportCsv.HEADER,
                "2026-10-07,08:30,10:00,90,Alice,10,Write the docs,\"backend, docs\",\"Draft, \"\"v1\"\"\"",
                "2026-10-08,08:45,09:30,45,Deleted user,12,'=SUM(A1),,");
    }

    @Test
    void csvCellsAreQuotedOnlyWhenNeeded() {
        assertThat(TimeReportCsv.cell(null)).isEmpty();
        assertThat(TimeReportCsv.cell("Plain")).isEqualTo("Plain");
        assertThat(TimeReportCsv.cell("Two\nlines")).isEqualTo("\"Two\nlines\"");
        assertThat(TimeReportCsv.cell("-1, really")).isEqualTo("\"'-1, really\"");
        assertThat(TimeReportCsv.cell("@here")).isEqualTo("'@here");
    }
}
