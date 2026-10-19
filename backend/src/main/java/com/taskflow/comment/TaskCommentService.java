package com.taskflow.comment;

import com.taskflow.comment.CommentDtos.AuthorResponse;
import com.taskflow.comment.CommentDtos.CommentRequest;
import com.taskflow.comment.CommentDtos.CommentResponse;
import com.taskflow.common.ForbiddenException;
import com.taskflow.common.NotFoundException;
import com.taskflow.notification.NotificationService;
import com.taskflow.task.Task;
import com.taskflow.task.TaskRepository;
import com.taskflow.user.Role;
import com.taskflow.user.User;
import com.taskflow.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Objects;

/**
 * Every task has a comment thread. Like the tasks themselves (see the Team page), threads are visible to all
 * users and anyone can post; a comment can be deleted by its author, the task's owner or an admin.
 */
@Service
@Transactional
public class TaskCommentService {

    private final TaskCommentRepository comments;
    private final TaskRepository tasks;
    private final UserRepository users;
    private final NotificationService notifications;

    public TaskCommentService(TaskCommentRepository comments, TaskRepository tasks, UserRepository users,
                              NotificationService notifications) {
        this.comments = comments;
        this.tasks = tasks;
        this.users = users;
        this.notifications = notifications;
    }

    @Transactional(readOnly = true)
    public List<CommentResponse> findAll(User user, Long taskId) {
        Task task = loadTask(taskId);
        return comments.findByTaskIdOrderByCreatedAtAscIdAsc(task.getId()).stream()
                .map(c -> toResponse(user, c))
                .toList();
    }

    public CommentResponse create(User author, Long taskId, CommentRequest request) {
        TaskComment comment = new TaskComment();
        comment.setTask(loadTask(taskId));
        comment.setAuthor(author);
        comment.setBody(request.body().strip());
        TaskComment saved = comments.save(comment);
        notifications.taskCommented(author, saved.getTask(), mentioned(saved.getBody(), request.mentionedUserIds()));
        return toResponse(author, saved);
    }

    public void delete(User user, Long taskId, Long commentId) {
        TaskComment comment = comments.findByIdAndTaskId(commentId, taskId)
                .orElseThrow(() -> new NotFoundException("Comment " + commentId + " not found"));
        if (!canDelete(user, comment)) {
            throw new ForbiddenException("Only the author, the task owner or an admin can delete this comment");
        }
        comments.delete(comment);
    }

    /**
     * The users picked in the "@" autocomplete whose "@Full Name" is still in the body (it may have been edited since).
     * Names are not unique, so who was meant comes from the ids, not from the text. Unknown ids are ignored.
     */
    private List<User> mentioned(String body, List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        String text = body.toLowerCase(Locale.ROOT);
        return users.findAllById(ids.stream().filter(Objects::nonNull).distinct().toList()).stream()
                .filter(u -> text.contains("@" + u.getFullName().toLowerCase(Locale.ROOT)))
                .toList();
    }

    private Task loadTask(Long id) {
        return tasks.findById(id).orElseThrow(() -> new NotFoundException("Task " + id + " not found"));
    }

    private static boolean canDelete(User user, TaskComment comment) {
        return user.getRole() == Role.ADMIN
                || Objects.equals(comment.getAuthor().getId(), user.getId())
                || Objects.equals(comment.getTask().getOwner().getId(), user.getId());
    }

    private static CommentResponse toResponse(User user, TaskComment c) {
        return new CommentResponse(c.getId(), c.getBody(),
                new AuthorResponse(c.getAuthor().getId(), c.getAuthor().getFullName()),
                c.getCreatedAt(), canDelete(user, c));
    }
}
