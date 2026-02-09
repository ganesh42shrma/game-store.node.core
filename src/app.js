const express = require("express");
const cors = require("cors");
const routes = require("./routes");
const requestLogger = require("./middlewares/requestLogger.middleware");
const rateLimit = require("./middlewares/rateLimit.middleware");
const logger = require("./config/logger");
const app = express();

/**
 * CORS: allow frontend origin(s) — the URL where your frontend app runs (e.g. Vercel frontend URL).
 * CORS_ORIGIN must be the FRONTEND origin
 * - Set CORS_ORIGIN in .env (e.g. https://your-frontend.vercel.app or comma-separated for multiple).
 * - Values without a scheme get https:// added; trailing slashes are stripped.
 * - In development, defaults to http://localhost:5174 when CORS_ORIGIN is unset.
 */
function normalizeOrigin(url) {
    if (!url || typeof url !== "string") return "";
    return url.trim().replace(/\/+$/, "");
}

function getAllowedOrigins() {
    const fromEnv = process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(",")
              .map((s) => normalizeOrigin(s))
              .filter(Boolean)
              .map((s) => (s.startsWith("http://") || s.startsWith("https://") ? s : `https://${s}`))
        : [];
    if (process.env.NODE_ENV !== "production" && !fromEnv.includes("http://localhost:5174")) {
        fromEnv.push("http://localhost:5174");
    }
    return fromEnv;
}

// Read on every request (no cache) so Vercel Preview always uses current CORS_ORIGIN
function isOriginAllowed(requestOrigin) {
    const origin = normalizeOrigin(requestOrigin);
    if (!origin) return false;
    const allowed = getAllowedOrigins();
    return allowed.length > 0 && allowed.some((a) => normalizeOrigin(a) === origin);
}

// Handle preflight (OPTIONS) for all paths so CORS headers are always set (reliable on Vercel serverless).
// Uses middleware instead of app.options("*") because Express 5 path-to-regexp rejects bare "*".
app.use((req, res, next) => {
    if (req.method !== "OPTIONS") return next();
    const origin = req.headers.origin;
    if (origin && isOriginAllowed(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.setHeader("Access-Control-Max-Age", "86400");
        return res.status(204).end();
    }
    next();
});

app.use(cors({
    origin: (origin, cb) => {
        if (!origin) return cb(null, false);
        if (!isOriginAllowed(origin)) return cb(null, false);
        cb(null, origin);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
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