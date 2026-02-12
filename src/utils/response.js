/**
 * Standard response shapes for consistent API responses.
 * Use these via res.success(), res.error(), etc. from the response middleware.
 */

const SUCCESS = { success: true };
const FAILURE = { success: false };

/**
 * @param {*} data - Response payload
 * @returns {{ success: true, data: * }}
 */
function successBody(data) {
    return { ...SUCCESS, data };
}

/**
 * @param {string} message - Success message
 * @returns {{ success: true, message: string }}
 */
function successMessageBody(message) {
    return { ...SUCCESS, message };
}

/**
 * @param {*} data - Response payload
 * @param {string} message - Success message
 * @returns {{ success: true, data: *, message: string }}
 */
function successWithMessageBody(data, message) {
    return { ...SUCCESS, data, message };
}

/**
 * @param {*} data - Response payload
 * @param {Object} meta - Pagination metadata
 * @returns {{ success: true, data: *, meta: Object }}
 */
function paginatedBody(data, meta) {
    return { ...SUCCESS, data, meta };
}

/**
 * @param {string} message - Error message
 * @param {Object} [errors] - Optional validation/field errors
 * @returns {{ success: false, message: string, errors?: Object }}
 */
function errorBody(message, errors = null) {
    const body = { ...FAILURE, message };
    if (errors != null && typeof errors === "object") {
        body.errors = errors;
    }
    return body;
}

module.exports = {
    successBody,
    successMessageBody,
    successWithMessageBody,
    paginatedBody,
    errorBody,
};
