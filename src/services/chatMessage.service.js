"use strict";

const mongoose = require("mongoose");
const ChatMessage = require("../models/chatMessage.model");

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/**
 * Save a chat message.
 * @param {string} userId - User ID (ObjectId string)
 * @param {string} threadId - Thread ID
 * @param {string} role - "user" or "assistant"
 * @param {string} content - Message content
 * @returns {Promise<Object>}
 */
async function saveMessage(userId, threadId, role, content) {
  if (!userId || !threadId || !role || content == null) return null;
  const raw = String(content);
  const trimmed = raw.trim();
  const safeContent = trimmed.length > 0 ? trimmed : "(Action completed)";
  const doc = await ChatMessage.create({
    userId,
    threadId: String(threadId).trim(),
    role,
    content: safeContent,
  });
  return doc.toObject ? doc.toObject() : doc;
}

/**
 * Get chat history for a thread, oldest first (chronological order for agent context).
 * Returns the most recent N messages.
 * @param {string} userId - User ID (ObjectId string)
 * @param {string} threadId - Thread ID
 * @param {{ limit?: number }} options - limit (default 20, max 50)
 * @returns {Promise<Array<{ role: string, content: string, createdAt: Date }>>}
 */
async function getHistory(userId, threadId, options = {}) {
  if (!userId || !threadId) return [];
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(options.limit) || DEFAULT_LIMIT));
  const docs = await ChatMessage.find({ userId, threadId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("role content createdAt")
    .lean();
  return docs.reverse().map((d) => ({ role: d.role, content: d.content, createdAt: d.createdAt }));
}

/**
 * Get list of thread IDs for a user (threads with at least one message).
 * @param {string} userId - User ID (ObjectId string)
 * @returns {Promise<Array<{ threadId: string, lastMessageAt: Date }>>}
 */
async function getThreads(userId) {
  if (!userId) return [];
  const docs = await ChatMessage.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    { $group: { _id: "$threadId", lastMessageAt: { $max: "$createdAt" } } },
    { $sort: { lastMessageAt: -1 } },
    { $project: { threadId: "$_id", lastMessageAt: 1, _id: 0 } },
  ]);
  return docs;
}

module.exports = {
  saveMessage,
  getHistory,
  getThreads,
};
