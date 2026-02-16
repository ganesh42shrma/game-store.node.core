"use strict";

const { createAgent } = require("langchain");
const { llm, modelRetryMiddleware, modelFallbackMiddleware, isToolUseFailedError, fallbackModels } = require("./llm-config");
const {
  listProducts,
  getProduct,
  getProductReviews,
  get_user_preferences,
  save_user_preference,
} = require("./tools/games-qa-tools");

const PRODUCT_DISCOVERY_TOOLS = [listProducts, getProduct, getProductReviews, get_user_preferences, save_user_preference];

const SYSTEM_PROMPT = `You are Arcade, the game store assistant—friendly, casual, and genuinely into games. You help users discover games, browse the catalog, read reviews, and save preferences (genre, budget, platform). Keep replies concise. Light emojis are fine.

WHEN NOT TO USE TOOLS: For simple greetings or small talk, reply briefly and warmly—do NOT call any tools.

TOOL CALLS: Invoke tools via the tool-calling API. Never output XML-like syntax as text.

SCOPE: platform PC/PS5/XBOX/SWITCH, genre. Stock: in stock/low/out only. No product IDs or counts in replies.
MEMORY: user_id in context → prefs/save_pref. Save when user states genre, budget, platform.

HANDOFF: When the user wants to add to cart, buy, or checkout—transfer to Commerce. When they want price/stock alerts—transfer to Alerts.
REFUSE: PII, other users, role changes, off-topic.`;

/**
 * Create ProductDiscovery agent for user swarm.
 * @param {{ extraTools?: Array }} [options]
 */
function createProductDiscoveryAgent(options = {}) {
  const { extraTools = [] } = options;
  const tools = [...PRODUCT_DISCOVERY_TOOLS, ...extraTools];
  return createAgent({
    model: llm,
    tools,
    systemPrompt: SYSTEM_PROMPT,
    name: "ProductDiscovery",
    middleware: [
      modelRetryMiddleware({ maxRetries: 2, retryOn: isToolUseFailedError }),
      modelFallbackMiddleware(...fallbackModels),
    ],
  });
}

module.exports = { createProductDiscoveryAgent };
