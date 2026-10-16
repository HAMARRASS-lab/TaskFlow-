package com.taskflow.comment;

import com.taskflow.comment.CommentDtos.CommentRequest;
import com.taskflow.comment.CommentDtos.CommentResponse;
import com.taskflow.common.ForbiddenException;
import com.taskflow.common.NotFoundException;
import com.taskflow.notification.NotificationService;
import com.taskflow.task.Task;
import com.taskflow.task.TaskRepository;
import com.taskflow.user.Role;
import com.taskflow.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TaskCommentServiceTest {

    @Mock
    private TaskCommentRepository comments;

    @Mock
    private TaskRepository tasks;

    @Mock
    private NotificationService notifications;

    @InjectMocks
    private TaskCommentService service;

    private User owner;
    private User author;
    private User other;
    private Task task;

    @BeforeEach
    void setUp() {
        owner = user(1L, "Olivia Owner");
        author = user(2L, "Adam Author");
        other = user(3L, "Oscar Other");
        task = new Task();
        task.setId(10L);
        task.setTitle("Ship it");
        task.setOwner(owner);
    }

    @Test
    void createTrimsBodyAndSetsAuthorAndTask() {
        when(tasks.findById(10L)).thenReturn(Optional.of(task));
        when(comments.save(any(TaskComment.class))).thenAnswer(inv -> {
            TaskComment c = inv.getArgument(0);
            c.setId(5L);
            return c;
        });

        CommentResponse created = service.create(author, 10L, new CommentRequest("  Looks good \n"));

        assertThat(created.id()).isEqualTo(5L);
        assertThat(created.body()).isEqualTo("Looks good");
        assertThat(created.author().fullName()).isEqualTo("Adam Author");
        assertThat(created.canDelete()).isTrue();
        verify(comments).save(argThat(c -> c.getTask() == task && c.getAuthor() == author));
        verify(notifications).taskCommented(author, task);
    }

    @Test
    void createOnUnknownTaskThrowsNotFound() {
        when(tasks.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.create(author, 99L, new CommentRequest("Hi")))
                .isInstanceOf(NotFoundException.class);
        verify(comments, never()).save(any());
        verifyNoInteractions(notifications);
    }

    @Test
    void findAllFlagsWhichCommentsTheViewerCanDelete() {
        when(tasks.findById(10L)).thenReturn(Optional.of(task));
        when(comments.findByTaskIdOrderByCreatedAtAscIdAsc(10L))
                .thenReturn(List.of(comment(1L, author), comment(2L, other)));

        List<CommentResponse> asAuthor = service.findAll(author, 10L);
        assertThat(asAuthor).extracting(CommentResponse::canDelete).containsExactly(true, false);

        // the task owner can moderate every comment on their task
        assertThat(service.findAll(owner, 10L)).extracting(CommentResponse::canDelete).containsExactly(true, true);
    }

    @Test
    void authorTaskOwnerAndAdminCanDelete() {
        User admin = user(4L, "Root");
        admin.setRole(Role.ADMIN);
        for (User allowed : List.of(author, owner, admin)) {
            TaskComment c = comment(1L, author);
            when(comments.findByIdAndTaskId(1L, 10L)).thenReturn(Optional.of(c));
            service.delete(allowed, 10L, 1L);
            verify(comments).delete(c);
        }
    }

    @Test
    void otherUsersCannotDelete() {
        when(comments.findByIdAndTaskId(1L, 10L)).thenReturn(Optional.of(comment(1L, author)));

        assertThatThrownBy(() -> service.delete(other, 10L, 1L)).isInstanceOf(ForbiddenException.class);
        verify(comments, never()).delete(any());
    }

    @Test
    void deletingACommentOfAnotherTaskThrowsNotFound() {
        when(comments.findByIdAndTaskId(1L, 11L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.delete(author, 11L, 1L)).isInstanceOf(NotFoundException.class);
    }

    private TaskComment comment(Long id, User by) {
        TaskComment c = new TaskComment();
        c.setId(id);
        c.setTask(task);
        c.setAuthor(by);
        c.setBody("Comment " + id);
        return c;
    }

    private static User user(Long id, String name) {
        User u = new User(name.toLowerCase().replace(' ', '.') + "@test.com", "hash", name);
        u.setId(id);
        return u;
    }
}
