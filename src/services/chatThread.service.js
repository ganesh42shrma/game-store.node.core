"use strict";

const mongoose = require("mongoose");
const ChatThread = require("../models/chatThread.model");
const ChatMessage = require("../models/chatMessage.model");

/**
 * Upsert thread metadata (lastMessageAt). Call when saving a message.
 * @param {string} userId - User ID (ObjectId string)
 * @param {string} threadId - Thread ID
 */
async function upsertThread(userId, threadId) {
  if (!userId || !threadId) return;
  await ChatThread.findOneAndUpdate(
    { userId: new mongoose.Types.ObjectId(userId), threadId: String(threadId).trim() },
    { $set: { lastMessageAt: new Date() } },
    { upsert: true, new: true }
  );
}

/**
 * Add titles to threads. Call with threads from chatMessageService.getThreads.
 * @param {string} userId - User ID (ObjectId string)
 * @param {Array<{ threadId: string, lastMessageAt: Date }>} threads
 * @returns {Promise<Array<{ threadId: string, lastMessageAt: Date, title?: string }>>}
 */
async function enrichThreadsWithTitles(userId, threads) {
  if (!userId || !Array.isArray(threads) || threads.length === 0) return threads;
  const threadIds = threads.map((t) => t.threadId);
  const threadDocs = await ChatThread.find({
    userId: new mongoose.Types.ObjectId(userId),
    threadId: { $in: threadIds },
  })
    .select("threadId title")
    .lean();
  const titleByThread = Object.fromEntries(threadDocs.map((d) => [d.threadId, d.title || null]));
  return threads.map((t) => ({
    ...t,
    title: titleByThread[t.threadId] ?? null,
  }));
}

/**
 * Check if thread has a title.
 * @param {string} userId - User ID (ObjectId string)
 * @param {string} threadId - Thread ID
 * @returns {Promise<boolean>}
 */
async function threadHasTitle(userId, threadId) {
  if (!userId || !threadId) return false;
  const doc = await ChatThread.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    threadId: String(threadId).trim(),
  })
    .select("title")
    .lean();
  return !!(doc?.title && String(doc.title).trim());
}

/**
 * Get first user message in a thread (for title generation).
 * @param {string} userId - User ID (ObjectId string)
 * @param {string} threadId - Thread ID
 * @returns {Promise<string|null>}
 */
async function getFirstUserMessage(userId, threadId) {
  if (!userId || !threadId) return null;
  const doc = await ChatMessage.findOne(
    { userId: new mongoose.Types.ObjectId(userId), threadId: String(threadId).trim(), role: "user" }
  )
    .sort({ createdAt: 1 })
    .select("content")
    .lean();
  return doc?.content ? String(doc.content).trim().slice(0, 200) : null;
}

/**
 * Update thread title. Called after LLM generates it.
 * @param {string} userId - User ID (ObjectId string)
 * @param {string} threadId - Thread ID
 * @param {string} title - Generated title
 */
async function setThreadTitle(userId, threadId, title) {
  if (!userId || !threadId || !title) return;
  const trimmed = String(title).trim().slice(0, 100);
  if (!trimmed) return;
  await ChatThread.findOneAndUpdate(
    { userId: new mongoose.Types.ObjectId(userId), threadId: String(threadId).trim() },
    { $set: { title: trimmed } }
  );
}

/**
 * Rename thread (user-initiated). Creates ChatThread if missing (e.g. legacy threads).
 * @param {string} userId - User ID (ObjectId string)
 * @param {string} threadId - Thread ID
 * @param {string} title - New title
 * @returns {Promise<{ updated: boolean }>}
 */
async function renameThread(userId, threadId, title) {
  if (!userId || !threadId || !title) return { updated: false };
  const trimmed = String(title).trim().slice(0, 100);
  if (!trimmed) return { updated: false };
  const existing = await ChatThread.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    threadId: String(threadId).trim(),
  }).lean();
  let lastMessageAt = new Date();
  if (!existing) {
    const latest = await ChatMessage.findOne(
      { userId: new mongoose.Types.ObjectId(userId), threadId: String(threadId).trim() }
    )
      .sort({ createdAt: -1 })
      .select("createdAt")
      .lean();
    if (latest?.createdAt) lastMessageAt = latest.createdAt;
  }
  await ChatThread.findOneAndUpdate(
    { userId: new mongoose.Types.ObjectId(userId), threadId: String(threadId).trim() },
    { $set: { title: trimmed, lastMessageAt } },
    { upsert: true, new: true }
  );
  return { updated: true };
}

/**
 * Delete thread metadata. Call when deleting a thread's messages.
 * @param {string} userId - User ID (ObjectId string)
 * @param {string} threadId - Thread ID
 */
async function deleteThread(userId, threadId) {
  if (!userId || !threadId) return;
  await ChatThread.deleteMany({
    userId: new mongoose.Types.ObjectId(userId),
    threadId: String(threadId).trim(),
  });
}

module.exports = {
  upsertThread,
  enrichThreadsWithTitles,
  threadHasTitle,
  getFirstUserMessage,
  setThreadTitle,
  renameThread,
  deleteThread,
};
