package com.taskflow.time;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

/** Time entries as CSV (RFC 4180), one row per entry, for spreadsheets. */
final class TimeReportCsv {

    static final String HEADER = "Date,Start,End,Minutes,User,Task ID,Task,Labels,Note";

    private static final DateTimeFormatter DATE = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");

    private TimeReportCsv() {
    }

    static String write(List<TimeEntry> entries) {
        StringBuilder csv = new StringBuilder(HEADER).append("\r\n");
        for (TimeEntry e : entries) {
            String labels = e.getTask().getLabels().stream().sorted().collect(Collectors.joining(", "));
            csv.append(String.join(",",
                    e.getStartedAt().format(DATE),
                    e.getStartedAt().format(TIME),
                    e.getEndedAt().format(TIME),
                    // rounded to the minute, like the durations shown in the app
                    String.valueOf(e.getSeconds() / 60),
                    cell(e.getUser() == null ? "Deleted user" : e.getUser().getFullName()),
                    String.valueOf(e.getTask().getId()),
                    cell(e.getTask().getTitle()),
                    cell(labels),
                    cell(e.getNote())
            )).append("\r\n");
        }
        return csv.toString();
    }

    /**
     * Quotes the text when needed, and defuses text a spreadsheet would run as a formula (a title starting with "=",
     * "+", "-" or "@") by prefixing it with an apostrophe.
     */
    static String cell(String text) {
        if (text == null || text.isEmpty()) {
            return "";
        }
        String value = "=+-@\t\r".indexOf(text.charAt(0)) >= 0 ? "'" + text : text;
        if (value.matches("(?s).*[\",\r\n].*")) {
            return '"' + value.replace("\"", "\"\"") + '"';
        }
        return value;
    }
}
