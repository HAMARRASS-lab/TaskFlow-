package com.taskflow.notification;

public enum NotificationType {
    /** A task was assigned to the recipient. */
    TASK_ASSIGNED,
    /** Someone commented on a task the recipient owns, is assigned to or watches. */
    TASK_COMMENTED,
    /** Someone mentioned the recipient (@Full Name) in a comment on a task. */
    TASK_MENTIONED,
    /** A task the recipient is responsible for is due tomorrow (sent by the app, no actor). */
    TASK_DUE_SOON,
    /** A task the recipient is responsible for is past its due date (sent by the app, no actor). */
    TASK_OVERDUE,
    /** The recipient was invited to a meeting. */
    MEETING_INVITED,
    /** A meeting the recipient is invited to moved: they have to answer it again. */
    MEETING_RESCHEDULED
}
