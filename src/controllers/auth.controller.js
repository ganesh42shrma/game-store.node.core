const authService = require("../services/auth.service");

async function register(req, res, next) {
    try {
        const { name, email, password } = req.body;
        const result = await authService.register(name, email, password);
        if (result && result.conflict) {
            return res.status(409).json({
                success: false,
                message: "Email already registered",
            });
        }
        res.status(201).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

async function login(req, res, next) {
    try {
        const { email, password } = req.body;
        const result = await authService.login(email, password);
        if (!result) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials",
            });
        }
        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

module.exports = { register, login };