package com.taskflow.time;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TimeEntryRepository extends JpaRepository<TimeEntry, Long> {

    @EntityGraph(attributePaths = "user")
    List<TimeEntry> findByTaskIdOrderByStartedAtDescIdDesc(Long taskId);

    /** The user's running timers: at most one, unless two were started at the same instant. */
    @EntityGraph(attributePaths = "task")
    List<TimeEntry> findByUserIdAndEndedAtIsNull(Long userId);
}
