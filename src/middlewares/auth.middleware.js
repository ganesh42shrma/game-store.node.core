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
        return res.status(401).json({
            success: false,
            message: "Authentication required",
        });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.sub || decoded.id || decoded.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Invalid token",
            });
        }

        User.findById(userId)
            .then((user) => {
                if (!user) {
                    return res.status(401).json({
                        success: false,
                        message: "User not found",
                    })
                }
                if (!user.isActive) {
                    return res.status(401).json({
                        success: false,
                        message: "Account is disabled"
                    })
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
            return res.status(401).json({
                success: false,
                message: "Token expired",
            })
        }
        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({
                success: false,
                message: "Invalid token",
            });
        }
        next(err);
    }
}

module.exports = authenticateJWT;