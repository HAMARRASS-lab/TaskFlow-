package com.taskflow.assistant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class AssistantDtos {

    private AssistantDtos() {
    }

    public record ChatRequest(@NotBlank @Size(max = 1000) String message) {
    }

    public record ChatResponse(String reply) {
    }
}
