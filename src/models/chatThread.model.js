"use strict";

const mongoose = require("mongoose");

/**
 * Per-user chat thread metadata (title, last activity).
 * Messages are stored in ChatMessage; this holds thread-level info.
 */
const chatThreadSchema = new mongoose.Schema(
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
    title: {
      type: String,
      default: null,
      trim: true,
    },
    lastMessageAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { timestamps: true }
);

chatThreadSchema.index({ userId: 1, lastMessageAt: -1 });
chatThreadSchema.index({ userId: 1, threadId: 1 }, { unique: true });

module.exports = mongoose.model("ChatThread", chatThreadSchema);
