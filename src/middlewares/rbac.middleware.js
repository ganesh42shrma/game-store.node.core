/**
 * RBAC middleware: restrict route access by role.
 * Expects req.user to be set (e.g. by auth middleware) with req.user.role.
 * @param {string[]} allowedRoles - Roles that can access the route (e.g. ["admin", "manager"])
 */
function requireRole(allowedRoles) {
    return (req, res, next) => {
        const user = req.user;
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }
        const role = user.role;
        if (!allowedRoles.includes(role)) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to access this resource",
            });
        }
        next();
    };
}

module.exports = { requireRole };
