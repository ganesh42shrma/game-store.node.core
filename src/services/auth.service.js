const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../models/user.model");
const userService = require("./user.service");

async function register(name, email, password) {
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
        return { conflict: true };
    }
    const user = await userService.createUser({
        name,
        email: email.toLowerCase(),
        password,
        role: "user",
    });
    return signTokenAndUser(user);
}

async function login(email, password) {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
        return null;
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
        return null;
    }
    if (!user.isActive) {
        return null;
    }
    return signTokenAndUser(user);
}

function signTokenAndUser(user) {
    const payload = {
        sub: user._id.toString(),
        email: user.email,
        role: user.role,
    };
    const token = jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );
    return {
        user: {
            id: user._id,
            email: user.email,
            name: user.name,
            role: user.role,
        },
        token,
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    };
}

module.exports = { login, register };