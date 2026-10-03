package com.taskflow.security;

import org.junit.jupiter.api.Test;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Base64;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {

    private static final String SECRET =
            Base64.getEncoder().encodeToString("a-very-long-test-secret-key-for-hmac-sha-256!".getBytes());

    private final JwtService jwtService = new JwtService(SECRET, 60_000);
    private final UserDetails alice = new User("alice@test.com", "x", List.of());

    @Test
    void generatesTokenWithSubject() {
        String token = jwtService.generateToken(alice);

        assertThat(jwtService.extractUsername(token)).isEqualTo("alice@test.com");
        assertThat(jwtService.isValid(token, alice)).isTrue();
    }

    @Test
    void rejectsTokenForAnotherUser() {
        String token = jwtService.generateToken(alice);
        UserDetails bob = new User("bob@test.com", "x", List.of());

        assertThat(jwtService.isValid(token, bob)).isFalse();
    }

    @Test
    void rejectsExpiredToken() {
        JwtService expired = new JwtService(SECRET, -1_000);
        String token = expired.generateToken(alice);

        assertThat(jwtService.extractUsername(token)).isNull();
    }

    @Test
    void rejectsTamperedToken() {
        String token = jwtService.generateToken(alice) + "tampered";

        assertThat(jwtService.extractUsername(token)).isNull();
    }
}
