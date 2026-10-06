package com.taskflow.task;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface TaskRepository extends JpaRepository<Task, Long> {

    List<Task> findByOwnerIdOrderByCreatedAtDesc(Long ownerId);

    List<Task> findByOwnerIdAndStatusOrderByCreatedAtDesc(Long ownerId, TaskStatus status);

    Optional<Task> findByIdAndOwnerId(Long id, Long ownerId);

    /** One row per (owner, status) pair that has at least one task. */
    @Query("""
            select o.id as ownerId, o.fullName as fullName, o.email as email, t.status as status, count(t) as count
            from Task t join t.owner o
            group by o.id, o.fullName, o.email, t.status
            """)
    List<OwnerStatusCount> countByOwnerAndStatus();

    interface OwnerStatusCount {
        Long getOwnerId();

        String getFullName();

        String getEmail();

        TaskStatus getStatus();

        long getCount();
    }
}
