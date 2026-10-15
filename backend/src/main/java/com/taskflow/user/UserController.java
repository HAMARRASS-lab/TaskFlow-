package com.taskflow.user;

import com.taskflow.task.TaskDtos.UserSummary;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Directory of every user, to pick an assignee or watchers. */
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserRepository users;

    public UserController(UserRepository users) {
        this.users = users;
    }

    @GetMapping
    public List<UserSummary> list() {
        return users.findAllByOrderByFullNameAsc().stream().map(UserSummary::from).toList();
    }
}
