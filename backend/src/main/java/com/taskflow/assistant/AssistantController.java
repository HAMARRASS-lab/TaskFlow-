package com.taskflow.assistant;

import com.taskflow.assistant.AssistantDtos.ChatRequest;
import com.taskflow.assistant.AssistantDtos.ChatResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Admin-only chat bot (ROLE_ADMIN enforced in SecurityConfig via /api/admin/**). */
@RestController
@RequestMapping("/api/admin/assistant")
public class AssistantController {

    private final AssistantService assistant;

    public AssistantController(AssistantService assistant) {
        this.assistant = assistant;
    }

    @PostMapping("/chat")
    public ChatResponse chat(@Valid @RequestBody ChatRequest request) {
        return new ChatResponse(assistant.chat(request.message()));
    }
}
