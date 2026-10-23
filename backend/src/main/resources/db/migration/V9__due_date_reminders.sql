-- Due-date reminders: the due date each reminder was sent for, so it goes out once per due date
-- and again if the task is rescheduled.
ALTER TABLE tasks ADD COLUMN due_reminder_sent_for DATE;
ALTER TABLE tasks ADD COLUMN overdue_notice_sent_for DATE;

-- Tasks already late at upgrade time don't all fire an overdue notice on the first run.
UPDATE tasks SET due_reminder_sent_for = due_date, overdue_notice_sent_for = due_date
WHERE due_date < CURRENT_DATE AND status <> 'DONE';
