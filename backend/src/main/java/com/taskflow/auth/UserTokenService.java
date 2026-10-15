package com.taskflow.auth;

import com.taskflow.common.BadRequestException;
import com.taskflow.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;

/** Issues and redeems the single-use tokens embedded in emailed links. */
@Service
public class UserTokenService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserTokenRepository tokens;

    public UserTokenService(UserTokenRepository tokens) {
        this.tokens = tokens;
    }

    /** Creates a token (replacing any previous one with the same purpose) and returns its raw value. */
    @Transactional
    public String issue(User user, TokenPurpose purpose, Duration validity) {
        tokens.deleteByUserAndPurpose(user.getId(), purpose);
        String raw = randomToken();
        tokens.save(new UserToken(user, purpose, sha256(raw), LocalDateTime.now().plus(validity)));
        return raw;
    }

    /** Marks the token as used and returns its user; rejects unknown, used or expired tokens. */
    @Transactional
    public User consume(String raw, TokenPurpose purpose) {
        UserToken token = tokens.findByHash(sha256(raw), purpose)
                .filter(t -> t.isUsable(LocalDateTime.now()))
                .orElseThrow(() -> new BadRequestException("This link is invalid or has expired"));
        token.setUsedAt(LocalDateTime.now());
        return token.getUser();
    }

    /** 256 random bits, URL-safe. */
    public static String randomToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    static String sha256(String value) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
