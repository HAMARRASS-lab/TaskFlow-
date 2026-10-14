package com.taskflow.digest;

import com.taskflow.mail.MailService;
import com.taskflow.user.User;
import com.taskflow.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;

/** Emails the daily digest to every verified user who hasn't turned it off ({@code app.digest.cron}). */
@Component
public class DailyDigestJob {

    private static final Logger log = LoggerFactory.getLogger(DailyDigestJob.class);

    private final UserRepository users;
    private final DigestService digests;
    private final MailService mail;
    private final ZoneId zone;

    public DailyDigestJob(UserRepository users, DigestService digests, MailService mail,
                          @Value("${app.timezone}") ZoneId zone) {
        this.users = users;
        this.digests = digests;
        this.mail = mail;
        this.zone = zone;
    }

    @Scheduled(cron = "${app.digest.cron}", zone = "${app.timezone}")
    public void run() {
        LocalDate today = LocalDate.now(zone);
        int sent = 0;
        for (User user : users.findByEmailVerifiedTrueAndDigestEnabledTrue()) {
            try {
                var body = digests.build(user, today);
                if (body.isPresent()) {
                    mail.send(user.getEmail(), "Your TaskFlow day — " + today, body.get());
                    sent++;
                }
            } catch (RuntimeException e) {
                log.warn("Daily digest failed for user {}", user.getId(), e);
            }
        }
        log.info("Daily digest: {} email(s) queued", sent);
    }
}
