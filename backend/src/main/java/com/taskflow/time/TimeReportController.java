package com.taskflow.time;

import com.taskflow.time.TimeReportDtos.TimeReportResponse;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

/** Time logged between two dates (both included), by everyone or by {@code userId}. */
@RestController
@RequestMapping("/api/time/report")
public class TimeReportController {

    static final MediaType TEXT_CSV = new MediaType("text", "csv", StandardCharsets.UTF_8);

    private final TimeReportService reportService;

    public TimeReportController(TimeReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping
    public TimeReportResponse report(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                     @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                     @RequestParam(required = false) Long userId) {
        return reportService.report(from, to, userId);
    }

    /** The entries behind the report, one per row. */
    @GetMapping("/csv")
    public ResponseEntity<String> csv(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                      @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                      @RequestParam(required = false) Long userId) {
        String filename = "time-" + from + "-to-" + to + ".csv";
        return ResponseEntity.ok()
                .contentType(TEXT_CSV)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(filename).build()
                        .toString())
                .body(reportService.csv(from, to, userId));
    }
}
