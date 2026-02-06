const { z } = require("zod");

const createProductSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().min(1, "Description is required"),
    price: z.number().positive("Price must be greater than 0"),
    platform: z.enum(["PC", "PS5", "XBOX", "SWITCH"]),
    genre: z.string().min(1, "Genre is required"),
    stock: z.number().int().min(0).optional(),
});

const updateProductSchema = z.object({
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    price: z.number().positive().optional(),
    platform: z.enum(["PC", "PS5", "XBOX", "SWITCH"]).optional(),
    genre: z.string().min(1).optional(),
    stock: z.number().int().min(0).optional(),
});

module.exports = {
    createProductSchema,
    updateProductSchema
}