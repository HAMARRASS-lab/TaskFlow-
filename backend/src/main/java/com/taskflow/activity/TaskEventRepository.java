package com.taskflow.activity;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TaskEventRepository extends JpaRepository<TaskEvent, Long> {

    @EntityGraph(attributePaths = "actor")
    List<TaskEvent> findByTaskIdOrderByCreatedAtAscIdAsc(Long taskId);
}
