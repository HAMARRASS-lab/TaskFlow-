package com.taskflow.meeting;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * A user "sees" a meeting they organize or are invited to (participant matching their email),
 * and is "busy" during meetings they organize or have accepted.
 */
public interface MeetingRepository extends JpaRepository<Meeting, Long> {

    /** Meetings visible to the user that overlap the half-open interval [from, to). */
    @Query("""
            select distinct m from Meeting m join fetch m.owner left join m.participants p
            where (m.owner.id = :userId or p.participant = :email)
              and m.startAt < :to and m.endAt > :from
            order by m.startAt""")
    List<Meeting> findVisible(@Param("userId") Long userId, @Param("email") String email,
                              @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Query("""
            select distinct m from Meeting m join fetch m.owner left join m.participants p
            where m.owner.id = :userId or p.participant = :email
            order by m.startAt""")
    List<Meeting> findAllVisible(@Param("userId") Long userId, @Param("email") String email);

    @Query("""
            select distinct m from Meeting m join fetch m.owner left join m.participants p
            where m.id = :id and (m.owner.id = :userId or p.participant = :email)""")
    Optional<Meeting> findVisibleById(@Param("id") Long id, @Param("userId") Long userId, @Param("email") String email);

    /** Meetings the user organizes or has accepted that overlap [from, to): used to prevent double-booking. */
    @Query("""
            select distinct m from Meeting m left join m.participants p
            where (m.owner.id = :userId or (p.participant = :email and p.status = :accepted))
              and m.startAt < :to and m.endAt > :from""")
    List<Meeting> findBusy(@Param("userId") Long userId, @Param("email") String email,
                           @Param("from") LocalDateTime from, @Param("to") LocalDateTime to,
                           @Param("accepted") ParticipantStatus accepted);

    /** Upcoming meetings the user is invited to and has not answered yet. */
    @Query("""
            select distinct m from Meeting m join fetch m.owner join m.participants p
            where p.participant = :email and p.status = :pending and m.endAt > :now
            order by m.startAt""")
    List<Meeting> findPendingInvitations(@Param("email") String email, @Param("now") LocalDateTime now,
                                         @Param("pending") ParticipantStatus pending);
}
