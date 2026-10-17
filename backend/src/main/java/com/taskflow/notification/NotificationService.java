package com.taskflow.notification;

import com.taskflow.common.NotFoundException;
import com.taskflow.meeting.Meeting;
import com.taskflow.notification.NotificationDtos.NotificationResponse;
import com.taskflow.task.Task;
import com.taskflow.user.User;
import com.taskflow.user.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * The bell: tells users what others did that concerns them. Nobody is notified of their own actions. Notifications
 * are written in the transaction of the change that caused them, so they exist only if that change is committed.
 */
@Service
@Transactional
public class NotificationService {

    static final int MAX_LIMIT = 100;

    private final NotificationRepository notifications;
    private final UserRepository users;

    public NotificationService(NotificationRepository notifications, UserRepository users) {
        this.notifications = notifications;
        this.users = users;
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> findRecent(User user, int limit) {
        int size = Math.clamp(limit, 1, MAX_LIMIT);
        return notifications.findByRecipientIdOrderByCreatedAtDescIdDesc(user.getId(), PageRequest.of(0, size))
                .stream()
                .map(NotificationResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public long countUnread(User user) {
        return notifications.countByRecipientIdAndReadAtIsNull(user.getId());
    }

    public void markRead(User user, Long id) {
        Notification notification = notifications.findByIdAndRecipientId(id, user.getId())
                .orElseThrow(() -> new NotFoundException("Notification " + id + " not found"));
        if (notification.getReadAt() == null) {
            notification.setReadAt(LocalDateTime.now());
        }
    }

    public void markAllRead(User user) {
        notifications.markAllRead(user.getId(), LocalDateTime.now());
    }

    /** The task's assignee changed from {@code previousAssigneeId}: tells the new one, unless they did it. */
    public void taskAssigned(User actor, Task task, Long previousAssigneeId) {
        User assignee = task.getAssignee();
        if (assignee != null && !Objects.equals(assignee.getId(), previousAssigneeId)) {
            send(actor, List.of(assignee), NotificationType.TASK_ASSIGNED, task.getId(), null, task.getTitle());
        }
    }

    /** Tells everyone involved in the task (its owner, assignee and watchers) but the author. */
    public void taskCommented(User author, Task task) {
        Map<Long, User> involved = new LinkedHashMap<>();
        involved.put(task.getOwner().getId(), task.getOwner());
        if (task.getAssignee() != null) {
            involved.put(task.getAssignee().getId(), task.getAssignee());
        }
        task.getWatchers().forEach(w -> involved.put(w.getId(), w));
        send(author, involved.values(), NotificationType.TASK_COMMENTED, task.getId(), null, task.getTitle());
    }

    /**
     * Tells the registered users among the given participant emails that they are invited to the meeting
     * ({@link NotificationType#MEETING_INVITED}) or that it was rescheduled ({@link NotificationType#MEETING_RESCHEDULED}).
     */
    public void meetingChanged(User organizer, Meeting meeting, Collection<String> participants, NotificationType type) {
        List<String> emails = participants.stream().filter(p -> p.contains("@")).distinct().toList();
        if (!emails.isEmpty()) {
            send(organizer, users.findByEmailIn(emails), type, null, meeting.getId(), meeting.getTitle());
        }
    }

    private void send(User actor, Collection<User> recipients, NotificationType type, Long taskId, Long meetingId,
                      String subject) {
        List<Notification> batch = recipients.stream()
                .filter(r -> !Objects.equals(r.getId(), actor.getId()))
                .map(r -> {
                    Notification n = new Notification();
                    n.setRecipient(users.getReferenceById(r.getId()));
                    n.setActor(users.getReferenceById(actor.getId()));
                    n.setType(type);
                    n.setTaskId(taskId);
                    n.setMeetingId(meetingId);
                    n.setSubject(subject);
                    return n;
                })
                .toList();
        if (!batch.isEmpty()) {
            notifications.saveAll(batch);
        }
    }
}
