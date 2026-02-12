const recentPurchaseEvents = require("../services/recentPurchaseEvents");
const userNotificationEvents = require("../services/userNotificationEvents");

/**
 * SSE stream: "Recent purchases" for live toast notifications.
 * Client receives events like: { buyerName, country, productTitles, orderId, at }.
 * No auth required (public livestream).
 */
async function streamRecentPurchases(req, res, next) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    // Send recent history so new clients see last N purchases
    const recent = recentPurchaseEvents.getRecentPurchases(20);
    for (const event of recent) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    res.flush?.();

    const unsubscribe = recentPurchaseEvents.subscribe((line) => {
        res.write(line);
        res.flush?.();
    });

    req.on("close", () => {
        unsubscribe();
    });
}

/**
 * SSE stream: Per-user product alerts (price drop, on sale, available).
 * Requires auth. Client receives events like: { type, productId, title, message, meta, createdAt }.
 */
async function streamMyAlerts(req, res, next) {
    const userId = req.user?.id ? String(req.user.id) : null;
    if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const write = (line) => {
        try {
            res.write(line);
            res.flush?.();
        } catch (err) {
            // Connection closed
        }
    };

    const unsubscribe = userNotificationEvents.subscribe(userId, write);

    req.on("close", () => {
        unsubscribe();
    });
}

module.exports = {
    streamRecentPurchases,
    streamMyAlerts,
};
