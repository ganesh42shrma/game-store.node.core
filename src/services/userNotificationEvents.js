"use strict";

/**
 * Per-user notification events for SSE.
 * Similar to recentPurchaseEvents but keyed by userId.
 * When a notification is created, we push to all SSE connections for that user.
 *
 * Structure: Map<userId, Set<writeFn>>
 * For scaling: use Redis pub/sub so instances subscribe to user:{userId} and broadcast locally.
 */

const subscribers = new Map(); // userId -> Set of write functions

/**
 * Subscribe to notifications for a user. Returns unsubscribe function.
 * @param {string} userId
 * @param {function(string): void} write - receives SSE line (data: {...}\n\n)
 * @returns {function(): void} unsubscribe
 */
function subscribe(userId, write) {
  if (!userId || typeof write !== "function") return () => {};
  if (!subscribers.has(userId)) {
    subscribers.set(userId, new Set());
  }
  subscribers.get(userId).add(write);
  return () => {
    const set = subscribers.get(userId);
    if (set) {
      set.delete(write);
      if (set.size === 0) subscribers.delete(userId);
    }
  };
}

/**
 * Push a notification to all connected clients for a user.
 * @param {string} userId
 * @param {object} payload - notification payload (will be JSON stringified)
 */
function pushToUser(userId, payload) {
  const set = subscribers.get(userId);
  if (!set || set.size === 0) return;

  const line = `data: ${JSON.stringify(payload)}\n\n`;
  for (const write of set) {
    try {
      write(line);
    } catch (err) {
      set.delete(write);
    }
  }
}

module.exports = {
  subscribe,
  pushToUser,
};
