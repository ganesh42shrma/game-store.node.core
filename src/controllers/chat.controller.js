"use strict";

const { isToolMessage } = require("@langchain/core/messages");
const { runGamesQAAgent, runGamesQAAgentStream, historyToMessages } = require("../agents/games-qa-agent");
const chatMessageService = require("../services/chatMessage.service");
const {
  checkChatGuardrails,
  extractProductIdsFromText,
  extractProductIdsFromToolContent,
  extractOrderAndInvoiceFromToolContent,
  sanitizeMessageForDisplay,
  createStreamTagFilter,
} = require("../utils/chatGuardrails");
const logger = require("../config/logger");

/**
 * Build a log-safe object from an error (message, name, stack, and common provider fields).
 */
function errorToLog(err) {
  if (!err || typeof err !== "object") return { error: String(err) };
  const out = {
    message: err.message,
    name: err.name,
    ...(err.stack && { stack: err.stack }),
  };
  if (err.status !== undefined) out.status = err.status;
  if (err.statusCode !== undefined) out.statusCode = err.statusCode;
  if (err.code !== undefined) out.code = err.code;
  if (err.response !== undefined) {
    const res = err.response;
    out.response = {
      status: res?.status,
      statusText: res?.statusText,
      data: res?.data,
    };
  }
  if (err.body !== undefined) out.body = err.body;
  if (err.error !== undefined) out.errorDetail = err.error;
  if (err.failed_generation !== undefined) out.failed_generation = err.failed_generation;
  if (err.cause && typeof err.cause === "object") {
    out.cause = { message: err.cause.message, name: err.cause.name, ...(err.cause.body !== undefined && { body: err.cause.body }) };
  }
  return out;
}

/** True when Groq returns 400 tool_use_failed (model emitted wrong tool format). Safe to retry once. */
function isGroqToolUseFailed(err) {
  if (!err || typeof err !== "object") return false;
  const status = err.status ?? err.statusCode ?? err.error?.status_code ?? err.response?.status;
  const msg = String(err.message || err.error?.message || err.response?.data?.error?.message || "");
  const code = err.error?.code ?? err.cause?.body?.error?.code ?? err.response?.data?.error?.code;
  if (status === 400 && (code === "tool_use_failed" || msg.includes("tool_use_failed") || msg.includes("tool call validation failed") || msg.includes("failed_generation"))) return true;
  return false;
}

function getMessageContent(msg) {
  if (!msg || typeof msg !== "object") return "";
  const c = msg.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map((b) => (b && b.text) || b).filter(Boolean).join("");
  return String(c ?? "");
}

function getMessageFromChunk(chunk) {
  if (Array.isArray(chunk) && chunk.length >= 2 && chunk[1] === "messages" && chunk[2] && chunk[2].length >= 1) {
    return chunk[2][0];
  }
  if (Array.isArray(chunk) && chunk.length >= 1 && chunk[0] && typeof chunk[0].content !== "undefined") {
    return chunk[0];
  }
  return null;
}

function wantsStream(req) {
  const accept = (req.headers && req.headers.accept) || "";
  if (accept.includes("text/event-stream")) return true;
  const streamParam = req.query?.stream || req.query?.streaming;
  return streamParam === "true" || streamParam === "1";
}

async function chat(req, res, next) {
  const message = req.body?.message ?? req.body?.content ?? req.body?.text;
  try {
    const guard = checkChatGuardrails(message);
    if (!guard.allowed) {
      logger.warn("[chat] Request blocked by guardrails", { reason: guard.reason });
      return res.sendError(guard.reason, 400);
    }
    const trimmed = message.trim();
    const requestStart = Date.now();
    const requestTs = new Date().toISOString();
    const streamMode = wantsStream(req);
    logger.info("[chat] Request start", {
      ts: requestTs,
      userId: req.user?.id,
      messageLength: trimmed.length,
      stream: streamMode,
    });

    const userId = req.user?.id ? String(req.user.id) : undefined;
    const threadId = req.body?.thread_id ?? (userId ? `${userId}-chat` : undefined);

    let historyMessages = [];
    if (userId && threadId) {
      const history = await chatMessageService.getHistory(userId, threadId, { limit: 20 });
      historyMessages = historyToMessages(history);
      await chatMessageService.saveMessage(userId, threadId, "user", trimmed);
    }

    if (streamMode) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders && res.flushHeaders();

      let answerContent = "";
      const thinkingBuffer = [];
      let seenToolMessage = false;
      const streamTagFilter = createStreamTagFilter((chunk) => sendEvent({ type: "chunk", content: chunk }));
      const productIdsFromTools = new Set();
      let orderIdFromTools = null;
      let invoiceIdFromTools = null;

      const sendEvent = (obj) => {
        res.write(`data: ${JSON.stringify(obj)}\n\n`);
        if (res.flush) res.flush();
      };

      try {
        let streamErr = null;
        const maxAttempts = 2;
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          try {
            if (attempt > 1) {
              answerContent = "";
              thinkingBuffer.length = 0;
              streamTagFilter.reset();
              productIdsFromTools.clear();
              orderIdFromTools = null;
              invoiceIdFromTools = null;
              seenToolMessage = false;
            }
            const streamInvokeStart = Date.now();
            logger.info("[chat] Agent stream invoke start", { ts: new Date().toISOString(), userId: !!userId, threadId, attempt });
            const stream = await runGamesQAAgentStream(trimmed, { userId, threadId, historyMessages });
            const streamConsumeStart = Date.now();
            logger.info("[chat] Agent stream consume start", { ts: new Date().toISOString(), setupMs: streamConsumeStart - streamInvokeStart });
            for await (const chunk of stream) {
              const msg = getMessageFromChunk(chunk);
              if (!msg) continue;

              if (isToolMessage(msg)) {
                const toolContent = getMessageContent(msg);
                if (toolContent) {
                  for (const id of extractProductIdsFromToolContent(toolContent)) productIdsFromTools.add(id);
                  const { orderId, invoiceId } = extractOrderAndInvoiceFromToolContent(toolContent);
                  if (orderId) orderIdFromTools = orderId;
                  if (invoiceId) invoiceIdFromTools = invoiceId;
                }
                if (thinkingBuffer.length > 0) {
                  const thinkingText = thinkingBuffer.join("").trim();
                  if (thinkingText) sendEvent({ type: "thinking", content: thinkingText });
                  thinkingBuffer.length = 0;
                }
                seenToolMessage = true;
                continue;
              }

              const content = getMessageContent(msg);
              if (!content) continue;

              if (seenToolMessage) {
                answerContent += content;
                streamTagFilter.push(content);
              } else {
                thinkingBuffer.push(content);
              }
            }

            const streamConsumeMs = Date.now() - streamConsumeStart;
            logger.info("[chat] Agent stream consume end", { ts: new Date().toISOString(), durationMs: streamConsumeMs });

            if (thinkingBuffer.length > 0) {
              const remainder = thinkingBuffer.join("");
              answerContent += remainder;
              streamTagFilter.push(remainder);
            }
            streamTagFilter.flush();

            const productIdsFromText = extractProductIdsFromText(answerContent);
            const productIds = [...new Set([...productIdsFromTools, ...productIdsFromText])];
            const sanitizedMessage = sanitizeMessageForDisplay(answerContent);
            if (userId && threadId) {
              await chatMessageService.saveMessage(userId, threadId, "assistant", sanitizedMessage);
            }
            const donePayload = { type: "done", productIds, message: sanitizedMessage };
            if (orderIdFromTools) donePayload.orderId = orderIdFromTools;
            if (invoiceIdFromTools) donePayload.invoiceId = invoiceIdFromTools;
            if (threadId) donePayload.thread_id = threadId;
            if (userId) donePayload.user_id = userId;
            sendEvent(donePayload);
            logger.info("[chat] Request complete", { ts: new Date().toISOString(), durationMs: Date.now() - requestStart, stream: true });
            streamErr = null;
            break;
          } catch (e) {
            streamErr = e;
            if (attempt < maxAttempts && isGroqToolUseFailed(e)) {
              logger.warn("[chat] Groq tool_use_failed, retrying once", { attempt, failed_generation: e?.error?.failed_generation ?? e?.failed_generation });
              continue;
            }
            throw e;
          }
        }
        if (streamErr) throw streamErr;
      } catch (streamErr) {
        if (isGroqToolUseFailed(streamErr)) {
          logger.warn("[chat] Stream failed with Groq tool_use_failed, falling back to non-streaming", {
            durationMs: Date.now() - requestStart,
            failed_generation: streamErr?.error?.failed_generation ?? streamErr?.failed_generation,
          });
          try {
            const fallbackStart = Date.now();
            const result = await runGamesQAAgent(trimmed, { userId, threadId, historyMessages });
            let content = result?.content ?? result?.output;
            if (content === undefined && Array.isArray(result?.messages) && result.messages.length > 0) {
              const aiMessages = result.messages.filter((m) => m && typeof m === "object" && !isToolMessage(m) && (m.content !== undefined || m.text));
              const lastAi = aiMessages.length > 0 ? aiMessages[aiMessages.length - 1] : result.messages[result.messages.length - 1];
              const c = lastAi?.content ?? lastAi?.text;
              if (typeof c === "string") content = c;
              else if (Array.isArray(c)) content = c.map((b) => (b && b.text) || b).filter(Boolean).join("\n");
              else content = c;
            }
            if (content === undefined) content = "";
            const productIdsFromText = extractProductIdsFromText(content);
            const productIdsFromToolsSet = new Set();
            let orderIdFallback = null;
            let invoiceIdFallback = null;
            if (Array.isArray(result?.messages)) {
              for (const m of result.messages) {
                if (m && isToolMessage(m)) {
                  const c = getMessageContent(m);
                  if (c) {
                    for (const id of extractProductIdsFromToolContent(c)) productIdsFromToolsSet.add(id);
                    const { orderId, invoiceId } = extractOrderAndInvoiceFromToolContent(c);
                    if (orderId) orderIdFallback = orderId;
                    if (invoiceId) invoiceIdFallback = invoiceId;
                  }
                }
              }
            }
            const productIdsFallback = [...new Set([...productIdsFromToolsSet, ...productIdsFromText])];
            const sanitizedFallback = sanitizeMessageForDisplay(content);
            if (userId && threadId) {
              await chatMessageService.saveMessage(userId, threadId, "assistant", sanitizedFallback);
            }
            sendEvent({ type: "chunk", content: sanitizedFallback });
            const donePayload = { type: "done", productIds: productIdsFallback, message: sanitizedFallback };
            if (orderIdFallback) donePayload.orderId = orderIdFallback;
            if (invoiceIdFallback) donePayload.invoiceId = invoiceIdFallback;
            if (threadId) donePayload.thread_id = threadId;
            if (userId) donePayload.user_id = userId;
            sendEvent(donePayload);
            logger.info("[chat] Fallback non-stream complete", { durationMs: Date.now() - fallbackStart });
          } catch (fallbackErr) {
            logger.error("[chat] Fallback non-stream failed", { ...errorToLog(fallbackErr) });
            sendEvent({ type: "error", message: fallbackErr?.message || "Stream failed" });
          }
        } else {
          logger.error("[chat] Stream failed", {
            durationMs: Date.now() - requestStart,
            ...errorToLog(streamErr),
          });
          sendEvent({ type: "error", message: streamErr?.message || "Stream failed" });
        }
      }
      return res.end();
    }

    const agentStart = Date.now();
    logger.info("[chat] Agent invoke start", { ts: new Date().toISOString(), userId: !!userId, threadId });
    const result = await runGamesQAAgent(trimmed, { userId, threadId, historyMessages });
    logger.info("[chat] Agent invoke done", { ts: new Date().toISOString(), durationMs: Date.now() - agentStart });
    let content = result?.content ?? result?.output;
    if (content === undefined && Array.isArray(result?.messages) && result.messages.length > 0) {
      const aiMessages = result.messages.filter((m) => m && typeof m === "object" && !isToolMessage(m) && (m.content !== undefined || m.text));
      const lastAi = aiMessages.length > 0 ? aiMessages[aiMessages.length - 1] : result.messages[result.messages.length - 1];
      const c = lastAi?.content ?? lastAi?.text;
      if (typeof c === "string") content = c;
      else if (Array.isArray(c)) content = c.map((b) => (b && b.text) || b).filter(Boolean).join("\n");
      else content = c;
    }
    if (content === undefined) content = "";
    const productIdsFromText = extractProductIdsFromText(content);
    const productIdsFromTools = new Set();
    let orderIdFromTools = null;
    let invoiceIdFromTools = null;
    if (Array.isArray(result?.messages)) {
      for (const m of result.messages) {
        if (m && isToolMessage(m)) {
          const c = getMessageContent(m);
          if (c) {
            for (const id of extractProductIdsFromToolContent(c)) productIdsFromTools.add(id);
            const { orderId, invoiceId } = extractOrderAndInvoiceFromToolContent(c);
            if (orderId) orderIdFromTools = orderId;
            if (invoiceId) invoiceIdFromTools = invoiceId;
          }
        }
      }
    }
    const productIds = [...new Set([...productIdsFromTools, ...productIdsFromText])];
    const sanitizedMessage = sanitizeMessageForDisplay(content);
    if (userId && threadId) {
      await chatMessageService.saveMessage(userId, threadId, "assistant", sanitizedMessage);
    }
    logger.info("[chat] Request complete", { ts: new Date().toISOString(), durationMs: Date.now() - requestStart, stream: false });
    const data = { message: sanitizedMessage, productIds };
    if (orderIdFromTools) data.orderId = orderIdFromTools;
    if (invoiceIdFromTools) data.invoiceId = invoiceIdFromTools;
    if (threadId) data.thread_id = threadId;
    if (userId) data.user_id = userId;
    res.success(data);
  } catch (error) {
    logger.error("[chat] Request failed", {
      durationMs: Date.now() - requestStart,
      ...errorToLog(error),
    });
    next(error);
  }
}

async function getHistory(req, res, next) {
  try {
    const userId = req.user?.id ? String(req.user.id) : null;
    if (!userId) {
      return res.sendError("Authentication required", 401);
    }
    const threadId = req.query.thread_id ?? `${userId}-chat`;
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const messages = await chatMessageService.getHistory(userId, threadId, { limit });
    res.success({ messages, thread_id: threadId });
  } catch (error) {
    next(error);
  }
}

async function getThreads(req, res, next) {
  try {
    const userId = req.user?.id ? String(req.user.id) : null;
    if (!userId) {
      return res.sendError("Authentication required", 401);
    }
    const threads = await chatMessageService.getThreads(userId);
    res.success({ threads });
  } catch (error) {
    next(error);
  }
}

module.exports = { chat, getHistory, getThreads };
