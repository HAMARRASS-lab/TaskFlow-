package com.taskflow.comment;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TaskCommentRepository extends JpaRepository<TaskComment, Long> {

    @EntityGraph(attributePaths = "author")
    List<TaskComment> findByTaskIdOrderByCreatedAtAscIdAsc(Long taskId);

    Optional<TaskComment> findByIdAndTaskId(Long id, Long taskId);
}
