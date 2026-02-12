const logger = require("../config/logger");

/**
 * Request/response logging middleware.
 * Logs method, url, statusCode, and duration when the response finishes.
 */
function requestLogger(req, res, next) {
    const start = req.startTime ?? Date.now();
    const reqId = req.requestId ? `[${req.requestId.slice(0, 8)}] ` : "";

    logger.info(
        `${reqId}→ ${req.method} ${req.originalUrl || req.url} (${req.ip || req.socket?.remoteAddress || "-"})`
    );

    res.on("finish", () => {
        const duration = Date.now() - start;
        const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
        logger[level](
            `${reqId}← ${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${duration}ms`
        );
    });

    next();
}

module.exports = requestLogger;
