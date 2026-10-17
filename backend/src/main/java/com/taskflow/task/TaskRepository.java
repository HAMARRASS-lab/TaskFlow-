package com.taskflow.task;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface TaskRepository extends JpaRepository<Task, Long> {

    /** The user's board: tasks they created, are assigned to or watch, newest first. */
    @Query("""
            select distinct t from Task t left join t.watchers w
            where t.owner.id = :userId or t.assignee.id = :userId or w.id = :userId
            order by t.createdAt desc
            """)
    List<Task> findOnBoardOf(@Param("userId") Long userId);

    /**
     * Tasks the user is responsible for (assigned to them, or created by them and unassigned) that are not in
     * {@code status} and are due on or before {@code until} (overdue ones included), soonest first.
     */
    @Query("""
            select t from Task t
            where (t.assignee.id = :userId or (t.owner.id = :userId and t.assignee is null))
              and t.status <> :status and t.dueDate <= :until
            order by t.dueDate asc
            """)
    List<Task> findDueForResponsible(@Param("userId") Long userId, @Param("status") TaskStatus status,
                                     @Param("until") LocalDate until);

    /** A member's tasks on the Team page: those they created or are assigned to, newest first. */
    @Query("""
            select t from Task t
            where t.owner.id = :userId or t.assignee.id = :userId
            order by t.createdAt desc
            """)
    List<Task> findForMember(@Param("userId") Long userId);

    /** One row per (owner, status) pair that has at least one task. */
    @Query("""
            select o.id as ownerId, o.fullName as fullName, o.email as email, t.status as status, count(t) as count
            from Task t join t.owner o
            group by o.id, o.fullName, o.email, t.status
            """)
    List<OwnerStatusCount> countByOwnerAndStatus();

    /**
     * One row per (assignee, status) pair, for tasks assigned to someone other than their owner (a self-assigned
     * task is already counted by {@link #countByOwnerAndStatus()}).
     */
    @Query("""
            select a.id as ownerId, a.fullName as fullName, a.email as email, t.status as status, count(t) as count
            from Task t join t.assignee a
            where a.id <> t.owner.id
            group by a.id, a.fullName, a.email, t.status
            """)
    List<OwnerStatusCount> countByAssigneeAndStatus();

    interface OwnerStatusCount {
        Long getOwnerId();

        String getFullName();

        String getEmail();

        TaskStatus getStatus();

        long getCount();
    }
}
