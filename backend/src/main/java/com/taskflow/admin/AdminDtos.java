package com.taskflow.admin;

import com.taskflow.user.Role;
import com.taskflow.user.User;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public final class AdminDtos {

    private AdminDtos() {
    }

    public record CreateUserRequest(
            @NotBlank @Email String email,
            @NotBlank @Size(min = 8, max = 100) String password,
            @NotBlank @Size(max = 255) String fullName,
            Role role) {
    }

    /** {@code password} is optional: null or empty keeps the current one. */
    public record UpdateUserRequest(
            @NotBlank @Email String email,
            @Pattern(regexp = "^$|^.{8,100}$", message = "size must be between 8 and 100") String password,
            @NotBlank @Size(max = 255) String fullName,
            @NotNull Role role) {
    }

    public record AssignRequest(@NotNull Long userId) {
    }

    public record AdminUserResponse(Long id, String email, String fullName, Role role, LocalDateTime createdAt) {

        static AdminUserResponse from(User user) {
            return new AdminUserResponse(user.getId(), user.getEmail(), user.getFullName(), user.getRole(),
                    user.getCreatedAt());
        }
    }
}
