package com.taskflow.activity;

import com.taskflow.activity.TaskActivityService.Snapshot;
import com.taskflow.common.NotFoundException;
import com.taskflow.task.Task;
import com.taskflow.task.TaskPriority;
import com.taskflow.task.TaskRepository;
import com.taskflow.task.TaskStatus;
import com.taskflow.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TaskActivityServiceTest {

    @Mock
    private TaskEventRepository events;

    @Mock
    private TaskRepository tasks;

    @InjectMocks
    private TaskActivityService service;

    @Captor
    private ArgumentCaptor<List<TaskEvent>> saved;

    private User alice;
    private User bob;
    private Task task;

    @BeforeEach
    void setUp() {
        alice = user(1L, "Alice");
        bob = user(2L, "Bob");
        task = new Task();
        task.setId(10L);
        task.setTitle("Ship it");
        task.setOwner(alice);
    }

    private static User user(Long id, String name) {
        User user = new User(name.toLowerCase() + "@test.com", "hash", name);
        user.setId(id);
        return user;
    }

    @Test
    void recordsOneEventPerChangedFieldWithOldAndNewValues() {
        task.setDueDate(LocalDate.of(2026, 11, 1));
        Snapshot before = Snapshot.of(task);
        task.setStatus(TaskStatus.IN_PROGRESS);
        task.setPriority(TaskPriority.HIGH);
        task.setAssignee(bob);
        task.setDueDate(null);

        service.changed(alice, task, before);

        verify(events).saveAll(saved.capture());
        assertThat(saved.getValue())
                .extracting(TaskEvent::getType, TaskEvent::getOldValue, TaskEvent::getNewValue, TaskEvent::getActor)
                .containsExactly(
                        tuple(TaskEventType.STATUS, "TODO", "IN_PROGRESS", alice),
                        tuple(TaskEventType.PRIORITY, "MEDIUM", "HIGH", alice),
                        tuple(TaskEventType.ASSIGNEE, null, "Bob", alice),
                        tuple(TaskEventType.DUE_DATE, "2026-11-01", null, alice));
    }

    @Test
    void untrackedOrUnchangedFieldsRecordNothing() {
        task.setAssignee(bob);
        Snapshot before = Snapshot.of(task);
        task.setTitle("Ship it today");
        task.setAssignee(user(2L, "Bob")); // same user, another instance

        service.changed(alice, task, before);

        verify(events, never()).saveAll(any());
    }

    @Test
    void historyOfAnUnknownTaskIs404() {
        when(tasks.existsById(99L)).thenReturn(false);

        assertThatThrownBy(() -> service.findAll(99L)).isInstanceOf(NotFoundException.class);
    }
}
