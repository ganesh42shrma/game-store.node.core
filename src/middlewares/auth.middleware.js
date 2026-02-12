const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

/**
 * Authenticate request using JWT in Authorization header
 * success - sets req.user = { id,email,role } -> calls next()
 * on Failure - sends 401 and does not call next().
 */

function authenticateJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;
    if (!token) {
        return res.sendError("Authentication required", 401);
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.sub || decoded.id || decoded.userId;
        if (!userId) {
            return res.sendError("Invalid token", 401);
        }

        User.findById(userId)
            .then((user) => {
                if (!user) {
                    return res.sendError("User not found", 401);
                }
                if (!user.isActive) {
                    return res.sendError("Account is disabled", 401);
                }
                req.user = {
                    id: user._id,
                    email: user.email,
                    role: user.role,
                };
                next();
            })
            .catch((err) => {
                next(err)
            });
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.sendError("Token expired", 401);
        }
        if (error.name === "JsonWebTokenError") {
            return res.sendError("Invalid token", 401);
        }
        next(error);
    }
}

module.exports = authenticateJWT;