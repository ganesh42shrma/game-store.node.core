"use strict";

const mongoose = require("mongoose");

/**
 * Tracks LLM usage per request for analytics (token counts, cost estimation).
 */
const llmUsageSchema = new mongoose.Schema(
  {
    agentType: {
      type: String,
      enum: ["games-qa", "game-creation"],
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ["groq", "gemini"],
      required: true,
      index: true,
    },
    model: {
      type: String,
      trim: true,
      default: null,
    },
    inputTokens: { type: Number, required: true, min: 0 },
    outputTokens: { type: Number, required: true, min: 0 },
    totalTokens: { type: Number, required: true, min: 0 },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

llmUsageSchema.index({ createdAt: 1 });
llmUsageSchema.index({ agentType: 1, createdAt: 1 });

module.exports = mongoose.model("LlmUsage", llmUsageSchema);
