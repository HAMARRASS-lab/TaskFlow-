package com.taskflow.notification;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The bell end to end: Flyway schema on H2, the events that notify and reading them. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class NotificationIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    private record Account(long id, String email, String bearer) {
    }

    private Account register(String name) throws Exception {
        String email = "%s-%s@test.com".formatted(name.toLowerCase(), UUID.randomUUID());
        String body = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"password123\",\"fullName\":\"%s\"}"
                                .formatted(email, name)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        JsonNode node = json.readTree(body);
        return new Account(node.get("user").get("id").asLong(), email, "Bearer " + node.get("token").asText());
    }

    @Test
    void assignmentCommentAndInvitationShowUpInTheBell() throws Exception {
        Account alice = register("Alice");
        Account bob = register("Bob");
        Account carol = register("Carol");

        String created = mvc.perform(post("/api/tasks").header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Review PR\",\"assigneeId\":%d,\"watcherIds\":[%d]}"
                                .formatted(bob.id(), carol.id())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long taskId = json.readTree(created).get("id").asLong();

        mvc.perform(get("/api/notifications").header("Authorization", bob.bearer()))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].type").value("TASK_ASSIGNED"))
                .andExpect(jsonPath("$[0].taskId").value(taskId))
                .andExpect(jsonPath("$[0].subject").value("Review PR"))
                .andExpect(jsonPath("$[0].actor.fullName").value("Alice"))
                .andExpect(jsonPath("$[0].read").value(false));
        // the owner is not told about their own action
        mvc.perform(get("/api/notifications/unread-count").header("Authorization", alice.bearer()))
                .andExpect(jsonPath("$.count").value(0));

        // Bob comments: the owner and the watcher hear about it, Bob doesn't
        mvc.perform(post("/api/tasks/{id}/comments", taskId).header("Authorization", bob.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"body\":\"On it\"}"))
                .andExpect(status().isCreated());
        for (Account a : new Account[] {alice, carol}) {
            mvc.perform(get("/api/notifications").header("Authorization", a.bearer()))
                    .andExpect(jsonPath("$[0].type").value("TASK_COMMENTED"))
                    .andExpect(jsonPath("$[0].actor.fullName").value("Bob"));
        }
        mvc.perform(get("/api/notifications/unread-count").header("Authorization", bob.bearer()))
                .andExpect(jsonPath("$.count").value(1));

        // Alice mentions Dave, who isn't involved in the task: he's told he was mentioned, Bob that she commented
        Account dave = register("Dave");
        mvc.perform(post("/api/tasks/{id}/comments", taskId).header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"@Dave can you help?\",\"mentionedUserIds\":[%d]}".formatted(dave.id())))
                .andExpect(status().isCreated());
        mvc.perform(get("/api/notifications").header("Authorization", dave.bearer()))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].type").value("TASK_MENTIONED"))
                .andExpect(jsonPath("$[0].actor.fullName").value("Alice"));
        mvc.perform(get("/api/notifications").header("Authorization", bob.bearer()))
                .andExpect(jsonPath("$[0].type").value("TASK_COMMENTED"));

        // Carol is invited to a meeting
        LocalDateTime start = LocalDateTime.now().plusDays(3).withNano(0);
        mvc.perform(post("/api/meetings").header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Kickoff\",\"startAt\":\"%s\",\"endAt\":\"%s\",\"participants\":[\"%s\"]}"
                                .formatted(start, start.plusHours(1), carol.email())))
                .andExpect(status().isCreated());
        String carolsList = mvc.perform(get("/api/notifications").header("Authorization", carol.bearer()))
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].type").value("MEETING_INVITED"))
                .andExpect(jsonPath("$[0].subject").value("Kickoff"))
                .andReturn().getResponse().getContentAsString();
        long invitationId = json.readTree(carolsList).get(0).get("id").asLong();

        // reading: one, then all; nobody else can touch them
        mvc.perform(post("/api/notifications/{id}/read", invitationId).header("Authorization", bob.bearer()))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/notifications/{id}/read", invitationId).header("Authorization", carol.bearer()))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/notifications/unread-count").header("Authorization", carol.bearer()))
                .andExpect(jsonPath("$.count").value(2));
        mvc.perform(post("/api/notifications/read-all").header("Authorization", carol.bearer()))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/notifications/unread-count").header("Authorization", carol.bearer()))
                .andExpect(jsonPath("$.count").value(0));

        // they go away with their task
        mvc.perform(delete("/api/tasks/{id}", taskId).header("Authorization", alice.bearer()))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/notifications").header("Authorization", bob.bearer()))
                .andExpect(jsonPath("$.length()").value(0));
    }
}
