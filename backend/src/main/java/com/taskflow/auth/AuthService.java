package com.taskflow.auth;

import com.taskflow.auth.AuthDtos.AuthResponse;
import com.taskflow.auth.AuthDtos.LoginRequest;
import com.taskflow.auth.AuthDtos.RegisterRequest;
import com.taskflow.auth.AuthDtos.UserResponse;
import com.taskflow.common.ConflictException;
import com.taskflow.security.JwtService;
import com.taskflow.user.User;
import com.taskflow.user.UserRepository;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;

    public AuthService(UserRepository users, PasswordEncoder passwordEncoder,
                       AuthenticationManager authenticationManager, JwtService jwtService) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (users.existsByEmailIgnoreCase(request.email())) {
            throw new ConflictException("Email already registered");
        }
        User user = users.save(new User(
                request.email().toLowerCase(),
                passwordEncoder.encode(request.password()),
                request.fullName()));
        return toResponse(user);
    }

    public AuthResponse login(LoginRequest request) {
        var auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email(), request.password()));
        return toResponse((User) auth.getPrincipal());
    }

    public static UserResponse toUserResponse(User user) {
        return new UserResponse(user.getId(), user.getEmail(), user.getFullName(), user.getRole().name());
    }

    private AuthResponse toResponse(User user) {
        return new AuthResponse(jwtService.generateToken(user), jwtService.getExpirationMs(), toUserResponse(user));
    }
}
