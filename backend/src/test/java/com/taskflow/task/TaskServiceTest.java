package com.taskflow.task;

import com.taskflow.common.NotFoundException;
import com.taskflow.task.TaskDtos.TaskRequest;
import com.taskflow.task.TaskDtos.TaskResponse;
import com.taskflow.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TaskServiceTest {

    @Mock
    private TaskRepository repository;

    @InjectMocks
    private TaskService service;

    private User owner;

    @BeforeEach
    void setUp() {
        owner = new User("alice@test.com", "hash", "Alice");
        owner.setId(1L);
    }

    @Test
    void createAppliesDefaultsAndOwner() {
        when(repository.save(any(Task.class))).thenAnswer(inv -> {
            Task t = inv.getArgument(0);
            t.setId(42L);
            return t;
        });

        TaskResponse created = service.create(owner, new TaskRequest("  Write tests ", null, null, null, null));

        assertThat(created.id()).isEqualTo(42L);
        assertThat(created.title()).isEqualTo("Write tests");
        assertThat(created.status()).isEqualTo(TaskStatus.TODO);
        assertThat(created.priority()).isEqualTo(TaskPriority.MEDIUM);
        verify(repository).save(argThat(t -> t.getOwner() == owner));
    }

    @Test
    void updateStatusChangesStatus() {
        Task task = new Task();
        task.setId(5L);
        task.setTitle("Deploy");
        task.setOwner(owner);
        when(repository.findByIdAndOwnerId(5L, 1L)).thenReturn(Optional.of(task));
        when(repository.saveAndFlush(task)).thenReturn(task);

        TaskResponse updated = service.updateStatus(owner, 5L, TaskStatus.DONE);

        assertThat(updated.status()).isEqualTo(TaskStatus.DONE);
    }

    @Test
    void throwsWhenTaskBelongsToAnotherUser() {
        when(repository.findByIdAndOwnerId(99L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.delete(owner, 99L))
                .isInstanceOf(NotFoundException.class)
                .hasMessageContaining("99");
        verify(repository, never()).delete(any());
    }
}
