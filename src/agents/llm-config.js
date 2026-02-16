"use strict";

const { ChatGroq } = require("@langchain/groq");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { modelRetryMiddleware, modelFallbackMiddleware } = require("langchain");

const groqKey = process.env.GROQ_API_KEY;
const llm = groqKey
  ? new ChatGroq({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      apiKey: groqKey,
      maxTokens: 2048,
      temperature: 0.1,
    })
  : new ChatGoogleGenerativeAI({
      model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
      apiKey: process.env.GOOGLE_API_KEY,
      maxOutputTokens: 2048,
      temperature: 0.2,
    });

function isToolUseFailedError(err) {
  if (!err || typeof err !== "object") return false;
  const msg = String(err.message || "");
  const status = err.status ?? err.statusCode ?? err.response?.status;
  const code = err.error?.code ?? err.body?.error?.code ?? err.response?.data?.error?.code ?? err.cause?.body?.error?.code;
  if (code === "tool_use_failed") return true;
  if (status === 400 && (msg.includes("tool_use_failed") || msg.includes("tool call validation failed"))) return true;
  return false;
}

const fallbackModels = ["groq:llama-3.1-8b-instant"];
if (process.env.GOOGLE_API_KEY) fallbackModels.push("google-genai:gemini-2.0-flash");

module.exports = {
  llm,
  modelRetryMiddleware,
  modelFallbackMiddleware,
  isToolUseFailedError,
  fallbackModels,
};
