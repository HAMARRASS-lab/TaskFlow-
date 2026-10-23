package com.taskflow.reminder;

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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Reminders end to end: Flyway schema on H2, once per due date, again after a reschedule, never for done tasks. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DueDateReminderIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private DueDateReminderService reminders;

    private record Account(long id, String bearer) {
    }

    private Account register(String name) throws Exception {
        String email = "%s-%s@test.com".formatted(name.toLowerCase(), UUID.randomUUID());
        String body = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"password123\",\"fullName\":\"%s\"}"
                                .formatted(email, name)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        JsonNode node = json.readTree(body);
        return new Account(node.get("user").get("id").asLong(), "Bearer " + node.get("token").asText());
    }

    private long createTask(Account owner, String body) throws Exception {
        String created = mvc.perform(post("/api/tasks").header("Authorization", owner.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(created).get("id").asLong();
    }

    @Test
    void remindsTheAssigneeOnceTheDayBeforeAndOnceWhenOverdue() throws Exception {
        Account alice = register("Alice");
        Account bob = register("Bob");
        LocalDate today = LocalDate.of(2031, 3, 10);
        LocalDate due = today.plusDays(1);
        long taskId = createTask(alice, "{\"title\":\"Ship v2\",\"dueDate\":\"%s\",\"assigneeId\":%d}"
                .formatted(due, bob.id()));
        createTask(alice, "{\"title\":\"Already done\",\"status\":\"DONE\",\"dueDate\":\"%s\",\"assigneeId\":%d}"
                .formatted(due, bob.id()));
        mvc.perform(post("/api/notifications/read-all").header("Authorization", bob.bearer()));

        reminders.remind(today);
        reminders.remind(today); // a second run the same day sends nothing new

        mvc.perform(get("/api/notifications/unread-count").header("Authorization", bob.bearer()))
                .andExpect(jsonPath("$.count").value(1));
        mvc.perform(get("/api/notifications").header("Authorization", bob.bearer()))
                .andExpect(jsonPath("$[0].type").value("TASK_DUE_SOON"))
                .andExpect(jsonPath("$[0].taskId").value(taskId))
                .andExpect(jsonPath("$[0].subject").value("Ship v2"))
                .andExpect(jsonPath("$[0].actor").doesNotExist());
        // the owner isn't reminded of a task someone else is responsible for
        mvc.perform(get("/api/notifications/unread-count").header("Authorization", alice.bearer()))
                .andExpect(jsonPath("$.count").value(0));

        reminders.remind(due.plusDays(1));
        reminders.remind(due.plusDays(2));

        mvc.perform(get("/api/notifications/unread-count").header("Authorization", bob.bearer()))
                .andExpect(jsonPath("$.count").value(2));
        mvc.perform(get("/api/notifications").header("Authorization", bob.bearer()))
                .andExpect(jsonPath("$[0].type").value("TASK_OVERDUE"));

        // rescheduled: reminded again for the new due date
        LocalDate newDue = due.plusDays(5);
        mvc.perform(put("/api/tasks/{id}", taskId).header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Ship v2\",\"status\":\"IN_PROGRESS\",\"priority\":\"HIGH\",\"dueDate\":\"%s\",\"assigneeId\":%d}"
                                .formatted(newDue, bob.id())))
                .andExpect(status().isOk());
        reminders.remind(newDue.minusDays(1));

        mvc.perform(get("/api/notifications/unread-count").header("Authorization", bob.bearer()))
                .andExpect(jsonPath("$.count").value(3));
    }
}
