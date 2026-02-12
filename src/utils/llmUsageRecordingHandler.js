"use strict";

const { BaseCallbackHandler } = require("@langchain/core/callbacks/base");
const llmUsageService = require("../services/llmUsage.service");
const logger = require("../config/logger");

/**
 * Callback handler that persists LLM token usage to DB for analytics.
 * Create one per agent type; provider/model are derived from env.
 */
function createUsageRecordingHandler(agentType) {
  const provider = process.env.GROQ_API_KEY ? "groq" : "gemini";
  const model = process.env.GROQ_API_KEY
    ? (process.env.GROQ_MODEL || "llama-3.3-70b-versatile")
    : (process.env.GEMINI_MODEL || "gemini-2.0-flash");

  return class UsageRecordingHandler extends BaseCallbackHandler {
    name = "UsageRecordingHandler";

    handleLLMEnd(output, _runId, _parentRunId, _tags, metadata, _fields) {
      const usage = output?.llmOutput?.tokenUsage
        || output?.generations?.[0]?.[0]?.message?.response_metadata?.usage
        || output?.generations?.[0]?.[0]?.message?.usage;
      if (!usage || typeof usage !== "object") return;

      const inputTokens = usage.input_tokens ?? usage.promptTokens ?? usage.prompt_tokens ?? usage.inputTokens ?? 0;
      const outputTokens = usage.output_tokens ?? usage.completionTokens ?? usage.completion_tokens ?? usage.outputTokens ?? 0;
      const totalTokens = usage.total_tokens ?? usage.totalTokens ?? (inputTokens + outputTokens);
      const userId = metadata?.configurable?.user_id ?? null;

      llmUsageService
        .recordUsage({
          agentType,
          provider,
          model,
          inputTokens,
          outputTokens,
          totalTokens,
          userId,
        })
        .catch((err) => logger.warn("[llm-usage] Failed to record", { agentType, error: err?.message }));
    }
  };
}

module.exports = { createUsageRecordingHandler };
