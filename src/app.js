const express = require("express");
const cors = require("cors");
const routes = require("./routes");
const requestLogger = require("./middlewares/requestLogger.middleware");
const rateLimit = require("./middlewares/rateLimit.middleware");
const logger = require("./config/logger");
const app = express();

/**
 * CORS: allow frontend origin(s).
 * - Set CORS_ORIGIN in .env (e.g. https://your-frontend.vercel.app or comma-separated for multiple).
 * - In development, defaults to http://localhost:5174 when CORS_ORIGIN is unset.
 */
function getAllowedOrigins() {
    if (process.env.CORS_ORIGIN) {
        return process.env.CORS_ORIGIN.split(",")
            .map((s) => s.trim().replace(/\/+$/, ""))
            .filter(Boolean);
    }
    if (process.env.NODE_ENV !== "production") {
        return ["http://localhost:5174"];
    }
    return [];
}
const allowedOrigins = getAllowedOrigins();
app.use(cors({
    origin: (origin, cb) => {
        if (allowedOrigins.length === 0) return cb(null, false);
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes(origin)) return cb(null, origin);
        cb(null, false);
    },
    credentials: true,
}));

/**
 * Global middleware
 */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

/** 
 * Ping
 */
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

/**
 * API rate limit (per IP): 100 requests per minute when Redis available; in-memory fallback otherwise
 */
app.use("/api", rateLimit({ windowMs: 60 * 1000, max: 100 }), routes);

/**
 * Fallback 
 */
app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        message: "Route not found on game-store.node.core"
    });
})

/**
 * Global error handler
 */
app.use((err, req, res, next) => {
    logger.error(err.message || err);

    //mongoose validation error 
    if (err.name === "ValidationError") {
        const errors = {};
        Object.keys(err.errors).forEach((key) => {
            errors[key] = err.errors[key].message;
        });

        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors,
        })
    }

    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || "Internal Server Error",
    });
});

module.exports = app;