package com.taskflow.admin;

import com.taskflow.admin.AdminDtos.AdminUserResponse;
import com.taskflow.admin.AdminDtos.CreateUserRequest;
import com.taskflow.admin.AdminDtos.UpdateUserRequest;
import com.taskflow.common.BadRequestException;
import com.taskflow.common.ConflictException;
import com.taskflow.common.NotFoundException;
import com.taskflow.user.Role;
import com.taskflow.user.User;
import com.taskflow.user.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** User management, reserved to administrators. */
@Service
@Transactional
public class AdminService {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;

    public AdminService(UserRepository users, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public List<AdminUserResponse> findAll() {
        return users.findAllByOrderByFullNameAsc().stream().map(AdminUserResponse::from).toList();
    }

    public AdminUserResponse create(CreateUserRequest request) {
        String email = request.email().trim().toLowerCase();
        if (users.existsByEmailIgnoreCase(email)) {
            throw new ConflictException("Email already registered");
        }
        User user = new User(email, passwordEncoder.encode(request.password()), request.fullName().trim());
        user.setRole(request.role() == null ? Role.USER : request.role());
        return AdminUserResponse.from(users.save(user));
    }

    public AdminUserResponse update(User admin, Long id, UpdateUserRequest request) {
        User user = load(id);
        String email = request.email().trim().toLowerCase();
        if (!email.equalsIgnoreCase(user.getEmail()) && users.existsByEmailIgnoreCase(email)) {
            throw new ConflictException("Email already registered");
        }
        if (user.getId().equals(admin.getId()) && request.role() != Role.ADMIN) {
            throw new BadRequestException("You cannot remove your own admin role");
        }
        user.setEmail(email);
        user.setFullName(request.fullName().trim());
        user.setRole(request.role());
        if (request.password() != null && !request.password().isEmpty()) {
            user.setPassword(passwordEncoder.encode(request.password()));
        }
        return AdminUserResponse.from(users.saveAndFlush(user));
    }

    /** Deletes the user; their tasks and meetings are removed by the database (ON DELETE CASCADE). */
    public void delete(User admin, Long id) {
        if (id.equals(admin.getId())) {
            throw new BadRequestException("You cannot delete your own account");
        }
        users.delete(load(id));
    }

    private User load(Long id) {
        return users.findById(id).orElseThrow(() -> new NotFoundException("User " + id + " not found"));
    }
}
