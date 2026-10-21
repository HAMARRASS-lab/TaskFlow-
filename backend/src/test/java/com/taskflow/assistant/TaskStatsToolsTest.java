package com.taskflow.assistant;

import com.taskflow.assistant.TaskStatsTools.UserCount;
import com.taskflow.task.TaskRepository;
import com.taskflow.task.TaskRepository.OwnerStatusCount;
import com.taskflow.task.TaskRepository.StatusCount;
import com.taskflow.task.TaskStatus;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskStatsToolsTest {

    @Mock
    private TaskRepository tasks;

    @Test
    void countsEveryStatusIncludingEmptyOnes() {
        when(tasks.countByStatus()).thenReturn(List.of(statusCount(TaskStatus.TODO, 4), statusCount(TaskStatus.DONE, 2)));

        Map<String, Long> counts = new TaskStatsTools(tasks).countTasksByStatus();

        assertThat(counts).containsExactly(Map.entry("TODO", 4L), Map.entry("IN_PROGRESS", 0L),
                Map.entry("DONE", 2L), Map.entry("TOTAL", 6L));
    }

    @Test
    void countsPerUserForTheGivenStatusMostFirst() {
        when(tasks.countByOwnerAndStatus()).thenReturn(List.of(
                ownerCount("Alice", TaskStatus.TODO, 1),
                ownerCount("Bob", TaskStatus.TODO, 3),
                ownerCount("Bob", TaskStatus.DONE, 5)));

        List<UserCount> counts = new TaskStatsTools(tasks).countTasksPerUser(TaskStatus.TODO);

        assertThat(counts).extracting(UserCount::fullName, UserCount::count)
                .containsExactly(tuple("Bob", 3L),
                        tuple("Alice", 1L));
    }

    private static StatusCount statusCount(TaskStatus status, long count) {
        return new StatusCount() {
            public TaskStatus getStatus() { return status; }
            public long getCount() { return count; }
        };
    }

    private static OwnerStatusCount ownerCount(String name, TaskStatus status, long count) {
        return new OwnerStatusCount() {
            public Long getOwnerId() { return (long) name.hashCode(); }
            public String getFullName() { return name; }
            public String getEmail() { return name.toLowerCase() + "@test.com"; }
            public TaskStatus getStatus() { return status; }
            public long getCount() { return count; }
        };
    }
}
