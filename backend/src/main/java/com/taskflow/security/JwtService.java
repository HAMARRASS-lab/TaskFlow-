package com.taskflow.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;

@Service
public class JwtService {

    private final SecretKey key;
    private final long expirationMs;

    public JwtService(@Value("${app.jwt.secret}") String secret,
                      @Value("${app.jwt.expiration-ms}") long expirationMs) {
        this.key = Keys.hmacShaKeyFor(decodeSecret(secret));
        this.expirationMs = expirationMs;
    }

    /** Accepts a Base64 key, falling back to the raw bytes (e.g. Render's generated values). */
    private static byte[] decodeSecret(String secret) {
        try {
            return Decoders.BASE64.decode(secret);
        } catch (RuntimeException e) {
            return secret.getBytes(StandardCharsets.UTF_8);
        }
    }

    public String generateToken(UserDetails user, Map<String, Object> extraClaims) {
        Date now = new Date();
        return Jwts.builder()
                .claims(extraClaims)
                .subject(user.getUsername())
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expirationMs))
                .signWith(key)
                .compact();
    }

    public String generateToken(UserDetails user) {
        return generateToken(user, Map.of());
    }

    /** Returns the subject (email) or null if the token is invalid/expired. */
    public String extractUsername(String token) {
        try {
            return parse(token).getSubject();
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }

    public boolean isValid(String token, UserDetails user) {
        String username = extractUsername(token);
        return username != null && username.equalsIgnoreCase(user.getUsername());
    }

    public long getExpirationMs() {
        return expirationMs;
    }

    private Claims parse(String token) {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }
}
