package com.taskflow.activity;

import com.taskflow.activity.ActivityDtos.TaskEventResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/tasks/{taskId}/activity")
public class TaskActivityController {

    private final TaskActivityService activityService;

    public TaskActivityController(TaskActivityService activityService) {
        this.activityService = activityService;
    }

    @GetMapping
    public List<TaskEventResponse> list(@PathVariable Long taskId) {
        return activityService.findAll(taskId);
    }
}
