package com.taskflow.meeting;

import com.taskflow.common.BadRequestException;
import com.taskflow.common.ConflictException;
import com.taskflow.common.ForbiddenException;
import com.taskflow.common.NotFoundException;
import com.taskflow.meeting.MeetingDtos.MeetingRequest;
import com.taskflow.meeting.MeetingDtos.MeetingResponse;
import com.taskflow.meeting.MeetingDtos.OrganizerResponse;
import com.taskflow.meeting.MeetingDtos.ParticipantResponse;
import com.taskflow.user.User;
import com.taskflow.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Meetings are shared with participants whose email matches a registered user: they see the meeting
 * in their calendar and can accept or decline it. Only the organizer can edit or delete it.
 */
@Service
@Transactional
public class MeetingService {

    private final MeetingRepository meetings;
    private final UserRepository users;

    public MeetingService(MeetingRepository meetings, UserRepository users) {
        this.meetings = meetings;
        this.users = users;
    }

    @Transactional(readOnly = true)
    public List<MeetingResponse> findAll(User user, LocalDateTime from, LocalDateTime to) {
        List<Meeting> result;
        if (from != null && to != null) {
            if (!to.isAfter(from)) {
                throw new BadRequestException("'to' must be after 'from'");
            }
            result = meetings.findVisible(user.getId(), user.getEmail(), from, to);
        } else {
            result = meetings.findAllVisible(user.getId(), user.getEmail());
        }
        return toResponses(user, result);
    }

    @Transactional(readOnly = true)
    public List<MeetingResponse> findInvitations(User user) {
        return toResponses(user, meetings.findPendingInvitations(user.getEmail(), LocalDateTime.now(),
                ParticipantStatus.PENDING));
    }

    @Transactional(readOnly = true)
    public MeetingResponse findOne(User user, Long id) {
        return toResponse(user, loadVisible(user, id));
    }

    public MeetingResponse create(User owner, MeetingRequest request) {
        validate(owner, request, null);
        Meeting meeting = new Meeting();
        meeting.setOwner(owner);
        apply(meeting, request);
        return toResponse(owner, meetings.save(meeting));
    }

    public MeetingResponse update(User owner, Long id, MeetingRequest request) {
        Meeting meeting = loadOwned(owner, id);
        validate(owner, request, id);
        apply(meeting, request);
        return toResponse(owner, meetings.saveAndFlush(meeting));
    }

    public MeetingResponse respond(User user, Long id, ParticipantStatus status) {
        if (status == ParticipantStatus.PENDING) {
            throw new BadRequestException("Answer must be ACCEPTED or DECLINED");
        }
        Meeting meeting = loadVisible(user, id);
        MeetingParticipant participant = meeting.participantFor(user)
                .orElseThrow(() -> new BadRequestException("You organize this meeting, you cannot answer it"));
        if (status == ParticipantStatus.ACCEPTED) {
            checkAvailability(user, meeting.getStartAt(), meeting.getEndAt(), id);
        }
        participant.setStatus(status);
        return toResponse(user, meetings.saveAndFlush(meeting));
    }

    public void delete(User owner, Long id) {
        meetings.delete(loadOwned(owner, id));
    }

    private Meeting loadVisible(User user, Long id) {
        return meetings.findVisibleById(id, user.getId(), user.getEmail())
                .orElseThrow(() -> new NotFoundException("Meeting " + id + " not found"));
    }

    private Meeting loadOwned(User user, Long id) {
        Meeting meeting = loadVisible(user, id);
        if (!meeting.isOwnedBy(user)) {
            throw new ForbiddenException("Only the organizer can modify this meeting");
        }
        return meeting;
    }

    /** Rejects an empty time slot and double-booking of the organizer. */
    private void validate(User owner, MeetingRequest request, Long currentId) {
        if (!request.endAt().isAfter(request.startAt())) {
            throw new BadRequestException("Meeting must end after it starts");
        }
        checkAvailability(owner, request.startAt(), request.endAt(), currentId);
    }

    private void checkAvailability(User user, LocalDateTime start, LocalDateTime end, Long currentId) {
        meetings.findBusy(user.getId(), user.getEmail(), start, end, ParticipantStatus.ACCEPTED).stream()
                .filter(m -> !Objects.equals(m.getId(), currentId))
                .findFirst()
                .ifPresent(m -> {
                    throw new ConflictException("Time slot overlaps with meeting \"" + m.getTitle() + "\"");
                });
    }

    private static void apply(Meeting meeting, MeetingRequest request) {
        // a rescheduled meeting must be confirmed again by its participants
        boolean rescheduled = !request.startAt().equals(meeting.getStartAt()) || !request.endAt().equals(meeting.getEndAt());
        Map<String, ParticipantStatus> previous = meeting.getParticipants().stream()
                .collect(Collectors.toMap(MeetingParticipant::getParticipant, MeetingParticipant::getStatus));
        String ownerEmail = meeting.getOwner().getEmail();

        meeting.setTitle(request.title().trim());
        meeting.setDescription(blankToNull(request.description()));
        meeting.setLocation(blankToNull(request.location()));
        meeting.setStartAt(request.startAt());
        meeting.setEndAt(request.endAt());
        meeting.setParticipants(request.participants() == null ? List.of()
                : request.participants().stream()
                        .map(MeetingParticipant::normalize)
                        .distinct()
                        .filter(p -> !p.equals(ownerEmail))
                        .map(p -> new MeetingParticipant(p, rescheduled
                                ? ParticipantStatus.PENDING
                                : previous.getOrDefault(p, ParticipantStatus.PENDING)))
                        .toList());
    }

    private List<MeetingResponse> toResponses(User viewer, List<Meeting> result) {
        Map<String, User> registered = registeredUsers(result);
        return result.stream().map(m -> toResponse(viewer, m, registered)).toList();
    }

    private MeetingResponse toResponse(User viewer, Meeting meeting) {
        return toResponse(viewer, meeting, registeredUsers(List.of(meeting)));
    }

    /** Registered users among the participants of the given meetings, by email (one query). */
    private Map<String, User> registeredUsers(List<Meeting> result) {
        List<String> emails = result.stream()
                .flatMap(m -> m.getParticipants().stream())
                .map(MeetingParticipant::getParticipant)
                .filter(p -> p.contains("@"))
                .distinct()
                .toList();
        return emails.isEmpty() ? Map.of()
                : users.findByEmailIn(emails).stream().collect(Collectors.toMap(User::getEmail, Function.identity()));
    }

    private static MeetingResponse toResponse(User viewer, Meeting meeting, Map<String, User> registered) {
        User owner = meeting.getOwner();
        List<ParticipantResponse> participants = meeting.getParticipants().stream()
                .map(p -> {
                    User u = registered.get(p.getParticipant());
                    return new ParticipantResponse(p.getParticipant(), u == null ? null : u.getFullName(), p.getStatus());
                })
                .toList();
        return new MeetingResponse(meeting.getId(), meeting.getTitle(), meeting.getDescription(),
                meeting.getLocation(), meeting.getStartAt(), meeting.getEndAt(),
                new OrganizerResponse(owner.getEmail(), owner.getFullName()),
                meeting.isOwnedBy(viewer),
                meeting.participantFor(viewer).map(MeetingParticipant::getStatus).orElse(null),
                participants, meeting.getCreatedAt(), meeting.getUpdatedAt());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
