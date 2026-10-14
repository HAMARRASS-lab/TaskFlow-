package com.taskflow.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskflow.mail.MailService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Email flows (verification, password reset, digest opt-out) and the iCalendar export, with the mailer mocked. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class EmailAndCalendarIntegrationTest {

    private static final Pattern TOKEN = Pattern.compile("\\?token=([A-Za-z0-9_%-]+)");

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @MockBean
    private MailService mail;

    private String register(String email) throws Exception {
        String body = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"password123\",\"fullName\":\"Eve Test\"}"
                                .formatted(email)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.user.emailVerified").value(false))
                .andExpect(jsonPath("$.user.digestEnabled").value(true))
                .andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(body).get("token").asText();
    }

    /** The token in the last email with this subject sent to {@code email}. */
    private String tokenFromMail(String email, String subject) {
        ArgumentCaptor<String> text = ArgumentCaptor.forClass(String.class);
        verify(mail, atLeastOnce()).send(eq(email), eq(subject), text.capture());
        Matcher m = TOKEN.matcher(text.getValue());
        assertThat(m.find()).isTrue();
        return URLDecoder.decode(m.group(1), StandardCharsets.UTF_8);
    }

    @Test
    void verifiesEmailWithTheEmailedLink() throws Exception {
        String email = "verify-" + UUID.randomUUID() + "@test.com";
        String bearer = register(email);
        String token = tokenFromMail(email, "Confirm your TaskFlow email");

        mvc.perform(post("/api/auth/verify-email").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"%s\"}".formatted(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.emailVerified").value(true));

        // single use
        mvc.perform(post("/api/auth/verify-email").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"%s\"}".formatted(token)))
                .andExpect(status().isBadRequest());

        mvc.perform(get("/api/auth/me").header("Authorization", bearer))
                .andExpect(jsonPath("$.emailVerified").value(true));
    }

    @Test
    void resendingInvalidatesThePreviousLink() throws Exception {
        String email = "resend-" + UUID.randomUUID() + "@test.com";
        String bearer = register(email);
        String first = tokenFromMail(email, "Confirm your TaskFlow email");

        mvc.perform(post("/api/auth/verify-email/resend").header("Authorization", bearer))
                .andExpect(status().isNoContent());
        String second = tokenFromMail(email, "Confirm your TaskFlow email");
        assertThat(second).isNotEqualTo(first);

        mvc.perform(post("/api/auth/verify-email").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"%s\"}".formatted(first)))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/verify-email").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"%s\"}".formatted(second)))
                .andExpect(status().isOk());
    }

    @Test
    void resetsPasswordWithTheEmailedLink() throws Exception {
        String email = "reset-" + UUID.randomUUID() + "@test.com";
        register(email);

        mvc.perform(post("/api/auth/forgot-password").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\"}".formatted(email.toUpperCase())))
                .andExpect(status().isNoContent());
        String token = tokenFromMail(email, "Reset your TaskFlow password");

        mvc.perform(post("/api/auth/reset-password").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"%s\",\"password\":\"brand-new-pass\"}".formatted(token)))
                .andExpect(status().isNoContent());

        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"password123\"}".formatted(email)))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"brand-new-pass\"}".formatted(email)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.emailVerified").value(true));

        mvc.perform(post("/api/auth/reset-password").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"%s\",\"password\":\"another-pass\"}".formatted(token)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void forgotPasswordDoesNotRevealUnknownEmails() throws Exception {
        mvc.perform(post("/api/auth/forgot-password").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"nobody-%s@test.com\"}".formatted(UUID.randomUUID())))
                .andExpect(status().isNoContent());
        verify(mail, never()).send(anyString(), eq("Reset your TaskFlow password"), anyString());
    }

    @Test
    void turnsTheDigestOff() throws Exception {
        String bearer = register("digest-" + UUID.randomUUID() + "@test.com");

        mvc.perform(patch("/api/auth/me/preferences").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"digestEnabled\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.digestEnabled").value(false));
        mvc.perform(get("/api/auth/me").header("Authorization", bearer))
                .andExpect(jsonPath("$.digestEnabled").value(false));
    }

    @Test
    void exportsMeetingsAsIcsAndThroughTheSecretFeed() throws Exception {
        String bearer = register("ics-" + UUID.randomUUID() + "@test.com");
        String created = mvc.perform(post("/api/meetings").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Planning, Q4","startAt":"2026-12-01T14:00:00","endAt":"2026-12-01T15:00:00"}"""))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(created).get("id").asLong();

        mvc.perform(get("/api/meetings/{id}/ics", id).header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("text/calendar"))
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"meeting-%d.ics\"".formatted(id)))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("SUMMARY:Planning\\, Q4")))
                // Europe/Paris in December is UTC+1
                .andExpect(content().string(org.hamcrest.Matchers.containsString("DTSTART:20261201T130000Z")));

        mvc.perform(get("/api/calendar/feed").header("Authorization", bearer))
                .andExpect(jsonPath("$.url").doesNotExist());
        String url = json.readTree(mvc.perform(post("/api/calendar/feed").header("Authorization", bearer))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString()).get("url").asText();
        assertThat(url).startsWith("http://localhost:4200/api/calendar/feed/");
        String path = url.substring("http://localhost:4200".length());

        // no JWT: calendar apps authenticate with the URL alone
        mvc.perform(get(path))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("UID:meeting-%d@taskflow".formatted(id))));

        mvc.perform(delete("/api/calendar/feed").header("Authorization", bearer))
                .andExpect(status().isNoContent());
        mvc.perform(get(path)).andExpect(status().isNotFound());
    }

    @Test
    void protectsTheIcsDownload() throws Exception {
        mvc.perform(get("/api/meetings/1/ics")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/calendar/feed")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/calendar/feed/not-a-real-token")).andExpect(status().isNotFound());
    }
}
