package com.taskflow.notification;

import com.taskflow.notification.NotificationDtos.NotificationResponse;
import com.taskflow.notification.NotificationDtos.UnreadCountResponse;
import com.taskflow.user.User;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** The current user's notifications. */
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    /** The latest notifications, newest first (read ones included). */
    @GetMapping
    public List<NotificationResponse> list(@AuthenticationPrincipal User user,
                                           @RequestParam(defaultValue = "30") int limit) {
        return notificationService.findRecent(user, limit);
    }

    @GetMapping("/unread-count")
    public UnreadCountResponse unreadCount(@AuthenticationPrincipal User user) {
        return new UnreadCountResponse(notificationService.countUnread(user));
    }

    @PostMapping("/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markRead(@AuthenticationPrincipal User user, @PathVariable Long id) {
        notificationService.markRead(user, id);
    }

    @PostMapping("/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markAllRead(@AuthenticationPrincipal User user) {
        notificationService.markAllRead(user);
    }
}
