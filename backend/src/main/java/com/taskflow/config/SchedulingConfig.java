package com.taskflow.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Background work: emails are sent asynchronously, the daily digest runs on a cron schedule. */
@Configuration
@EnableAsync
@EnableScheduling
public class SchedulingConfig {
}
