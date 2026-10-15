package com.taskflow.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record RegisterRequest(
            @NotBlank @Email String email,
            @NotBlank @Size(min = 8, max = 100) String password,
            @NotBlank @Size(max = 255) String fullName) {
    }

    public record LoginRequest(
            @NotBlank @Email String email,
            @NotBlank String password) {
    }

    public record ForgotPasswordRequest(@NotBlank @Email String email) {
    }

    public record ResetPasswordRequest(
            @NotBlank String token,
            @NotBlank @Size(min = 8, max = 100) String password) {
    }

    public record VerifyEmailRequest(@NotBlank String token) {
    }

    public record PreferencesRequest(@NotNull Boolean digestEnabled) {
    }

    public record AuthResponse(String token, long expiresIn, UserResponse user) {
    }

    public record UserResponse(Long id, String email, String fullName, String role,
                               boolean emailVerified, boolean digestEnabled) {
    }
}
