const express = require("express");
const authController = require("../controllers/auth.controller");
const validate = require("../middlewares/validate.middleware");
const rateLimit = require("../middlewares/rateLimit.middleware");
const { loginSchema, registerSchema } = require("../validators/auth.schema");

const router = express.Router();

const authRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: "Too many auth attempts, please try again later.",
});

router.post("/register", authRateLimit, validate(registerSchema), authController.register);
router.post("/login", authRateLimit, validate(loginSchema), authController.login);

module.exports = router;