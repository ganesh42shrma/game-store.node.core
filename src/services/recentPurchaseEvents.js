/**
 * In-memory store and broadcast for "recent purchase" events.
 * Used by SSE endpoint so all connected clients get "Alex from India purchased X" toasts.
 */

const MAX_RECENT = 50;
const recentPurchases = [];
const subscribers = new Set();

/**
 * @typedef {Object} RecentPurchasePayload
 * @property {string} buyerName - First name or display name (e.g. "Alex")
 * @property {string} country - Country from billing (e.g. "India")
 * @property {string[]} productTitles - Titles of purchased games (e.g. ["Elden Ring"])
 * @property {string} orderId - Order _id
 * @property {string} at - ISO timestamp
 */

/**
 * Add a recent-purchase event and broadcast to all SSE subscribers.
 * @param {RecentPurchasePayload} payload
 */
function addRecentPurchase(payload) {
    const at = new Date().toISOString();
    const event = { ...payload, at };
    recentPurchases.push(event);
    if (recentPurchases.length > MAX_RECENT) {
        recentPurchases.shift();
    }
    const line = `data: ${JSON.stringify(event)}\n\n`;
    subscribers.forEach((write) => {
        try {
            write(line);
        } catch (err) {
            subscribers.delete(write);
        }
    });
}

/**
 * Get the last N recent purchases (for initial SSE send).
 * @param {number} limit
 * @returns {RecentPurchasePayload[]}
 */
function getRecentPurchases(limit = 20) {
    const start = Math.max(0, recentPurchases.length - limit);
    return recentPurchases.slice(start);
}

/**
 * Subscribe to new events. Callback receives a line to send (data: {...}\n\n).
 * @param {function(string): void} write - function to call with each SSE data line
 * @returns {function(): void} unsubscribe
 */
function subscribe(write) {
    subscribers.add(write);
    return () => subscribers.delete(write);
}

module.exports = {
    addRecentPurchase,
    getRecentPurchases,
    subscribe,
};
