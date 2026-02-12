"use strict";

const mongoose = require("mongoose");

/**
 * Per-user, per-thread chat message history.
 * Stores user and assistant messages for conversation continuity.
 */
const chatMessageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    threadId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

chatMessageSchema.index({ userId: 1, threadId: 1, createdAt: 1 });

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
