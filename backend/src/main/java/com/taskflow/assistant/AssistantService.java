package com.taskflow.assistant;

import com.taskflow.common.ServiceUnavailableException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** Admin chat bot: answers questions about tasks using {@link TaskStatsTools}. */
@Service
public class AssistantService {

    private static final Logger log = LoggerFactory.getLogger(AssistantService.class);
    static final String NOT_SET = "not-set";

    private static final String SYSTEM_PROMPT = """
            You are the TaskFlow assistant for administrators. Answer questions about tasks (counts by status,
            who has the most tasks to do, ...) using the provided tools; never guess numbers. Statuses are
            TODO ("to do"), IN_PROGRESS ("in progress") and DONE. Reply briefly, in the same language as the
            user's message (English when unsure).
            If a question is not about TaskFlow tasks, say you can only help with task statistics.
            """;

    private final ChatClient chatClient;
    private final boolean configured;

    public AssistantService(ChatClient.Builder builder, TaskStatsTools tools,
                            @Value("${spring.ai.openai.api-key:" + NOT_SET + "}") String apiKey) {
        this.chatClient = builder.defaultSystem(SYSTEM_PROMPT).defaultTools(tools).build();
        this.configured = !apiKey.isBlank() && !NOT_SET.equals(apiKey);
    }

    public String chat(String message) {
        if (!configured) {
            throw new ServiceUnavailableException("The assistant is not configured (set OPENAI_API_KEY)");
        }
        try {
            return chatClient.prompt().user(message).call().content();
        } catch (RuntimeException e) {
            log.warn("Assistant call failed", e);
            throw new ServiceUnavailableException("The assistant is unavailable right now, please try again later");
        }
    }
}
