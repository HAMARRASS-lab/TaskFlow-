package com.taskflow.comment;

import com.taskflow.comment.CommentDtos.CommentRequest;
import com.taskflow.comment.CommentDtos.CommentResponse;
import com.taskflow.user.User;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tasks/{taskId}/comments")
public class TaskCommentController {

    private final TaskCommentService commentService;

    public TaskCommentController(TaskCommentService commentService) {
        this.commentService = commentService;
    }

    @GetMapping
    public List<CommentResponse> list(@AuthenticationPrincipal User user, @PathVariable Long taskId) {
        return commentService.findAll(user, taskId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CommentResponse create(@AuthenticationPrincipal User user, @PathVariable Long taskId,
                                  @Valid @RequestBody CommentRequest request) {
        return commentService.create(user, taskId, request);
    }

    @DeleteMapping("/{commentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal User user, @PathVariable Long taskId, @PathVariable Long commentId) {
        commentService.delete(user, taskId, commentId);
    }
}
