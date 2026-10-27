package com.taskflow.time;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Time tracking end to end: Flyway schema on H2, timers, logged time, the estimate and who may do what. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TimeTrackingIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    private record Account(long id, String bearer) {
    }

    private Account register(String name) throws Exception {
        String body = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s-%s@test.com\",\"password\":\"password123\",\"fullName\":\"%s\"}"
                                .formatted(name.toLowerCase(), UUID.randomUUID(), name)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        JsonNode node = json.readTree(body);
        return new Account(node.get("user").get("id").asLong(), "Bearer " + node.get("token").asText());
    }

    private long createTask(Account owner, String title) throws Exception {
        String created = mvc.perform(post("/api/tasks").header("Authorization", owner.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"%s\"}".formatted(title)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(created).get("id").asLong();
    }

    @Test
    void timersLoggedTimeAndTheEstimate() throws Exception {
        Account alice = register("Alice");
        Account bob = register("Bob");
        long id = createTask(alice, "Write the docs");
        long other = createTask(alice, "Fix the build");

        mvc.perform(put("/api/tasks/{id}/time/estimate", id).header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"minutes\":120}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estimateMinutes").value(120));
        mvc.perform(post("/api/tasks/{id}/time/entries", id).header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"minutes\":90,\"note\":\"First draft\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.loggedSeconds").value(5400))
                .andExpect(jsonPath("$.entries[0].note").value("First draft"));

        // a timer on another task stops when one starts here
        mvc.perform(post("/api/tasks/{id}/time/start", other).header("Authorization", alice.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries[0].running").value(true));
        mvc.perform(post("/api/tasks/{id}/time/start", id).header("Authorization", alice.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries", hasSize(2)))
                .andExpect(jsonPath("$.entries[0].running").value(true))
                .andExpect(jsonPath("$.entries[0].user.fullName").value("Alice"));
        mvc.perform(get("/api/tasks/{id}/time", other).header("Authorization", alice.bearer()))
                .andExpect(jsonPath("$.entries[0].running").value(false));
        mvc.perform(post("/api/tasks/{id}/time/start", id).header("Authorization", alice.bearer()))
                .andExpect(status().isConflict());

        mvc.perform(post("/api/tasks/{id}/time/stop", id).header("Authorization", alice.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries[0].running").value(false));
        mvc.perform(post("/api/tasks/{id}/time/stop", id).header("Authorization", alice.bearer()))
                .andExpect(status().isConflict());

        // everyone can see the time, only the owner or assignee can track it, only the author can delete an entry
        String summary = mvc.perform(get("/api/tasks/{id}/time", id).header("Authorization", bob.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canLog").value(false))
                .andExpect(jsonPath("$.entries[0].mine").value(false))
                .andExpect(jsonPath("$.estimateMinutes").value(120))
                .andReturn().getResponse().getContentAsString();
        long logged = json.readTree(summary).get("entries").get(1).get("id").asLong();
        mvc.perform(post("/api/tasks/{id}/time/start", id).header("Authorization", bob.bearer()))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/tasks/{id}/time/entries/{e}", id, logged).header("Authorization", bob.bearer()))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/tasks/{id}/time/entries/{e}", other, logged).header("Authorization", alice.bearer()))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/tasks/{id}/time/entries/{e}", id, logged).header("Authorization", alice.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries", hasSize(1)));

        mvc.perform(put("/api/tasks/{id}/time/estimate", id).header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"minutes\":null}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estimateMinutes").doesNotExist());
        mvc.perform(post("/api/tasks/{id}/time/entries", id).header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"minutes\":0}"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/tasks/{id}/time", 999_999).header("Authorization", bob.bearer()))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/tasks/{id}/time", id)).andExpect(status().isUnauthorized());
    }
}
