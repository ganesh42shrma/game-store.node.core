const logger = require("../config/logger");

/**
 * Request/response logging middleware.
 * Logs method, url, statusCode, and duration when the response finishes.
 */
function requestLogger(req, res, next) {
    const start = Date.now();

    logger.info(
        `→ ${req.method} ${req.originalUrl || req.url} (${req.ip || req.socket?.remoteAddress || "-"})`
    );

    res.on("finish", () => {
        const duration = Date.now() - start;
        const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
        logger[level](
            `← ${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${duration}ms`
        );
    });

    next();
}

module.exports = requestLogger;
