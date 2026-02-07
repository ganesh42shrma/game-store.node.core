const { z } = require("zod");
const { USER_ROLES } = require("../models/user.model");

const createUserSchema = z.object({
    email: z.string().email("Valid email is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    name: z.string().trim().min(1, "Name is required and cannot be empty"),
    role: z.enum(USER_ROLES).optional(),
});

const updateUserSchema = z.object({
    email: z.string().email().optional(),
    password: z.string().min(6).optional(),
    name: z.string().trim().min(1, "Name cannot be empty").optional(),
    role: z.enum(USER_ROLES).optional(),
    isActive: z.boolean().optional(),
    profilePicture: z.string().url().optional().or(z.literal("")),
});

module.exports = {
    createUserSchema,
    updateUserSchema,
};
