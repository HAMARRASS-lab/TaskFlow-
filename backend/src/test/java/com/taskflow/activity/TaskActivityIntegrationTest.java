package com.taskflow.activity;

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
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Activity history end to end: Flyway schema on H2, recording from the task endpoints, and reading it back. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TaskActivityIntegrationTest {

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

    @Test
    void creationAndTrackedChangesShowUpInTheHistoryOldestFirst() throws Exception {
        Account alice = register("Alice");
        Account bob = register("Bob");
        Account carol = register("Carol");

        String created = mvc.perform(post("/api/tasks").header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Review PR\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(created).get("id").asLong();

        // a title-only edit is not tracked; priority, assignee and due date are
        mvc.perform(put("/api/tasks/{id}", id).header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Review the PR\"}"))
                .andExpect(status().isOk());
        mvc.perform(put("/api/tasks/{id}", id).header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"title":"Review the PR","priority":"HIGH","dueDate":"2026-11-02","assigneeId":%d}"""
                                .formatted(bob.id())))
                .andExpect(status().isOk());
        mvc.perform(patch("/api/tasks/{id}/status", id).header("Authorization", bob.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"IN_PROGRESS\"}"))
                .andExpect(status().isOk());

        // like the task itself, its history is visible to everyone
        mvc.perform(get("/api/tasks/{id}/activity", id).header("Authorization", carol.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(5)))
                .andExpect(jsonPath("$[0].type").value("CREATED"))
                .andExpect(jsonPath("$[0].actor.fullName").value("Alice"))
                .andExpect(jsonPath("$[1].type").value("PRIORITY"))
                .andExpect(jsonPath("$[1].oldValue").value("MEDIUM"))
                .andExpect(jsonPath("$[1].newValue").value("HIGH"))
                .andExpect(jsonPath("$[2].type").value("ASSIGNEE"))
                .andExpect(jsonPath("$[2].oldValue").value(nullValue()))
                .andExpect(jsonPath("$[2].newValue").value("Bob"))
                .andExpect(jsonPath("$[3].type").value("DUE_DATE"))
                .andExpect(jsonPath("$[3].newValue").value("2026-11-02"))
                .andExpect(jsonPath("$[4].type").value("STATUS"))
                .andExpect(jsonPath("$[4].newValue").value("IN_PROGRESS"))
                .andExpect(jsonPath("$[4].actor.fullName").value("Bob"));

        mvc.perform(get("/api/tasks/{id}/activity", 999_999).header("Authorization", carol.bearer()))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/tasks/{id}/activity", id)).andExpect(status().isUnauthorized());
    }
}
