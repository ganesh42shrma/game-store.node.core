"use strict";

const { createSwarm, createHandoffTool } = require("@langchain/langgraph-swarm");
const { MemorySaver } = require("@langchain/langgraph");
const { HumanMessage } = require("@langchain/core/messages");
const { BaseCallbackHandler } = require("@langchain/core/callbacks/base");
const { createProductDiscoveryAgent } = require("./product-discovery-agent");
const { createCommerceAgent } = require("./commerce-agent");
const { createAlertsAgent } = require("./alerts-agent");
const llmUsageService = require("../services/llmUsage.service");
const logger = require("../config/logger");

const PROVIDER = process.env.GROQ_API_KEY ? "groq" : "gemini";
const MODEL = process.env.GROQ_API_KEY ? (process.env.GROQ_MODEL || "llama-3.3-70b-versatile") : (process.env.GEMINI_MODEL || "gemini-2.0-flash");

/** Callback handler to log LLM token usage for user swarm. */
class UserSwarmUsageHandler extends BaseCallbackHandler {
  name = "UserSwarmUsageHandler";

  handleLLMEnd(output, _runId, _parentRunId, _tags, _fields) {
    const usage = output?.llmOutput?.tokenUsage
      || output?.generations?.[0]?.[0]?.message?.response_metadata?.usage
      || output?.generations?.[0]?.[0]?.message?.usage;
    if (usage && typeof usage === "object") {
      const inputTokens = usage.input_tokens ?? usage.promptTokens ?? usage.prompt_tokens ?? usage.inputTokens;
      const outputTokens = usage.output_tokens ?? usage.completionTokens ?? usage.completion_tokens ?? usage.outputTokens;
      const totalTokens = usage.total_tokens ?? usage.totalTokens ?? (inputTokens + outputTokens);
      llmUsageService.recordUsage({
        agentType: "game-store-user-swarm",
        provider: PROVIDER,
        model: MODEL,
        inputTokens: inputTokens ?? 0,
        outputTokens: outputTokens ?? 0,
        totalTokens: totalTokens ?? 0,
      }).catch((err) => logger.warn("[user-swarm] Failed to record LLM usage", { error: err?.message }));
    }
  }
}

const usageHandler = new UserSwarmUsageHandler();
const checkpointer = new MemorySaver();

function buildUserSwarmAgents() {
  const handoffToCommerce = createHandoffTool({
    agentName: "Commerce",
    description: "Transfer to Commerce when user wants to add to cart, buy, checkout, or manage their cart/orders.",
  });
  const handoffToAlerts = createHandoffTool({
    agentName: "Alerts",
    description: "Transfer to Alerts when user wants price/stock notifications (e.g. 'notify when on sale', 'alert when below X').",
  });
  const handoffToProductDiscovery = createHandoffTool({
    agentName: "ProductDiscovery",
    description: "Transfer to ProductDiscovery when user asks about games, recommendations, reviews, or preferences.",
  });

  const productDiscovery = createProductDiscoveryAgent({ extraTools: [handoffToCommerce, handoffToAlerts] });
  const commerce = createCommerceAgent({ extraTools: [handoffToProductDiscovery, handoffToAlerts] });
  const alerts = createAlertsAgent({ extraTools: [handoffToProductDiscovery, handoffToCommerce] });

  return [productDiscovery.graph, commerce.graph, alerts.graph];
}

const swarmAgents = buildUserSwarmAgents();
const workflow = createSwarm({
  agents: swarmAgents,
  defaultActiveAgent: "ProductDiscovery",
});
const userSwarmApp = workflow.compile({ checkpointer });

/**
 * Invoke the user swarm (non-streaming).
 */
async function runUserSwarm(userMessage, options = {}) {
  const { userId, threadId, historyMessages = [] } = options;
  const start = Date.now();
  logger.info("[user-swarm] Invoke start", { messageLength: userMessage?.length, userId: !!userId, threadId: !!threadId });

  const humanContent = userId ? `user_id: ${userId}\n\n${userMessage}` : userMessage;
  const messages = [...historyMessages, new HumanMessage(humanContent)];

  const config = {
    callbacks: [usageHandler],
    recursionLimit: 25,
    configurable: threadId ? { thread_id: threadId } : {},
  };

  const result = await userSwarmApp.invoke({ messages }, config);
  const durationMs = Date.now() - start;
  const resultMessages = result?.messages ?? [];
  logger.info("[user-swarm] Invoke complete", { durationMs, messageCount: resultMessages.length });

  const lastAi = [...resultMessages].reverse().find((m) => m._getType?.() === "AIMessage" || m.constructor?.name === "AIMessage");
  const content = lastAi
    ? (typeof lastAi.content === "string" ? lastAi.content : Array.isArray(lastAi.content) ? lastAi.content.map((c) => c?.text ?? c).filter(Boolean).join("") : "")
    : undefined;

  return { messages: resultMessages, content };
}

/**
 * Stream the user swarm response.
 */
async function runUserSwarmStream(userMessage, options = {}) {
  const { userId, threadId, historyMessages = [] } = options;
  const start = Date.now();
  logger.info("[user-swarm] Stream start", { messageLength: userMessage?.length, userId: !!userId, threadId: !!threadId });

  const humanContent = userId ? `user_id: ${userId}\n\n${userMessage}` : userMessage;
  const messages = [...historyMessages, new HumanMessage(humanContent)];

  const config = {
    streamMode: "messages",
    callbacks: [usageHandler],
    recursionLimit: 25,
    configurable: threadId ? { thread_id: threadId } : {},
  };

  const stream = await userSwarmApp.stream({ messages }, config);
  logger.info("[user-swarm] Stream ready", { setupMs: Date.now() - start });
  return stream;
}

module.exports = {
  userSwarmApp,
  runUserSwarm,
  runUserSwarmStream,
};
