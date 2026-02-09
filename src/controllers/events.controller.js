const recentPurchaseEvents = require("../services/recentPurchaseEvents");

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

module.exports = {
    streamRecentPurchases,
};
