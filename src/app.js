const express = require("express");
const cors = require("cors");
const routes = require("./routes");
const requestLogger = require("./middlewares/requestLogger.middleware");
const rateLimit = require("./middlewares/rateLimit.middleware");
const logger = require("./config/logger");
const app = express();

/**
 * CORS: allow frontend origin in development (e.g. http://localhost:5174)
 * Set CORS_ORIGIN in .env or leave unset to allow localhost:5174 when NODE_ENV is not production
 */
const corsOrigin = process.env.CORS_ORIGIN
    || (process.env.NODE_ENV !== "production" ? "https://game-store-node-core-147f97uoo-ganesh42shrmas-projects.vercel.app" : undefined);
app.use(cors({
    origin: corsOrigin || false,
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