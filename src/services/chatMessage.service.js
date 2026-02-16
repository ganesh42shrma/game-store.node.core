"use strict";

const mongoose = require("mongoose");
const ChatMessage = require("../models/chatMessage.model");
const chatThreadService = require("./chatThread.service");

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_THREADS_PER_USER = Math.max(1, parseInt(process.env.MAX_CHAT_THREADS_PER_USER, 10) || 3);

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

/**
 * Delete all messages for a thread.
 * @param {string} userId - User ID (ObjectId string)
 * @param {string} threadId - Thread ID
 * @returns {Promise<{ deletedCount: number }>}
 */
async function deleteThread(userId, threadId) {
  if (!userId || !threadId) return { deletedCount: 0 };
  await chatThreadService.deleteThread(userId, threadId);
  const result = await ChatMessage.deleteMany({
    userId: new mongoose.Types.ObjectId(userId),
    threadId: String(threadId).trim(),
  });
  return { deletedCount: result.deletedCount ?? 0 };
}

/**
 * Enforce max threads per user. When adding a new thread would exceed the limit,
 * deletes the oldest thread. Call before saveMessage when the thread might be new.
 * @param {string} userId - User ID (ObjectId string)
 * @param {string} currentThreadId - Thread we're about to add a message to
 */
async function enforceThreadLimit(userId, currentThreadId) {
  if (!userId || !currentThreadId) return;
  const threads = await getThreads(userId);
  const existingIds = new Set(threads.map((t) => t.threadId));
  if (existingIds.has(currentThreadId)) return;
  if (threads.length < MAX_THREADS_PER_USER) return;
  const oldest = threads[threads.length - 1];
  if (oldest?.threadId) {
    await deleteThread(userId, oldest.threadId);
  }
}

module.exports = {
  saveMessage,
  getHistory,
  getThreads,
  deleteThread,
  enforceThreadLimit,
};
