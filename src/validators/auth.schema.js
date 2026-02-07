const { z } = require("zod");

const loginSchema = z.object({
    email: z.string().email("Valid email is required."),
    password: z.string().min(1, "Password is required."),
});

const registerSchema = z.object({
    email: z.string().email("Valid email is required."),
    password: z.string().min(6, "Password must be at least 6 characters."),
    name: z.string().trim().min(1, "Name is required and cannot be empty."),
});

module.exports = {
    loginSchema,
    registerSchema,
};