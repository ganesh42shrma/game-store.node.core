const winston = require("winston");

const { combine, timestamp, printf, colorize } = winston.format;

/**
 * Format metadata (extra keys beside level, message, timestamp, splat) for readable output.
 */
function formatMeta(meta) {
    if (!meta || typeof meta !== "object") return "";
    const { level, message, timestamp, splat, ...rest } = meta;
    if (Object.keys(rest).length === 0) return "";
    try {
        return " " + JSON.stringify(rest);
    } catch {
        return " " + String(rest);
    }
}

const logFormat = printf((info) => {
    const meta = formatMeta(info);
    const msg = info.message || "";
    const errStack = info.stack ? "\n" + info.stack : "";
    return `${info.timestamp} [${info.level}]: ${msg}${meta}${errStack}`;
});

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: combine(
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        logFormat
    ),
    transports: [
        new winston.transports.Console({
            format: combine(
                timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
                colorize({ all: true }),
                logFormat
            ),
        }),
    ],
});

module.exports = logger;
