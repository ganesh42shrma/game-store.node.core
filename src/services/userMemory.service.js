"use strict";

const UserMemory = require("../models/userMemory.model");

/**
 * Get full user memory (preferences, etc.) for the chat agent.
 * @param {string} userId - User ID (ObjectId string)
 * @returns {Promise<{ preferences: Object, lastChatAt?: Date } | null>}
 */
async function getUserMemory(userId) {
  if (!userId || typeof userId !== "string") return null;
  const doc = await UserMemory.findOne({ userId }).lean();
  if (!doc) return null;
  return {
    preferences: doc.preferences || {},
    lastChatAt: doc.lastChatAt,
  };
}

/**
 * Set a single preference for a user. Creates the document if it doesn't exist.
 * @param {string} userId - User ID (ObjectId string)
 * @param {string} key - Preference key (e.g. "theme", "budget", "favorite_genre")
 * @param {string|number|boolean} value - Preference value
 */
async function setUserPreference(userId, key, value) {
  if (!userId || typeof userId !== "string") return;
  await UserMemory.findOneAndUpdate(
    { userId },
    {
      $set: {
        [`preferences.${key}`]: value,
        lastChatAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );
}

/**
 * Update lastChatAt for a user (e.g. after each chat turn).
 * @param {string} userId - User ID (ObjectId string)
 */
async function touchLastChat(userId) {
  if (!userId || typeof userId !== "string") return;
  await UserMemory.findOneAndUpdate(
    { userId },
    { $set: { lastChatAt: new Date() } },
    { upsert: true }
  );
}

module.exports = {
  getUserMemory,
  setUserPreference,
  touchLastChat,
};
