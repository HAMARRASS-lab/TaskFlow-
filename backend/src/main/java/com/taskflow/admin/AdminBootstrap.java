package com.taskflow.admin;

import com.taskflow.user.Role;
import com.taskflow.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Grants ROLE_ADMIN to the emails listed in {@code app.admin.emails} (env {@code ADMIN_EMAILS}):
 * existing accounts at startup, new ones when they register (see AuthService).
 */
@Component
public class AdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final UserRepository users;
    private final Set<String> adminEmails;

    public AdminBootstrap(UserRepository users, @Value("${app.admin.emails:}") List<String> adminEmails) {
        this.users = users;
        this.adminEmails = adminEmails.stream()
                .map(e -> e.trim().toLowerCase())
                .filter(e -> !e.isEmpty())
                .collect(Collectors.toUnmodifiableSet());
    }

    public boolean isAdminEmail(String email) {
        return email != null && adminEmails.contains(email.trim().toLowerCase());
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (adminEmails.isEmpty()) return;
        users.findByEmailIn(adminEmails).stream()
                .filter(u -> u.getRole() != Role.ADMIN)
                .forEach(u -> {
                    u.setRole(Role.ADMIN);
                    users.save(u);
                    log.info("Granted ADMIN role to {}", u.getEmail());
                });
    }
}
