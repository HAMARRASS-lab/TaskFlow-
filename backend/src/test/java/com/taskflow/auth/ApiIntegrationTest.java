package com.taskflow.auth;

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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Full stack test: Flyway migrations on H2 (PostgreSQL mode), Spring Security + JWT, JPA. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ApiIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Test
    void rejectsUnauthenticatedAccess() throws Exception {
        mvc.perform(get("/api/tasks")).andExpect(status().isUnauthorized());
    }

    @Test
    void registerLoginAndManageTasks() throws Exception {
        String email = "user-" + UUID.randomUUID() + "@test.com";
        String credentials = """
                {"email":"%s","password":"password123","fullName":"Test User"}""".formatted(email);

        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(credentials))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.user.email").value(email));

        // duplicate registration
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(credentials))
                .andExpect(status().isConflict());

        String loginBody = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"password123\"}".formatted(email)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String bearer = "Bearer " + json.readTree(loginBody).get("token").asText();

        String created = mvc.perform(post("/api/tasks").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Ship v1\",\"priority\":\"HIGH\",\"dueDate\":\"2026-12-31\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("TODO"))
                .andReturn().getResponse().getContentAsString();
        JsonNode task = json.readTree(created);
        long id = task.get("id").asLong();

        mvc.perform(patch("/api/tasks/{id}/status", id).header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"DONE\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DONE"));

        mvc.perform(get("/api/tasks").param("status", "DONE").header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));

        mvc.perform(delete("/api/tasks/{id}", id).header("Authorization", bearer))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/tasks/{id}", id).header("Authorization", bearer))
                .andExpect(status().isNotFound());
    }

    @Test
    void rejectsInvalidPayload() throws Exception {
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"not-an-email\",\"password\":\"short\",\"fullName\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.email").exists());
    }

    @Test
    void wrongPasswordReturns401() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"nobody@test.com\",\"password\":\"whatever1\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void manageMeetingsInCalendar() throws Exception {
        String email = "meet-" + UUID.randomUUID() + "@test.com";
        String registered = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"password123\",\"fullName\":\"Meet User\"}"
                                .formatted(email)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String bearer = "Bearer " + json.readTree(registered).get("token").asText();

        String created = mvc.perform(post("/api/meetings").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Kick-off","location":"Room A","startAt":"2026-11-02T09:00:00",
                                 "endAt":"2026-11-02T10:00:00","participants":["bob@test.com"]}"""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.participants[0].participant").value("bob@test.com"))
                .andExpect(jsonPath("$.organizedByMe").value(true))
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(created).get("id").asLong();

        // overlapping slot is rejected
        mvc.perform(post("/api/meetings").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Clash\",\"startAt\":\"2026-11-02T09:30:00\",\"endAt\":\"2026-11-02T11:00:00\"}"))
                .andExpect(status().isConflict());

        // end before start is rejected
        mvc.perform(post("/api/meetings").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Bad\",\"startAt\":\"2026-11-03T10:00:00\",\"endAt\":\"2026-11-03T09:00:00\"}"))
                .andExpect(status().isBadRequest());

        mvc.perform(get("/api/meetings").header("Authorization", bearer)
                        .param("from", "2026-11-01T00:00:00").param("to", "2026-12-01T00:00:00"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));

        mvc.perform(get("/api/meetings").header("Authorization", bearer)
                        .param("from", "2026-12-01T00:00:00").param("to", "2027-01-01T00:00:00"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        mvc.perform(put("/api/meetings/{id}", id).header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Kick-off v2\",\"startAt\":\"2026-11-02T09:00:00\",\"endAt\":\"2026-11-02T10:30:00\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Kick-off v2"))
                .andExpect(jsonPath("$.participants.length()").value(0));

        mvc.perform(delete("/api/meetings/{id}", id).header("Authorization", bearer))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/meetings/{id}", id).header("Authorization", bearer))
                .andExpect(status().isNotFound());
    }

    @Test
    void sharesMeetingsWithInvitedUsers() throws Exception {
        String suffix = UUID.randomUUID().toString();
        String organizer = register("org-" + suffix + "@test.com", "Olivia Org");
        String inviteeEmail = "inv-" + suffix + "@test.com";
        String invitee = register(inviteeEmail, "Ivan Invitee");
        String outsider = register("out-" + suffix + "@test.com", "Oscar Out");

        String created = mvc.perform(post("/api/meetings").header("Authorization", organizer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Planning","startAt":"2027-03-01T14:00:00","endAt":"2027-03-01T15:00:00",
                                 "participants":["%s","Guest without account"]}""".formatted(inviteeEmail.toUpperCase())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.participants[0].fullName").value("Ivan Invitee"))
                .andExpect(jsonPath("$.participants[1].fullName").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(created).get("id").asLong();

        // the invitee sees it in their calendar and in their pending invitations
        mvc.perform(get("/api/meetings").header("Authorization", invitee)
                        .param("from", "2027-03-01T00:00:00").param("to", "2027-03-02T00:00:00"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].organizedByMe").value(false))
                .andExpect(jsonPath("$[0].myStatus").value("PENDING"))
                .andExpect(jsonPath("$[0].organizer.fullName").value("Olivia Org"));
        mvc.perform(get("/api/meetings/invitations").header("Authorization", invitee))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));

        // other users don't see it at all
        mvc.perform(get("/api/meetings/{id}", id).header("Authorization", outsider))
                .andExpect(status().isNotFound());

        // the invitee can't edit or delete, only answer
        mvc.perform(delete("/api/meetings/{id}", id).header("Authorization", invitee))
                .andExpect(status().isForbidden());
        mvc.perform(patch("/api/meetings/{id}/response", id).header("Authorization", invitee)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"ACCEPTED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.myStatus").value("ACCEPTED"));
        mvc.perform(get("/api/meetings/invitations").header("Authorization", invitee))
                .andExpect(jsonPath("$.length()").value(0));

        // the accepted meeting now blocks the invitee's own agenda
        mvc.perform(post("/api/meetings").header("Authorization", invitee)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Clash\",\"startAt\":\"2027-03-01T14:30:00\",\"endAt\":\"2027-03-01T16:00:00\"}"))
                .andExpect(status().isConflict());

        // the organizer sees the answer
        mvc.perform(get("/api/meetings/{id}", id).header("Authorization", organizer))
                .andExpect(jsonPath("$.participants[0].status").value("ACCEPTED"));
    }

    @Test
    void listsTaskOwnersAndTheirTasksReadOnly() throws Exception {
        String suffix = UUID.randomUUID().toString();
        String author = register("author-" + suffix + "@test.com", "Ada Author " + suffix);
        String viewer = register("viewer-" + suffix + "@test.com", "Victor Viewer " + suffix);

        String created = mvc.perform(post("/api/tasks").header("Authorization", author)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Shared work\",\"status\":\"DONE\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long taskId = json.readTree(created).get("id").asLong();

        // the author is listed with counts; the viewer (no tasks) is not
        String owners = mvc.perform(get("/api/users/task-owners").header("Authorization", viewer))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode ada = null;
        for (JsonNode o : json.readTree(owners)) {
            if (o.get("fullName").asText().equals("Ada Author " + suffix)) ada = o;
            if (o.get("fullName").asText().equals("Victor Viewer " + suffix)) throw new AssertionError("viewer listed");
        }
        org.assertj.core.api.Assertions.assertThat(ada).isNotNull();
        org.assertj.core.api.Assertions.assertThat(ada.get("done").asLong()).isEqualTo(1);
        org.assertj.core.api.Assertions.assertThat(ada.get("total").asLong()).isEqualTo(1);

        // the viewer can read the author's tasks, with a status filter
        mvc.perform(get("/api/users/{id}/tasks", ada.get("id").asLong()).header("Authorization", viewer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("Shared work"));
        mvc.perform(get("/api/users/{id}/tasks", ada.get("id").asLong()).header("Authorization", viewer)
                        .param("status", "TODO"))
                .andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/users/{id}/tasks", 999_999).header("Authorization", viewer))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/users/task-owners")).andExpect(status().isUnauthorized());

        // ...but still can't modify them
        mvc.perform(delete("/api/tasks/{id}", taskId).header("Authorization", viewer))
                .andExpect(status().isNotFound());
    }

    @Test
    void adminManagesUsersAndAssignsTasks() throws Exception {
        String suffix = UUID.randomUUID().toString();
        String admin = register("ADMIN@test.com", "Root Admin");
        String user = register("plain-" + suffix + "@test.com", "Paula Plain");

        // the configured email is promoted on registration; others stay USER and are kept out
        mvc.perform(get("/api/auth/me").header("Authorization", admin))
                .andExpect(jsonPath("$.role").value("ADMIN"));
        mvc.perform(get("/api/admin/users").header("Authorization", user)).andExpect(status().isForbidden());

        String created = mvc.perform(post("/api/admin/users").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"New-%s@test.com\",\"password\":\"password123\",\"fullName\":\"Nina New\"}"
                                .formatted(suffix)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("new-" + suffix + "@test.com"))
                .andExpect(jsonPath("$.role").value("USER"))
                .andReturn().getResponse().getContentAsString();
        long ninaId = json.readTree(created).get("id").asLong();

        mvc.perform(put("/api/admin/users/{id}", ninaId).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"nina-%s@test.com\",\"fullName\":\"Nina Lead\",\"role\":\"ADMIN\",\"password\":\"\"}"
                                .formatted(suffix)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("Nina Lead"))
                .andExpect(jsonPath("$.role").value("ADMIN"));
        // the password was kept
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"nina-%s@test.com\",\"password\":\"password123\"}".formatted(suffix)))
                .andExpect(status().isOk());

        // assign a new task to Nina, then move it to Paula
        String task = mvc.perform(post("/api/admin/users/{id}/tasks", ninaId).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Assigned work\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long taskId = json.readTree(task).get("id").asLong();
        long paulaId = json.readTree(mvc.perform(get("/api/auth/me").header("Authorization", user))
                .andReturn().getResponse().getContentAsString()).get("id").asLong();

        mvc.perform(patch("/api/admin/tasks/{id}/assignee", taskId).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"userId\":%d}".formatted(paulaId)))
                .andExpect(status().isOk());
        mvc.perform(get("/api/tasks/{id}", taskId).header("Authorization", user))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Assigned work"));

        // an admin can't delete themselves; deleting a user removes their tasks
        long adminId = json.readTree(mvc.perform(get("/api/auth/me").header("Authorization", admin))
                .andReturn().getResponse().getContentAsString()).get("id").asLong();
        mvc.perform(delete("/api/admin/users/{id}", adminId).header("Authorization", admin))
                .andExpect(status().isBadRequest());
        mvc.perform(delete("/api/admin/users/{id}", paulaId).header("Authorization", admin))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/tasks").header("Authorization", user)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/users/{id}/tasks", paulaId).header("Authorization", admin))
                .andExpect(status().isNotFound());
    }

    private String register(String email, String fullName) throws Exception {
        String body = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"password123\",\"fullName\":\"%s\"}"
                                .formatted(email, fullName)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(body).get("token").asText();
    }
}
