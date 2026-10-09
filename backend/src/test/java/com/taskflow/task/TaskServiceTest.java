package com.taskflow.task;

import com.taskflow.common.NotFoundException;
import com.taskflow.task.TaskDtos.TaskRequest;
import com.taskflow.task.TaskDtos.TaskResponse;
import com.taskflow.task.TaskDtos.TaskOwnerSummary;
import com.taskflow.task.TaskRepository.OwnerStatusCount;
import com.taskflow.user.User;
import com.taskflow.user.UserRepository;
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
class TaskServiceTest {

    @Mock
    private TaskRepository repository;

    @Mock
    private UserRepository users;

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

    @Test
    void findOwnersMergesStatusCountsPerUserSortedByName() {
        when(repository.countByOwnerAndStatus()).thenReturn(List.of(
                row(2L, "zoe", TaskStatus.DONE, 3),
                row(1L, "Alice", TaskStatus.TODO, 2),
                row(2L, "zoe", TaskStatus.TODO, 1),
                row(1L, "Alice", TaskStatus.IN_PROGRESS, 1)));

        List<TaskOwnerSummary> owners = service.findOwners();

        assertThat(owners).extracting(TaskOwnerSummary::fullName).containsExactly("Alice", "zoe");
        assertThat(owners.get(0)).isEqualTo(new TaskOwnerSummary(1L, "Alice", "alice@test.com", 2, 1, 0));
        assertThat(owners.get(1).total()).isEqualTo(4);
    }

    @Test
    void findByOwnerThrowsForUnknownUser() {
        when(users.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.findByOwner(99L, null)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void reassignMovesTaskToAnotherUser() {
        User bob = new User("bob@test.com", "hash", "Bob");
        bob.setId(2L);
        Task task = new Task();
        task.setId(7L);
        task.setTitle("Review");
        task.setOwner(owner);
        when(repository.findById(7L)).thenReturn(Optional.of(task));
        when(users.findById(2L)).thenReturn(Optional.of(bob));
        when(repository.saveAndFlush(task)).thenReturn(task);

        service.reassign(7L, 2L);

        assertThat(task.getOwner()).isSameAs(bob);
    }

    @Test
    void createForAssignsTaskToTheGivenUser() {
        when(users.findById(1L)).thenReturn(Optional.of(owner));
        when(repository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        service.createFor(1L, new TaskRequest("Onboard", null, null, null, null));

        verify(repository).save(argThat(t -> t.getOwner() == owner && t.getTitle().equals("Onboard")));
    }

    private static OwnerStatusCount row(Long id, String name, TaskStatus status, long count) {
        return new OwnerStatusCount() {
            public Long getOwnerId() { return id; }
            public String getFullName() { return name; }
            public String getEmail() { return id == 1L ? "alice@test.com" : "zoe@test.com"; }
            public TaskStatus getStatus() { return status; }
            public long getCount() { return count; }
        };
    }
}
