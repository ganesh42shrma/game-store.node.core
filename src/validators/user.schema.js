const { z } = require("zod");
const { USER_ROLES } = require("../models/user.model");

const createUserSchema = z.object({
    email: z.string().email("Valid email is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    name: z.string().min(1, "Name is required"),
    role: z.enum(USER_ROLES).optional(),
});

const updateUserSchema = z.object({
    email: z.string().email().optional(),
    password: z.string().min(6).optional(),
    name: z.string().min(1).optional(),
    role: z.enum(USER_ROLES).optional(),
    isActive: z.boolean().optional(),
});

module.exports = {
    createUserSchema,
    updateUserSchema,
};
