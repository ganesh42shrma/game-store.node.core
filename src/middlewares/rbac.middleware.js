/**
 * RBAC middleware: restrict route access by role.
 * Expects req.user to be set (e.g. by auth middleware) with req.user.role.
 * @param {string[]} allowedRoles - Roles that can access the route (e.g. ["admin", "manager"])
 */
function requireRole(allowedRoles) {
    return (req, res, next) => {
        const user = req.user;
        if (!user) {
            return res.sendError("Authentication required", 401);
        }
        const role = user.role;
        if (!allowedRoles.includes(role)) {
            return res.sendError("You do not have permission to access this resource", 403);
        }
        next();
    };
}

module.exports = { requireRole };
