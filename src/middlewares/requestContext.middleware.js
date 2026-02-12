const crypto = require("crypto");
const { successBody, successMessageBody, successWithMessageBody, paginatedBody, errorBody } = require("../utils/response");

/**
 * Attaches request context and response helpers to req/res.
 * - req.requestId: unique ID for tracing (from X-Request-Id header or generated)
 * - req.startTime: timestamp when request started
 * - res.success(), res.error(), res.created(), res.paginated(): standardized response helpers
 */
function requestContext(req, res, next) {
    req.requestId = req.headers["x-request-id"] || crypto.randomUUID();
    req.startTime = Date.now();

    res.setHeader("X-Request-Id", req.requestId);

    /**
     * Send success response with data.
     * @param {*} data - Response payload
     * @param {number} [statusCode=200]
     */
    res.success = (data, statusCode = 200) => {
        res.status(statusCode).json(successBody(data));
    };

    /**
     * Send success response with only a message (no data).
     * @param {string} message
     * @param {number} [statusCode=200]
     */
    res.successMessage = (message, statusCode = 200) => {
        res.status(statusCode).json(successMessageBody(message));
    };

    /**
     * Send success response with both data and message.
     * @param {*} data
     * @param {string} message
     * @param {number} [statusCode=200]
     */
    res.successWithMessage = (data, message, statusCode = 200) => {
        res.status(statusCode).json(successWithMessageBody(data, message));
    };

    /**
     * Send 201 Created with data.
     * @param {*} data
     */
    res.created = (data) => {
        res.status(201).json(successBody(data));
    };

    /**
     * Send paginated response.
     * @param {*} data - Array or list of items
     * @param {Object} meta - { total, page, limit, totalPages }
     * @param {number} [statusCode=200]
     */
    res.paginated = (data, meta, statusCode = 200) => {
        res.status(statusCode).json(paginatedBody(data, meta));
    };

    /**
     * Send error response.
     * @param {string} message - Error message
     * @param {number} [statusCode=400]
     * @param {Object} [errors] - Optional field-level errors (e.g. validation)
     */
    res.sendError = (message, statusCode = 400, errors = null) => {
        res.status(statusCode).json(errorBody(message, errors));
    };

    next();
}

module.exports = requestContext;
