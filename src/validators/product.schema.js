const { z } = require("zod");

const youtubeUrlRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/)|youtu\.be\/)[\w-]+/i;

const youtubeLinkItem = z.string().url("Invalid URL").regex(youtubeUrlRegex, "Must be a YouTube URL");

const tagItem = z.string().min(1, "Tag cannot be empty").max(50, "Tag max 50 characters").transform((s) => s.trim().toLowerCase());

const createProductSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().min(1, "Description is required"),
    shortDescription: z.string().max(300, "Short description max 300 characters").optional().default(""),
    price: z.number().positive("Price must be greater than 0"),
    platform: z.enum(["PC", "PS5", "XBOX", "SWITCH"]),
    genre: z.string().min(1, "Genre is required"),
    stock: z.number().int().min(0).optional(),
    youtubeLinks: z.array(youtubeLinkItem).max(3, "At most 3 YouTube links allowed").optional().default([]),
    tags: z.array(tagItem).max(20, "At most 20 tags allowed").optional().default([]),
});

const updateProductSchema = z.object({
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    shortDescription: z.string().max(300, "Short description max 300 characters").optional(),
    price: z.number().positive().optional(),
    platform: z.enum(["PC", "PS5", "XBOX", "SWITCH"]).optional(),
    genre: z.string().min(1).optional(),
    stock: z.number().int().min(0).optional(),
    youtubeLinks: z.array(youtubeLinkItem).max(3, "At most 3 YouTube links allowed").optional(),
    tags: z.array(tagItem).max(20, "At most 20 tags allowed").optional(),
});

module.exports = {
    createProductSchema,
    updateProductSchema
}