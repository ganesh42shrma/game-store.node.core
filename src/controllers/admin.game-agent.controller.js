const { runGameCreationAgent } = require("../agents/game-creation-agent");
const logger = require("../config/logger");

async function createGameByAgent(req, res, next) {
  const gameName = req.body?.gameName ?? req.body?.name ?? req.body?.message;
  try {
    logger.info("[game-agent] Request received", { gameName: gameName?.trim?.() || gameName });
    if (!gameName || typeof gameName !== "string" || !gameName.trim()) {
      logger.warn("[game-agent] Invalid request: missing or empty gameName");
      return res.sendError("Provide game name in body: { gameName: \"Elden Ring\" }", 400);
    }
    const trimmed = gameName.trim();
    const result = await runGameCreationAgent(trimmed);
    // Agent returns state with messages array; last message is the final AI response
    let content = result?.content ?? result?.output;
    if (content === undefined && Array.isArray(result?.messages) && result.messages.length > 0) {
      const last = result.messages[result.messages.length - 1];
      const c = last?.content;
      if (typeof c === "string") content = c;
      else if (Array.isArray(c)) content = c.map((b) => (b && b.text) || b).filter(Boolean).join("\n");
      else content = c;
    }
    if (content === undefined) content = result;
    const messageCount = result?.messages?.length ?? 0;
    logger.info("[game-agent] Request completed", { gameName: trimmed, messageCount, hasContent: !!content });
    res.success({ message: content, raw: result });
  } catch (error) {
    logger.error("[game-agent] Request failed", { gameName: gameName?.trim?.() || gameName, error: error.message });
    next(error);
  }
}

module.exports = { createGameByAgent };