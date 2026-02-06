const Redis = require("ioredis");

let client = null;

function getRedisClient() {
    if (client) return client;
    const uri = process.env.REDIS_URI;
    if (!uri) return null;
    try {
        client = new Redis(uri, {
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
                if (times > 3) return null;
                return Math.min(times * 200, 2000);
            },
        });
        client.on("error", (err) => {
            console.warn("Redis client error:", err.message);
        });
        return client;
    } catch (err) {
        console.warn("Redis init failed:", err.message);
        return null;
    }
}

module.exports = { getRedisClient };
