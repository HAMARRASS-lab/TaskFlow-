package com.taskflow.notification;

import com.taskflow.common.NotFoundException;
import com.taskflow.meeting.Meeting;
import com.taskflow.task.Task;
import com.taskflow.user.User;
import com.taskflow.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock
    private NotificationRepository repository;

    @Mock
    private UserRepository users;

    @InjectMocks
    private NotificationService service;

    private User alice;
    private User bob;
    private User carol;
    private Task task;

    @BeforeEach
    void setUp() {
        alice = user(1L, "Alice");
        bob = user(2L, "Bob");
        carol = user(3L, "Carol");
        task = new Task();
        task.setId(10L);
        task.setTitle("Ship it");
        task.setOwner(alice);
        lenient().when(users.getReferenceById(any())).thenAnswer(inv -> user(inv.getArgument(0), "ref"));
    }

    private static User user(Long id, String name) {
        User user = new User(name.toLowerCase() + "@test.com", "hash", name);
        user.setId(id);
        return user;
    }

    @SuppressWarnings("unchecked")
    private List<Notification> saved() {
        ArgumentCaptor<List<Notification>> captor = ArgumentCaptor.forClass(List.class);
        verify(repository, atLeastOnce()).saveAll(captor.capture());
        return captor.getAllValues().stream().flatMap(List::stream).toList();
    }

    @Test
    void assigningATaskNotifiesTheNewAssignee() {
        task.setAssignee(bob);

        service.taskAssigned(alice, task, null);

        Notification n = saved().get(0);
        assertThat(n.getRecipient().getId()).isEqualTo(2L);
        assertThat(n.getActor().getId()).isEqualTo(1L);
        assertThat(n.getType()).isEqualTo(NotificationType.TASK_ASSIGNED);
        assertThat(n.getTaskId()).isEqualTo(10L);
        assertThat(n.getSubject()).isEqualTo("Ship it");
    }

    @Test
    void noAssignmentNotificationWhenUnchangedUnassignedOrSelfAssigned() {
        task.setAssignee(bob);
        service.taskAssigned(alice, task, 2L);
        service.taskAssigned(bob, task, null);
        task.setAssignee(null);
        service.taskAssigned(alice, task, 2L);

        verifyNoInteractions(repository);
    }

    @Test
    void commentNotifiesOwnerAssigneeAndWatchersOnceButNotTheAuthor() {
        task.setAssignee(bob);
        task.getWatchers().add(bob);
        task.getWatchers().add(carol);

        service.taskCommented(bob, task, List.of());

        assertThat(saved()).extracting(n -> n.getRecipient().getId()).containsExactlyInAnyOrder(1L, 3L);
    }

    @Test
    void mentionedUsersAreToldTheyWereMentionedInsteadOfCommentedOn() {
        User dave = user(4L, "Dave");
        task.getWatchers().add(carol);

        // Carol watches and is mentioned, Dave is only mentioned, Bob mentions himself
        service.taskCommented(bob, task, List.of(carol, dave, bob));

        assertThat(saved()).extracting(n -> n.getRecipient().getId(), Notification::getType).containsExactlyInAnyOrder(
                tuple(3L, NotificationType.TASK_MENTIONED),
                tuple(4L, NotificationType.TASK_MENTIONED),
                tuple(1L, NotificationType.TASK_COMMENTED));
    }

    @Test
    void meetingNotifiesOnlyRegisteredParticipants() {
        Meeting meeting = new Meeting();
        meeting.setId(4L);
        meeting.setTitle("Daily");
        when(users.findByEmailIn(List.of("bob@test.com", "ghost@test.com"))).thenReturn(List.of(bob));

        service.meetingChanged(alice, meeting, List.of("bob@test.com", "Carol", "ghost@test.com"),
                NotificationType.MEETING_INVITED);

        Notification n = saved().get(0);
        assertThat(n.getRecipient().getId()).isEqualTo(2L);
        assertThat(n.getMeetingId()).isEqualTo(4L);
        assertThat(n.getType()).isEqualTo(NotificationType.MEETING_INVITED);
    }

    @Test
    void cannotMarkSomeoneElsesNotificationRead() {
        when(repository.findByIdAndRecipientId(5L, 2L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.markRead(bob, 5L)).isInstanceOf(NotFoundException.class);
    }
}
