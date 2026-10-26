package com.taskflow.task;

import com.taskflow.activity.TaskActivityService;
import com.taskflow.common.BadRequestException;
import com.taskflow.common.ForbiddenException;
import com.taskflow.common.NotFoundException;
import com.taskflow.notification.NotificationService;
import com.taskflow.task.TaskDtos.ChecklistItemRequest;
import com.taskflow.task.TaskDtos.ChecklistItemResponse;
import com.taskflow.task.TaskDtos.TaskRequest;
import com.taskflow.task.TaskDtos.TaskResponse;
import com.taskflow.task.TaskDtos.TaskOwnerSummary;
import com.taskflow.task.TaskDtos.UserSummary;
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
import java.util.Set;

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

    @Mock
    private NotificationService notifications;

    @Mock
    private TaskActivityService activity;

    @InjectMocks
    private TaskService service;

    private User owner;
    private User bob;

    @BeforeEach
    void setUp() {
        owner = user(1L, "Alice");
        bob = user(2L, "Bob");
    }

    private static User user(Long id, String name) {
        User user = new User(name.toLowerCase() + "@test.com", "hash", name);
        user.setId(id);
        return user;
    }

    /** Another instance of the same user, as the authenticated principal is (users are compared by id). */
    private static User copyOf(User user) {
        return user(user.getId(), user.getFullName());
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
        when(repository.findById(5L)).thenReturn(Optional.of(task));
        when(repository.saveAndFlush(task)).thenReturn(task);

        TaskResponse updated = service.updateStatus(owner, 5L, TaskStatus.DONE);

        assertThat(updated.status()).isEqualTo(TaskStatus.DONE);
    }

    @Test
    void changesAreRecordedInTheActivityHistoryAgainstTheTaskAsItWasBefore() {
        Task task = new Task();
        task.setId(5L);
        task.setTitle("Deploy");
        task.setOwner(owner);
        when(repository.findById(5L)).thenReturn(Optional.of(task));
        when(repository.saveAndFlush(task)).thenReturn(task);

        service.updateStatus(owner, 5L, TaskStatus.DONE);

        verify(activity).changed(eq(owner), eq(task),
                argThat(before -> before.status() == TaskStatus.TODO && before.priority() == TaskPriority.MEDIUM));
    }

    @Test
    void throwsWhenTaskDoesNotExist() {
        when(repository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.delete(owner, 99L))
                .isInstanceOf(NotFoundException.class)
                .hasMessageContaining("99");
        verify(repository, never()).delete(any());
    }

    @Test
    void strangerCannotChangeOrDeleteATask() {
        Task task = taskWithChecklist();
        when(repository.findById(5L)).thenReturn(Optional.of(task));

        assertThatThrownBy(() -> service.updateStatus(bob, 5L, TaskStatus.DONE)).isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> service.update(bob, 5L, new TaskRequest("Hijack", null, null, null, null)))
                .isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> service.toggleChecklistItem(bob, 5L, 10L, true)).isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> service.delete(bob, 5L)).isInstanceOf(ForbiddenException.class);
        assertThat(task.getStatus()).isEqualTo(TaskStatus.TODO);
        verify(repository, never()).saveAndFlush(any());
        verify(repository, never()).delete(any());
    }

    @Test
    void assigneeCanWorkOnTheTaskButNotDeleteIt() {
        Task task = taskWithChecklist();
        task.setAssignee(copyOf(bob));
        when(repository.findById(5L)).thenReturn(Optional.of(task));
        when(repository.saveAndFlush(task)).thenReturn(task);

        assertThat(service.updateStatus(bob, 5L, TaskStatus.IN_PROGRESS).status()).isEqualTo(TaskStatus.IN_PROGRESS);
        assertThat(service.toggleChecklistItem(bob, 5L, 10L, true).checklist().get(0).done()).isTrue();
        assertThatThrownBy(() -> service.delete(bob, 5L)).isInstanceOf(ForbiddenException.class);
    }

    @Test
    void updateSetsAssigneeAndReplacesWatchers() {
        User carol = user(3L, "Carol");
        Task task = taskWithChecklist();
        task.getWatchers().add(copyOf(owner));
        when(repository.findById(5L)).thenReturn(Optional.of(task));
        when(repository.saveAndFlush(task)).thenReturn(task);
        when(users.findById(2L)).thenReturn(Optional.of(bob));
        when(users.findAllById(Set.of(3L, 2L))).thenReturn(List.of(carol, bob));

        TaskResponse updated = service.update(owner, 5L, new TaskRequest("Deploy", null, null, null, null, null, null,
                2L, List.of(3L, 2L, 3L)));

        assertThat(updated.assignee().fullName()).isEqualTo("Bob");
        assertThat(updated.owner().id()).isEqualTo(1L);
        assertThat(updated.watchers()).extracting(UserSummary::fullName).containsExactly("Bob", "Carol");
    }

    @Test
    void updateWithoutAssigneeUnassignsButKeepsWatchers() {
        Task task = taskWithChecklist();
        task.setAssignee(bob);
        task.getWatchers().add(bob);
        when(repository.findById(5L)).thenReturn(Optional.of(task));
        when(repository.saveAndFlush(task)).thenReturn(task);

        TaskResponse updated = service.update(owner, 5L, new TaskRequest("Deploy", null, null, null, null));

        assertThat(updated.assignee()).isNull();
        assertThat(updated.watchers()).hasSize(1);
    }

    @Test
    void rejectsUnknownAssigneeOrWatcher() {
        when(repository.findById(5L)).thenReturn(Optional.of(taskWithChecklist()));
        when(users.findById(42L)).thenReturn(Optional.empty());
        when(users.findAllById(any())).thenReturn(List.of());

        assertThatThrownBy(() -> service.update(owner, 5L,
                new TaskRequest("Deploy", null, null, null, null, null, null, 42L, null)))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.update(owner, 5L,
                new TaskRequest("Deploy", null, null, null, null, null, null, null, List.of(42L))))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void anyoneCanWatchAndUnwatchATaskOnce() {
        Task task = taskWithChecklist();
        when(repository.findById(5L)).thenReturn(Optional.of(task));
        when(repository.saveAndFlush(task)).thenReturn(task);
        when(users.getReferenceById(2L)).thenReturn(bob);

        service.setWatching(copyOf(bob), 5L, true);
        service.setWatching(copyOf(bob), 5L, true);
        assertThat(task.getWatchers()).extracting(User::getId).containsExactly(2L);

        service.setWatching(copyOf(bob), 5L, false);
        assertThat(task.getWatchers()).isEmpty();
    }

    @Test
    void findAllReturnsTheBoardFilteredByStatus() {
        Task todo = taskWithChecklist();
        Task done = taskWithChecklist();
        done.setId(6L);
        done.setStatus(TaskStatus.DONE);
        when(repository.findOnBoardOf(1L)).thenReturn(List.of(todo, done));

        assertThat(service.findAll(owner, null)).hasSize(2);
        assertThat(service.findAll(owner, TaskStatus.DONE)).extracting(TaskResponse::id).containsExactly(6L);
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
    void findOwnersAlsoCountsTasksAssignedToSomeone() {
        when(repository.countByOwnerAndStatus()).thenReturn(List.of(row(1L, "Alice", TaskStatus.TODO, 2)));
        when(repository.countByAssigneeAndStatus()).thenReturn(List.of(
                row(1L, "Alice", TaskStatus.TODO, 1),
                row(2L, "zoe", TaskStatus.IN_PROGRESS, 3)));

        List<TaskOwnerSummary> owners = service.findOwners();

        assertThat(owners).extracting(TaskOwnerSummary::fullName).containsExactly("Alice", "zoe");
        assertThat(owners.get(0).todo()).isEqualTo(3);
        assertThat(owners.get(1)).isEqualTo(new TaskOwnerSummary(2L, "zoe", "zoe@test.com", 0, 3, 0));
    }

    @Test
    void findByOwnerThrowsForUnknownUser() {
        when(users.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.findByOwner(99L, null)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void transferOwnershipMovesTaskToAnotherUser() {
        User bob = new User("bob@test.com", "hash", "Bob");
        bob.setId(2L);
        Task task = new Task();
        task.setId(7L);
        task.setTitle("Review");
        task.setOwner(owner);
        when(repository.findById(7L)).thenReturn(Optional.of(task));
        when(users.findById(2L)).thenReturn(Optional.of(bob));
        when(repository.saveAndFlush(task)).thenReturn(task);

        service.transferOwnership(7L, 2L);

        assertThat(task.getOwner()).isSameAs(bob);
    }

    @Test
    void adminAssignsAnyTaskToAnyUserAndUnassignsIt() {
        Task task = taskWithChecklist();
        when(repository.findById(5L)).thenReturn(Optional.of(task));
        when(repository.saveAndFlush(task)).thenReturn(task);
        when(users.findById(2L)).thenReturn(Optional.of(bob));

        User admin = user(9L, "Admin");

        assertThat(service.assign(admin, 5L, 2L).assignee().fullName()).isEqualTo("Bob");
        verify(notifications).taskAssigned(admin, task, null);
        assertThat(task.getOwner()).isSameAs(owner);
        assertThat(service.assign(admin, 5L, null).assignee()).isNull();
        verify(notifications).taskAssigned(admin, task, 2L);
    }

    @Test
    void adminCannotAssignToAnUnknownUser() {
        when(repository.findById(5L)).thenReturn(Optional.of(taskWithChecklist()));
        when(users.findById(42L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.assign(owner, 5L, 42L)).isInstanceOf(BadRequestException.class);
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void createForAssignsTaskToTheGivenUser() {
        when(users.findById(1L)).thenReturn(Optional.of(owner));
        when(repository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        User admin = user(9L, "Admin");

        service.createFor(admin, 1L, new TaskRequest("Onboard", null, null, null, null));

        verify(repository).save(argThat(t -> t.getOwner() == owner && t.getTitle().equals("Onboard")));
        verify(notifications).taskAssigned(eq(admin), argThat(t -> t.getOwner() == owner), isNull());
    }

    @Test
    void normalizesLabels() {
        assertThat(TaskService.normalizeLabel("  Front   End ")).isEqualTo("front end");
    }

    @Test
    void createStoresDistinctLabelsAndOrderedChecklist() {
        when(repository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        TaskResponse created = service.create(owner, new TaskRequest("Release", null, null, null, null,
                List.of("Bug", "bug ", "ui"),
                List.of(new ChecklistItemRequest(null, " Tag ", false), new ChecklistItemRequest(null, "Notes", true))));

        assertThat(created.labels()).containsExactly("bug", "ui");
        assertThat(created.checklist()).extracting(ChecklistItemResponse::title).containsExactly("Tag", "Notes");
        assertThat(created.checklist()).extracting(ChecklistItemResponse::done).containsExactly(false, true);
    }

    @Test
    void updateWithoutLabelsOrChecklistKeepsThem() {
        Task task = taskWithChecklist();
        task.getLabels().add("bug");
        when(repository.findById(5L)).thenReturn(Optional.of(task));
        when(repository.saveAndFlush(task)).thenReturn(task);

        TaskResponse updated = service.update(owner, 5L, new TaskRequest("Renamed", null, null, null, null));

        assertThat(updated.title()).isEqualTo("Renamed");
        assertThat(updated.labels()).containsExactly("bug");
        assertThat(updated.checklist()).hasSize(2);
    }

    @Test
    void updateReplacesChecklistKeepingKnownItems() {
        Task task = taskWithChecklist();
        ChecklistItem kept = task.getChecklist().get(1);
        when(repository.findById(5L)).thenReturn(Optional.of(task));
        when(repository.saveAndFlush(task)).thenReturn(task);

        service.update(owner, 5L, new TaskRequest("Deploy", null, null, null, null, null,
                List.of(new ChecklistItemRequest(11L, "Second, renamed", true), new ChecklistItemRequest(null, "New", false))));

        assertThat(task.getChecklist()).hasSize(2);
        assertThat(task.getChecklist().get(0)).isSameAs(kept);
        assertThat(kept.getTitle()).isEqualTo("Second, renamed");
        assertThat(kept.isDone()).isTrue();
        assertThat(kept.getPosition()).isZero();
        assertThat(task.getChecklist().get(1).getTask()).isSameAs(task);
        assertThat(task.getChecklist().get(1).getPosition()).isEqualTo(1);
    }

    @Test
    void toggleChecklistItemMarksItDone() {
        Task task = taskWithChecklist();
        when(repository.findById(5L)).thenReturn(Optional.of(task));
        when(repository.saveAndFlush(task)).thenReturn(task);

        TaskResponse updated = service.toggleChecklistItem(owner, 5L, 10L, true);

        assertThat(updated.checklist().get(0).done()).isTrue();
    }

    @Test
    void toggleUnknownChecklistItemThrows() {
        when(repository.findById(5L)).thenReturn(Optional.of(taskWithChecklist()));

        assertThatThrownBy(() -> service.toggleChecklistItem(owner, 5L, 99L, true))
                .isInstanceOf(NotFoundException.class);
        verify(repository, never()).saveAndFlush(any());
    }

    private Task taskWithChecklist() {
        Task task = new Task();
        task.setId(5L);
        task.setTitle("Deploy");
        task.setOwner(owner);
        for (long id = 10; id <= 11; id++) {
            ChecklistItem item = new ChecklistItem();
            item.setId(id);
            item.setTask(task);
            item.setTitle("Item " + id);
            item.setPosition((int) id - 10);
            task.getChecklist().add(item);
        }
        return task;
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
