package com.taskflow.reminder;

import com.taskflow.mail.MailService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;

/** Sends the due-date reminders ({@code app.reminders.cron}); emails go out only once the reminders are committed. */
@Component
public class DueDateReminderJob {

    private static final Logger log = LoggerFactory.getLogger(DueDateReminderJob.class);

    private final DueDateReminderService reminders;
    private final MailService mail;
    private final ZoneId zone;

    public DueDateReminderJob(DueDateReminderService reminders, MailService mail,
                              @Value("${app.timezone}") ZoneId zone) {
        this.reminders = reminders;
        this.mail = mail;
        this.zone = zone;
    }

    @Scheduled(cron = "${app.reminders.cron}", zone = "${app.timezone}")
    public void run() {
        var emails = reminders.remind(LocalDate.now(zone));
        emails.forEach(e -> mail.send(e.to(), e.subject(), e.body()));
        log.info("Due-date reminders: {} email(s) queued", emails.size());
    }
}
