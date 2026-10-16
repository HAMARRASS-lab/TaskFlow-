package com.taskflow.notification;

public enum NotificationType {
    /** A task was assigned to the recipient. */
    TASK_ASSIGNED,
    /** Someone commented on a task the recipient owns, is assigned to or watches. */
    TASK_COMMENTED,
    /** The recipient was invited to a meeting. */
    MEETING_INVITED,
    /** A meeting the recipient is invited to moved: they have to answer it again. */
    MEETING_RESCHEDULED
}
