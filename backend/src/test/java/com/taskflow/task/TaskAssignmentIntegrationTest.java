package com.taskflow.task;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Assignees and watchers end to end: Flyway schema on H2, the board / digest queries and the access rules. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TaskAssignmentIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private TaskRepository tasks;

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
    void assigneeAndWatchersSeeTheTaskWithTheirOwnRights() throws Exception {
        Account alice = register("Alice");
        Account bob = register("Bob");
        Account carol = register("Carol");
        Account dave = register("Dave");

        mvc.perform(get("/api/users").header("Authorization", dave.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", hasItem((int) bob.id())));

        String created = mvc.perform(post("/api/tasks").header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Review PR","dueDate":"%s","assigneeId":%d,"watcherIds":[%d]}"""
                                .formatted(LocalDate.now().plusDays(1), bob.id(), carol.id())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.owner.id").value(alice.id()))
                .andExpect(jsonPath("$.assignee.fullName").value("Bob"))
                .andExpect(jsonPath("$.watchers[0].fullName").value("Carol"))
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(created).get("id").asLong();

        // on the board of the owner, the assignee and the watcher — not anyone else's
        for (Account a : new Account[] {alice, bob, carol}) {
            mvc.perform(get("/api/tasks").header("Authorization", a.bearer()))
                    .andExpect(jsonPath("$[*].id", hasItem((int) id)));
        }
        mvc.perform(get("/api/tasks").header("Authorization", dave.bearer()))
                .andExpect(jsonPath("$[*].id", not(hasItem((int) id))));

        // the Team page lists it under the assignee too (not under the watcher), and counts it for both
        mvc.perform(get("/api/users/{id}/tasks", bob.id()).header("Authorization", dave.bearer()))
                .andExpect(jsonPath("$[*].id", hasItem((int) id)));
        mvc.perform(get("/api/users/{id}/tasks", carol.id()).header("Authorization", dave.bearer()))
                .andExpect(jsonPath("$[*].id", not(hasItem((int) id))));
        mvc.perform(get("/api/users/task-owners").header("Authorization", dave.bearer()))
                .andExpect(jsonPath("$[?(@.id == %d)].total".formatted(bob.id()), hasItem(1)))
                .andExpect(jsonPath("$[?(@.id == %d)].total".formatted(alice.id()), hasItem(1)))
                .andExpect(jsonPath("$[?(@.id == %d)]".formatted(carol.id())).isEmpty());

        // the assignee works on it, the watcher can't, only the owner deletes
        mvc.perform(patch("/api/tasks/{id}/status", id).header("Authorization", bob.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"IN_PROGRESS\"}"))
                .andExpect(status().isOk());
        mvc.perform(patch("/api/tasks/{id}/status", id).header("Authorization", carol.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"DONE\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/tasks/{id}", id).header("Authorization", bob.bearer()))
                .andExpect(status().isForbidden());

        // the digest goes to the assignee, not to the owner who delegated the task
        LocalDate until = LocalDate.now().plusDays(7);
        assertThat(tasks.findDueForResponsible(bob.id(), TaskStatus.DONE, until)).extracting(Task::getId).contains(id);
        assertThat(tasks.findDueForResponsible(alice.id(), TaskStatus.DONE, until)).extracting(Task::getId)
                .doesNotContain(id);

        // anyone can follow a task; following twice changes nothing
        mvc.perform(put("/api/tasks/{id}/watch", id).header("Authorization", dave.bearer())).andExpect(status().isOk());
        mvc.perform(put("/api/tasks/{id}/watch", id).header("Authorization", dave.bearer()))
                .andExpect(jsonPath("$.watchers.length()").value(2));
        mvc.perform(get("/api/tasks").header("Authorization", dave.bearer()))
                .andExpect(jsonPath("$[*].id", hasItem((int) id)));
        mvc.perform(delete("/api/tasks/{id}/watch", id).header("Authorization", carol.bearer()))
                .andExpect(jsonPath("$.watchers[*].fullName", not(hasItem("Carol"))));
        mvc.perform(get("/api/tasks").header("Authorization", carol.bearer()))
                .andExpect(jsonPath("$[*].id", not(hasItem((int) id))));

        // the assignee can hand the task back (unassign): it then leaves their board
        mvc.perform(put("/api/tasks/{id}", id).header("Authorization", bob.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Review PR\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assignee").doesNotExist());
        mvc.perform(get("/api/tasks").header("Authorization", bob.bearer()))
                .andExpect(jsonPath("$[*].id", not(hasItem((int) id))));

        mvc.perform(post("/api/tasks").header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Ghost\",\"assigneeId\":999999}"))
                .andExpect(status().isBadRequest());

        mvc.perform(delete("/api/tasks/{id}", id).header("Authorization", alice.bearer()))
                .andExpect(status().isNoContent());
    }
}
