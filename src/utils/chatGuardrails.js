"use strict";

/**
 * Blocked phrases (case-insensitive) that indicate prompt injection, PII fishing, or off-topic attacks.
 * If any of these appear in the user message, we reject before calling the LLM.
 */
const BLOCKED_PATTERNS = [
  /ignore\s+(previous|above|all)\s+instructions?/i,
  /disregard\s+(your|the)\s+(instructions?|prompt|rules?)/i,
  /you\s+are\s+now\s+/i,
  /pretend\s+you\s+are/i,
  /act\s+as\s+(a\s+)?(admin|system|root)/i,
  /system\s+prompt/i,
  /reveal\s+(your|the)\s+prompt/i,
  /what\s+are\s+your\s+instructions?/i,
  /print\s+(env|process\.env)/i,
  /process\.env/i,
  /\.env\s+file/i,
  /password|secret\s+key|api\s+key|jwt|token\s+please/i,
  /other\s+users?\s+(email|address|order|data)/i,
  /list\s+(all\s+)?users?/i,
  /show\s+(me\s+)?(everyone|all)\s+(customers?|users?)/i,
  /database\s+dump|sql\s+injection/i,
  /<script|javascript:|eval\s*\(/i,
  /\badmin\s+(panel|portal|access)\b/i,
];

const MAX_MESSAGE_LENGTH = 2000;

/**
 * Returns { allowed: true } or { allowed: false, reason: string }.
 */
function checkChatGuardrails(message) {
  if (typeof message !== "string") {
    return { allowed: false, reason: "Message must be a string." };
  }
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return { allowed: false, reason: "Message cannot be empty." };
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { allowed: false, reason: "Message is too long." };
  }
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { allowed: false, reason: "Your message was blocked by our safety filters. Please ask only about games, prices, stock, and reviews." };
    }
  }
  return { allowed: true };
}

const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;

function isValidObjectId(s) {
  return typeof s === "string" && OBJECT_ID_REGEX.test(s);
}

/**
 * Extract product IDs from tool message content (JSON from list_products, product, reviews).
 * Returns array of unique 24-char hex IDs.
 */
function extractProductIdsFromToolContent(content) {
  if (typeof content !== "string") return [];
  const ids = new Set();
  try {
    const data = JSON.parse(content);
    if (!data || typeof data !== "object") return [];
    if (data.id && isValidObjectId(data.id)) ids.add(data.id);
    if (data.productId && isValidObjectId(data.productId)) ids.add(data.productId);
    if (Array.isArray(data.products)) {
      for (const p of data.products) {
        if (p && p.id && isValidObjectId(p.id)) ids.add(p.id);
      }
    }
  } catch (_) {
    // not JSON or invalid
  }
  return [...ids];
}

/**
 * Extract orderId and invoiceId from tool content (e.g. buy_for_me success response).
 * Returns { orderId: string|null, invoiceId: string|null }.
 */
function extractOrderAndInvoiceFromToolContent(content) {
  if (typeof content !== "string") return { orderId: null, invoiceId: null };
  try {
    const data = JSON.parse(content);
    if (!data || typeof data !== "object" || !data.success) return { orderId: null, invoiceId: null };
    const orderId = data.orderId && isValidObjectId(data.orderId) ? data.orderId : null;
    const invoiceId = data.invoiceId && isValidObjectId(data.invoiceId) ? data.invoiceId : null;
    return { orderId, invoiceId };
  } catch (_) {
    return { orderId: null, invoiceId: null };
  }
}

/**
 * Extract product IDs mentioned in agent response (e.g. "product id: 698c2768a7dee4fffd793738").
 * Returns array of unique MongoDB ObjectId-like strings (24 hex chars).
 */
function extractProductIdsFromText(text) {
  if (typeof text !== "string") return [];
  const idPattern = /product\s*id:\s*([a-fA-F0-9]{24})/g;
  const ids = new Set();
  let m;
  while ((m = idPattern.exec(text)) !== null) {
    ids.add(m[1]);
  }
  return [...ids];
}

/** Tool names that may appear in malformed XML-style output. */
const TOOL_TAG_NAMES = "create_alert|list_products|buy_for_me|add_to_cart|get_product|get_user_addresses|get_user_cart|get_payment_options";

/** Friendly replacements when model emits tool call as text instead of invoking the tool. */
const MALFORMED_TAG_REPLACEMENTS = {
  create_alert: "I've created your alert. You'll be notified when it goes on sale.",
  buy_for_me: "I've processed your purchase.",
  add_to_cart: "I've added that to your cart.",
};

/** Strip malformed tool output like <create_alert>{"json"}</create_alert> - model emits as text instead of calling tool. */
function stripMalformedToolTags(text) {
  if (typeof text !== "string") return "";
  const re = new RegExp(`<\\s*(${TOOL_TAG_NAMES})\\s*>[\\s\\S]*?<\\/\\1\\s*>`, "gi");
  return text.replace(re, "").trim();
}

/**
 * Replace malformed tool tags with friendly messages so the user sees a proper response.
 * Use when the model outputs <create_alert>{"json"}</create_alert> as text instead of calling the tool.
 */
function replaceMalformedToolTags(text) {
  if (typeof text !== "string") return "";
  const re = new RegExp(`<\\s*(${TOOL_TAG_NAMES})\\s*>[\\s\\S]*?<\\/\\1\\s*>`, "gi");
  return text.replace(re, (_, tagName) => {
    const key = tagName.toLowerCase();
    return MALFORMED_TAG_REPLACEMENTS[key] || "";
  });
}

/** Regex to detect incomplete tool tag at end of buffer (e.g. <create_alert>{"x":1 without closing). */
const PARTIAL_TAG_AT_END = new RegExp(`<\\s*(${TOOL_TAG_NAMES})\\s*>[\\s\\S]*$`, "i");

/**
 * Stream filter that buffers chunks and replaces malformed tool tags with friendly messages.
 * Call push(chunk) for each chunk, then flush() at end. Use onChunk to send filtered content.
 */
function createStreamTagFilter(onChunk) {
  let buffer = "";
  const completeTagRe = new RegExp(`<\\s*(${TOOL_TAG_NAMES})\\s*>[\\s\\S]*?<\\/\\1\\s*>`, "gi");

  function emit(text) {
    if (text) onChunk(text);
  }

  function process() {
    const match = completeTagRe.exec(buffer);
    if (!match) return;
    const before = buffer.slice(0, match.index);
    const key = match[1].toLowerCase();
    const replacement = MALFORMED_TAG_REPLACEMENTS[key] || "";
    buffer = buffer.slice(match.index + match[0].length);
    completeTagRe.lastIndex = 0;
    emit(before);
    emit(replacement);
    process();
  }

  return {
    push(chunk) {
      if (typeof chunk !== "string") return;
      buffer += chunk;
      process();
    },
    flush() {
      buffer = buffer.replace(PARTIAL_TAG_AT_END, "");
      emit(buffer);
      buffer = "";
    },
    reset() {
      buffer = "";
    },
  };
}

/**
 * Sanitize the message shown to the user: remove product IDs, exact stock numbers, replace malformed tool tags with friendly messages.
 * Product IDs are sent separately in the API response for the "View game" link.
 */
function sanitizeMessageForDisplay(text) {
  if (typeof text !== "string") return "";
  let out = replaceMalformedToolTags(text);
  out = out
    .replace(/\bproduct\s*id:\s*[a-fA-F0-9]{24}\s*/gi, " ")
    .replace(/\s*\([a-fA-F0-9]{24}\)\s*/g, " ")
    .replace(/(the\s+)?stock\s*count\s*is\s*\d+\.?/gi, " It is in stock.")
    .replace(/\bwe\s+have\s+\d+\s*(in\s+stock|units?)?\.?/gi, " It is in stock.")
    .replace(/\b\d+\s*(in\s+stock|units?\s+available)\.?/gi, " in stock.")
    .replace(/\b(stock|availability):\s*\d+/gi, " in stock")
    .replace(/\s+/g, " ")
    .trim();
  return out;
}

module.exports = {
  checkChatGuardrails,
  extractProductIdsFromText,
  extractProductIdsFromToolContent,
  extractOrderAndInvoiceFromToolContent,
  sanitizeMessageForDisplay,
  stripMalformedToolTags,
  replaceMalformedToolTags,
  createStreamTagFilter,
  MAX_MESSAGE_LENGTH,
};
