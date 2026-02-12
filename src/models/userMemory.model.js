"use strict";

const mongoose = require("mongoose");

/**
 * Per-user long-term memory for the chat agent (preferences, optional chat summary).
 * One document per user; preferences stored as key-value in an object.
 */
const userMemorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    preferences: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      description: "User preferences (e.g. theme, budget, favorite_genre, platform)",
    },
    lastChatAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserMemory", userMemorySchema);
