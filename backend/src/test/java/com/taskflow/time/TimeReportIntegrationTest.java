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

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Time reports end to end: the query on H2, the JSON report, the CSV download and the date checks. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TimeReportIntegrationTest {

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

    private long createTask(Account owner, String title, String labels) throws Exception {
        String created = mvc.perform(post("/api/tasks").header("Authorization", owner.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"%s\",\"labels\":%s}".formatted(title, labels)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(created).get("id").asLong();
    }

    private void log(Account user, long taskId, int minutes) throws Exception {
        mvc.perform(post("/api/tasks/{id}/time/entries", taskId).header("Authorization", user.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"minutes\":%d}".formatted(minutes)))
                .andExpect(status().isOk());
    }

    @Test
    void reportAndCsvOfAUsersTime() throws Exception {
        Account alice = register("Alice");
        Account bob = register("Bob");
        long docs = createTask(alice, "Write the docs", "[\"docs\"]");
        long build = createTask(alice, "Fix the build", "[]");
        log(alice, docs, 90);
        log(alice, build, 30);
        mvc.perform(post("/api/tasks/{id}/time/start", docs).header("Authorization", alice.bearer()))
                .andExpect(status().isOk());

        // time logged by hand ends now, so may have started yesterday
        String from = LocalDate.now().minusDays(1).toString();
        String to = LocalDate.now().toString();

        // anyone can see anyone's report; the running timer isn't counted
        mvc.perform(get("/api/time/report").header("Authorization", bob.bearer())
                        .param("from", from).param("to", to).param("userId", String.valueOf(alice.id())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalSeconds").value(120 * 60))
                .andExpect(jsonPath("$.entryCount").value(2))
                .andExpect(jsonPath("$.byUser", hasSize(1)))
                .andExpect(jsonPath("$.byUser[0].fullName").value("Alice"))
                .andExpect(jsonPath("$.byLabel[0].label").value("docs"))
                .andExpect(jsonPath("$.byLabel[0].seconds").value(90 * 60))
                .andExpect(jsonPath("$.byLabel[1].label").doesNotExist())
                .andExpect(jsonPath("$.topTasks[0].title").value("Write the docs"));

        String csv = mvc.perform(get("/api/time/report/csv").header("Authorization", bob.bearer())
                        .param("from", from).param("to", to).param("userId", String.valueOf(alice.id())))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("text/csv"))
                .andExpect(header().string("Content-Disposition",
                        "attachment; filename=\"time-%s-to-%s.csv\"".formatted(from, to)))
                .andReturn().getResponse().getContentAsString();
        assertThat(csv.split("\r\n")).hasSize(3);
        assertThat(csv).contains(",90,Alice," + docs + ",Write the docs,docs,");

        mvc.perform(get("/api/time/report").header("Authorization", bob.bearer())
                        .param("from", to).param("to", from))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/time/report").header("Authorization", bob.bearer())
                        .param("from", "yesterday").param("to", to))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/time/report").header("Authorization", bob.bearer()).param("to", to))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/time/report").param("from", from).param("to", to))
                .andExpect(status().isUnauthorized());
    }
}
