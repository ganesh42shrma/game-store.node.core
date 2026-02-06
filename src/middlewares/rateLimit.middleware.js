const { getRedisClient } = require("../config/redis");
const logger = require("../config/logger");

/**
 * Rate limiter: fixed window per identifier (default IP).
 * Uses Redis when REDIS_URI is set; otherwise in-memory (single process only).
 * @param {Object} options
 * @param {number} options.windowMs - Window in ms (e.g. 60000 = 1 min)
 * @param {number} options.max - Max requests per window
 * @param {string} options.message - Optional message when limited
 */
function rateLimit(options = {}) {
    const {
        windowMs = 60 * 1000,
        max = 100,
        message = "Too many requests, please try again later.",
    } = options;

    const redis = getRedisClient();
    const memory = new Map(); // fallback when Redis not configured

    function getKey(identifier) {
        const windowSlot = Math.floor(Date.now() / windowMs);
        return `rl:${identifier}:${windowSlot}`;
    }

    async function incrAndGet(key) {
        if (redis) {
            const multi = redis.multi();
            multi.incr(key);
            multi.pexpire(key, windowMs);
            const results = await multi.exec();
            return results[0][1]; // result of INCR
        }
        const cur = memory.get(key) ?? 0;
        memory.set(key, cur + 1);
        if (cur === 0) {
            setTimeout(() => memory.delete(key), windowMs);
        }
        return cur + 1;
    }

    return function (req, res, next) {
        const identifier = req.ip || req.socket?.remoteAddress || "unknown";
        const key = getKey(identifier);

        incrAndGet(key)
            .then((count) => {
                res.setHeader("X-RateLimit-Limit", max);
                res.setHeader("X-RateLimit-Remaining", Math.max(0, max - count));
                if (count > max) {
                    logger.warn(`Rate limit exceeded: ${identifier}`);
                    return res.status(429).json({
                        success: false,
                        message,
                    });
                }
                next();
            })
            .catch((err) => {
                logger.error("Rate limiter error: " + (err?.message || err));
                next(); // on Redis errors, allow request
            });
    };
}

module.exports = rateLimit;
