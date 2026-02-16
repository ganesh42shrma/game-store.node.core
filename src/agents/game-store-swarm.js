"use strict";

const { createSwarm, createHandoffTool } = require("@langchain/langgraph-swarm");
const { MemorySaver } = require("@langchain/langgraph");
const { createGamesQAAgent } = require("./games-qa-agent");
const { createGameCreationAgent } = require("./game-creation-agent");
const { HumanMessage } = require("@langchain/core/messages");
const { BaseCallbackHandler } = require("@langchain/core/callbacks/base");
const llmUsageService = require("../services/llmUsage.service");
const logger = require("../config/logger");

const PROVIDER = process.env.GROQ_API_KEY ? "groq" : "gemini";
const MODEL = process.env.GROQ_API_KEY ? (process.env.GROQ_MODEL || "llama-3.3-70b-versatile") : (process.env.GEMINI_MODEL || "gemini-2.0-flash");

/** Callback handler to log LLM token usage for swarm agents. */
class SwarmUsageLoggingHandler extends BaseCallbackHandler {
  name = "SwarmUsageLoggingHandler";

  handleLLMEnd(output, runId, _parentRunId, _tags, _fields) {
    const usage = output?.llmOutput?.tokenUsage
      || output?.generations?.[0]?.[0]?.message?.response_metadata?.usage
      || output?.generations?.[0]?.[0]?.message?.usage;
    if (usage && typeof usage === "object") {
      const inputTokens = usage.input_tokens ?? usage.promptTokens ?? usage.prompt_tokens ?? usage.inputTokens;
      const outputTokens = usage.output_tokens ?? usage.completionTokens ?? usage.completion_tokens ?? usage.outputTokens;
      const totalTokens = usage.total_tokens ?? usage.totalTokens ?? (inputTokens + outputTokens);
      llmUsageService.recordUsage({
        agentType: "game-store-swarm",
        provider: PROVIDER,
        model: MODEL,
        inputTokens: inputTokens ?? 0,
        outputTokens: outputTokens ?? 0,
        totalTokens: totalTokens ?? 0,
      }).catch((err) => logger.warn("[swarm] Failed to record LLM usage", { error: err?.message }));
    }
  }
}

const usageHandler = new SwarmUsageLoggingHandler();
const checkpointer = new MemorySaver();

/** Create agents with handoff tools for swarm. */
function buildSwarmAgents() {
  const handoffToGameCreation = createHandoffTool({
    agentName: "GameCreation",
    description: "Transfer to game creation when the user explicitly asks to add a new game to the store (e.g. 'Add Elden Ring to the store', 'Add this game'). Only use when user is an admin and wants to add/enrich a game.",
  });
  const handoffToGamesQA = createHandoffTool({
    agentName: "GamesQA",
    description: "Transfer back to the store assistant when done adding a game, or when the user has general questions about games, cart, purchases, or alerts.",
  });

  const gamesQAAgent = createGamesQAAgent({ extraTools: [handoffToGameCreation] });
  const gameCreationAgent = createGameCreationAgent({ extraTools: [handoffToGamesQA] });

  return [gamesQAAgent.graph, gameCreationAgent.graph];
}

const swarmAgents = buildSwarmAgents();
const workflow = createSwarm({
  agents: swarmAgents,
  defaultActiveAgent: "GamesQA",
});
const swarmApp = workflow.compile({ checkpointer });

/**
 * Invoke the swarm (non-streaming).
 * @param {string} userMessage
 * @param {{ userId?: string, threadId?: string, historyMessages?: Array<import("@langchain/core/messages").BaseMessage> }} [options]
 * @returns {Promise<{ messages: Array, content?: string }>}
 */
async function runGameStoreSwarm(userMessage, options = {}) {
  const { userId, threadId, historyMessages = [] } = options;
  const start = Date.now();
  logger.info("[swarm] Invoke start", { messageLength: userMessage?.length, userId: !!userId, threadId: !!threadId });

  const humanContent = userId ? `user_id: ${userId}\n\n${userMessage}` : userMessage;
  const messages = [...historyMessages, new HumanMessage(humanContent)];

  const config = {
    callbacks: [usageHandler],
    recursionLimit: 25,
    configurable: threadId ? { thread_id: threadId } : {},
  };

  const result = await swarmApp.invoke({ messages }, config);
  const durationMs = Date.now() - start;
  const resultMessages = result?.messages ?? [];
  logger.info("[swarm] Invoke complete", { durationMs, messageCount: resultMessages.length });

  const lastAi = [...resultMessages].reverse().find((m) => m._getType?.() === "AIMessage" || m.constructor?.name === "AIMessage");
  const content = lastAi
    ? (typeof lastAi.content === "string" ? lastAi.content : Array.isArray(lastAi.content) ? lastAi.content.map((c) => c?.text ?? c).filter(Boolean).join("") : "")
    : undefined;

  return { messages: resultMessages, content };
}

/**
 * Stream the swarm response.
 * @param {string} userMessage
 * @param {{ userId?: string, threadId?: string, historyMessages?: Array<import("@langchain/core/messages").BaseMessage> }} [options]
 * @returns {AsyncIterable<unknown>}
 */
async function runGameStoreSwarmStream(userMessage, options = {}) {
  const { userId, threadId, historyMessages = [] } = options;
  const start = Date.now();
  logger.info("[swarm] Stream start", { messageLength: userMessage?.length, userId: !!userId, threadId: !!threadId });

  const humanContent = userId ? `user_id: ${userId}\n\n${userMessage}` : userMessage;
  const messages = [...historyMessages, new HumanMessage(humanContent)];

  const config = {
    streamMode: "messages",
    callbacks: [usageHandler],
    recursionLimit: 25,
    configurable: threadId ? { thread_id: threadId } : {},
  };

  const stream = await swarmApp.stream({ messages }, config);
  logger.info("[swarm] Stream ready", { setupMs: Date.now() - start });
  return stream;
}

module.exports = {
  swarmApp,
  runGameStoreSwarm,
  runGameStoreSwarmStream,
};
