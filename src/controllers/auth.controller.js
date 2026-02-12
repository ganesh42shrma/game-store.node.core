const authService = require("../services/auth.service");

async function register(req, res, next) {
    try {
        const { name, email, password } = req.body;
        const result = await authService.register(name, email, password);
        if (result && result.conflict) {
            return res.sendError("Email already registered", 409);
        }
        res.created(result);
    } catch (error) {
        next(error);
    }
}

async function login(req, res, next) {
    try {
        const { email, password } = req.body;
        const result = await authService.login(email, password);
        if (!result) {
            return res.sendError("Invalid credentials", 401);
        }
        res.success(result);
    } catch (error) {
        next(error);
    }
}

module.exports = { register, login };