package com.taskflow.time;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;

import java.util.List;

public interface TimeEntryRepository extends JpaRepository<TimeEntry, Long> {

    @EntityGraph(attributePaths = "user")
    List<TimeEntry> findByTaskIdOrderByStartedAtDescIdDesc(Long taskId);

    /** The user's running timers: at most one, unless two were started at the same instant. */
    @EntityGraph(attributePaths = "task")
    List<TimeEntry> findByUserIdAndEndedAtIsNull(Long userId);

    /**
     * Finished entries started in [{@code from}, {@code until}), by {@code userId} unless it is {@code null}, oldest
     * first, with their task and user.
     */
    @Query("""
            select e from TimeEntry e join fetch e.task left join fetch e.user u
            where e.endedAt is not null and e.startedAt >= :from and e.startedAt < :until
              and (:userId is null or u.id = :userId)
            order by e.startedAt, e.id
            """)
    List<TimeEntry> findFinishedBetween(@Param("from") LocalDateTime from, @Param("until") LocalDateTime until,
                                        @Param("userId") Long userId);
}
