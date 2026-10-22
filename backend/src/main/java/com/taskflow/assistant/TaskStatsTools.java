package com.taskflow.assistant;

import com.taskflow.task.TaskRepository;
import com.taskflow.task.TaskRepository.OwnerStatusCount;
import com.taskflow.task.TaskStatus;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Read-only task statistics the assistant's model can call, so its answers come from the database. */
@Component
@Transactional(readOnly = true)
public class TaskStatsTools {

    private final TaskRepository tasks;

    public TaskStatsTools(TaskRepository tasks) {
        this.tasks = tasks;
    }

    @Tool(description = "Number of tasks in each status (TODO, IN_PROGRESS, DONE) across all users, plus the total.")
    public Map<String, Long> countTasksByStatus() {
        Map<TaskStatus, Long> counts = new EnumMap<>(TaskStatus.class);
        for (TaskStatus status : TaskStatus.values()) counts.put(status, 0L);
        tasks.countByStatus().forEach(row -> counts.put(row.getStatus(), row.getCount()));

        Map<String, Long> result = new LinkedHashMap<>();
        counts.forEach((status, count) -> result.put(status.name(), count));
        result.put("TOTAL", counts.values().stream().mapToLong(Long::longValue).sum());
        return result;
    }

    @Tool(description = "Per user, the number of tasks they own in the given status, most first.")
    public List<UserCount> countTasksPerUser(@ToolParam(description = "TODO, IN_PROGRESS or DONE") TaskStatus status) {
        return tasks.countByOwnerAndStatus().stream()
                .filter(row -> row.getStatus() == status)
                .sorted(Comparator.comparingLong(OwnerStatusCount::getCount).reversed())
                .map(row -> new UserCount(row.getFullName(), row.getEmail(), row.getCount()))
                .toList();
    }

    public record UserCount(String fullName, String email, long count) {
    }
}
