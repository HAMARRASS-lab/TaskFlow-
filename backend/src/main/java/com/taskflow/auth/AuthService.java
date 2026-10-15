package com.taskflow.auth;

import com.taskflow.admin.AdminBootstrap;
import com.taskflow.auth.AuthDtos.AuthResponse;
import com.taskflow.auth.AuthDtos.LoginRequest;
import com.taskflow.auth.AuthDtos.RegisterRequest;
import com.taskflow.auth.AuthDtos.UserResponse;
import com.taskflow.common.ConflictException;
import com.taskflow.common.NotFoundException;
import com.taskflow.mail.MailService;
import com.taskflow.security.JwtService;
import com.taskflow.user.Role;
import com.taskflow.user.User;
import com.taskflow.user.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

@Service
public class AuthService {

    static final Duration VERIFY_EMAIL_VALIDITY = Duration.ofDays(2);
    static final Duration RESET_PASSWORD_VALIDITY = Duration.ofHours(1);

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final AdminBootstrap adminBootstrap;
    private final UserTokenService tokens;
    private final MailService mail;
    private final String frontendUrl;

    public AuthService(UserRepository users, PasswordEncoder passwordEncoder,
                       AuthenticationManager authenticationManager, JwtService jwtService,
                       AdminBootstrap adminBootstrap, UserTokenService tokens, MailService mail,
                       @Value("${app.frontend-url}") String frontendUrl) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.adminBootstrap = adminBootstrap;
        this.tokens = tokens;
        this.mail = mail;
        this.frontendUrl = frontendUrl.replaceAll("/+$", "");
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (users.existsByEmailIgnoreCase(request.email())) {
            throw new ConflictException("Email already registered");
        }
        User user = new User(
                request.email().toLowerCase(),
                passwordEncoder.encode(request.password()),
                request.fullName());
        if (adminBootstrap.isAdminEmail(user.getEmail())) {
            user.setRole(Role.ADMIN);
        }
        user = users.save(user);
        sendVerificationEmail(user);
        return toResponse(user);
    }

    public AuthResponse login(LoginRequest request) {
        var auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email(), request.password()));
        return toResponse((User) auth.getPrincipal());
    }

    /** Emails a reset link if the account exists; silent otherwise so the endpoint can't reveal registered emails. */
    @Transactional
    public void requestPasswordReset(String email) {
        users.findByEmailIgnoreCase(email.trim()).ifPresent(user -> {
            String token = tokens.issue(user, TokenPurpose.RESET_PASSWORD, RESET_PASSWORD_VALIDITY);
            mail.send(user.getEmail(), "Reset your TaskFlow password", """
                    Hi %s,

                    Someone (hopefully you) asked to reset your TaskFlow password.
                    Choose a new one here (the link is valid for 1 hour):

                    %s

                    If you didn't ask for this, you can ignore this email: your password stays the same.
                    """.formatted(user.getFullName(), link("/reset-password", token)));
        });
    }

    /** Sets a new password; following the emailed link also proves the address, so it is marked verified. */
    @Transactional
    public void resetPassword(String token, String newPassword) {
        User user = tokens.consume(token, TokenPurpose.RESET_PASSWORD);
        user.setPassword(passwordEncoder.encode(newPassword));
        user.setEmailVerified(true);
    }

    @Transactional
    public UserResponse verifyEmail(String token) {
        User user = tokens.consume(token, TokenPurpose.VERIFY_EMAIL);
        user.setEmailVerified(true);
        return toUserResponse(user);
    }

    @Transactional
    public void resendVerification(User principal) {
        User user = reload(principal);
        if (!user.isEmailVerified()) {
            sendVerificationEmail(user);
        }
    }

    @Transactional
    public UserResponse updatePreferences(User principal, boolean digestEnabled) {
        User user = reload(principal);
        user.setDigestEnabled(digestEnabled);
        return toUserResponse(user);
    }

    public static UserResponse toUserResponse(User user) {
        return new UserResponse(user.getId(), user.getEmail(), user.getFullName(), user.getRole().name(),
                user.isEmailVerified(), user.isDigestEnabled());
    }

    private void sendVerificationEmail(User user) {
        String token = tokens.issue(user, TokenPurpose.VERIFY_EMAIL, VERIFY_EMAIL_VALIDITY);
        mail.send(user.getEmail(), "Confirm your TaskFlow email", """
                Hi %s,

                Welcome to TaskFlow! Please confirm your email address (the link is valid for 2 days):

                %s

                Once confirmed, you can receive a daily digest of your tasks and meetings.
                """.formatted(user.getFullName(), link("/verify-email", token)));
    }

    private String link(String path, String token) {
        return frontendUrl + path + "?token=" + URLEncoder.encode(token, StandardCharsets.UTF_8);
    }

    /** The principal comes from the JWT filter, outside this transaction: reload it to persist changes. */
    private User reload(User principal) {
        return users.findById(principal.getId()).orElseThrow(() -> new NotFoundException("User not found"));
    }

    private AuthResponse toResponse(User user) {
        return new AuthResponse(jwtService.generateToken(user), jwtService.getExpirationMs(), toUserResponse(user));
    }
}
