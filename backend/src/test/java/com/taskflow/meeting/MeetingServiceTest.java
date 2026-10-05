package com.taskflow.meeting;

import com.taskflow.common.BadRequestException;
import com.taskflow.common.ConflictException;
import com.taskflow.common.ForbiddenException;
import com.taskflow.common.NotFoundException;
import com.taskflow.meeting.MeetingDtos.MeetingRequest;
import com.taskflow.meeting.MeetingDtos.MeetingResponse;
import com.taskflow.meeting.MeetingDtos.ParticipantResponse;
import com.taskflow.user.User;
import com.taskflow.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MeetingServiceTest {

    private static final LocalDateTime NINE = LocalDateTime.of(2026, 10, 6, 9, 0);
    private static final LocalDateTime TEN = NINE.plusHours(1);
    private static final ParticipantStatus ACCEPTED = ParticipantStatus.ACCEPTED;

    @Mock
    private MeetingRepository repository;

    @Mock
    private UserRepository users;

    @InjectMocks
    private MeetingService service;

    private User alice;
    private User bob;

    @BeforeEach
    void setUp() {
        alice = new User("alice@test.com", "hash", "Alice");
        alice.setId(1L);
        bob = new User("bob@test.com", "hash", "Bob");
        bob.setId(2L);
    }

    private Meeting meeting(long id, User owner, MeetingParticipant... participants) {
        Meeting m = new Meeting();
        m.setId(id);
        m.setTitle("Daily");
        m.setOwner(owner);
        m.setStartAt(NINE);
        m.setEndAt(TEN);
        m.setParticipants(List.of(participants));
        return m;
    }

    @Test
    void createNormalizesParticipantsAndResolvesRegisteredUsers() {
        when(repository.findBusy(1L, "alice@test.com", NINE, TEN, ACCEPTED)).thenReturn(List.of());
        when(repository.save(any(Meeting.class))).thenAnswer(inv -> {
            Meeting m = inv.getArgument(0);
            m.setId(7L);
            return m;
        });
        when(users.findByEmailIn(List.of("bob@test.com"))).thenReturn(List.of(bob));

        MeetingResponse created = service.create(alice, new MeetingRequest(" Sprint review ", null, " ",
                NINE, TEN, List.of("Bob@Test.com", " bob@test.com ", "Carol", "ALICE@test.com")));

        assertThat(created.title()).isEqualTo("Sprint review");
        assertThat(created.location()).isNull();
        assertThat(created.organizedByMe()).isTrue();
        assertThat(created.myStatus()).isNull();
        // emails lower-cased and deduplicated, organizer removed from participants
        assertThat(created.participants()).containsExactly(
                new ParticipantResponse("bob@test.com", "Bob", ParticipantStatus.PENDING),
                new ParticipantResponse("Carol", null, ParticipantStatus.PENDING));
    }

    @Test
    void rejectsMeetingEndingBeforeItStarts() {
        assertThatThrownBy(() -> service.create(alice, new MeetingRequest("Bad", null, null, TEN, NINE, null)))
                .isInstanceOf(BadRequestException.class);
        verify(repository, never()).save(any());
    }

    @Test
    void rejectsOverlapWithOrganizerAgenda() {
        when(repository.findBusy(1L, "alice@test.com", NINE, TEN, ACCEPTED)).thenReturn(List.of(meeting(3, alice)));

        assertThatThrownBy(() -> service.create(alice, new MeetingRequest("Other", null, null, NINE, TEN, null)))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("Daily");
    }

    @Test
    void updateKeepsAnswersUnlessRescheduled() {
        Meeting m = meeting(3, alice, new MeetingParticipant("bob@test.com", ACCEPTED));
        when(repository.findVisibleById(3L, 1L, "alice@test.com")).thenReturn(Optional.of(m));
        when(repository.findBusy(eq(1L), eq("alice@test.com"), any(), any(), eq(ACCEPTED))).thenReturn(List.of(m));
        when(repository.saveAndFlush(m)).thenReturn(m);
        when(users.findByEmailIn(anyList())).thenReturn(List.of(bob));

        MeetingResponse renamed = service.update(alice, 3L,
                new MeetingRequest("Daily stand-up", null, null, NINE, TEN, List.of("bob@test.com")));
        assertThat(renamed.participants().get(0).status()).isEqualTo(ACCEPTED);

        MeetingResponse moved = service.update(alice, 3L,
                new MeetingRequest("Daily stand-up", null, null, NINE, TEN.plusMinutes(30), List.of("bob@test.com")));
        assertThat(moved.participants().get(0).status()).isEqualTo(ParticipantStatus.PENDING);
    }

    @Test
    void inviteeCannotModifyMeeting() {
        Meeting m = meeting(3, alice, new MeetingParticipant("bob@test.com", ParticipantStatus.PENDING));
        when(repository.findVisibleById(3L, 2L, "bob@test.com")).thenReturn(Optional.of(m));

        assertThatThrownBy(() -> service.delete(bob, 3L)).isInstanceOf(ForbiddenException.class);
        verify(repository, never()).delete(any());
    }

    @Test
    void inviteeAcceptsWhenAvailable() {
        Meeting m = meeting(3, alice, new MeetingParticipant("bob@test.com", ParticipantStatus.PENDING));
        when(repository.findVisibleById(3L, 2L, "bob@test.com")).thenReturn(Optional.of(m));
        when(repository.findBusy(2L, "bob@test.com", NINE, TEN, ACCEPTED)).thenReturn(List.of());
        when(repository.saveAndFlush(m)).thenReturn(m);
        when(users.findByEmailIn(anyList())).thenReturn(List.of(bob));

        MeetingResponse answered = service.respond(bob, 3L, ACCEPTED);

        assertThat(answered.myStatus()).isEqualTo(ACCEPTED);
        assertThat(answered.organizedByMe()).isFalse();
        assertThat(answered.organizer().fullName()).isEqualTo("Alice");
    }

    @Test
    void inviteeCannotAcceptWhenBusy() {
        Meeting m = meeting(3, alice, new MeetingParticipant("bob@test.com", ParticipantStatus.PENDING));
        Meeting other = meeting(4, bob);
        other.setTitle("Dentist");
        when(repository.findVisibleById(3L, 2L, "bob@test.com")).thenReturn(Optional.of(m));
        when(repository.findBusy(2L, "bob@test.com", NINE, TEN, ACCEPTED)).thenReturn(List.of(other));

        assertThatThrownBy(() -> service.respond(bob, 3L, ACCEPTED))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("Dentist");
    }

    @Test
    void organizerCannotAnswerOwnMeeting() {
        when(repository.findVisibleById(3L, 1L, "alice@test.com")).thenReturn(Optional.of(meeting(3, alice)));

        assertThatThrownBy(() -> service.respond(alice, 3L, ParticipantStatus.DECLINED))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void throwsWhenMeetingIsNotVisible() {
        when(repository.findVisibleById(99L, 1L, "alice@test.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.findOne(alice, 99L)).isInstanceOf(NotFoundException.class);
    }
}
