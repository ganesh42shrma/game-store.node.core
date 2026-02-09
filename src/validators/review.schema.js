const { z } = require("zod");

const createOrUpdateReviewSchema = z.object({
    rating: z.number().int().min(1, "Rating must be 1–5").max(5, "Rating must be 1–5"),
    comment: z.string().max(2000, "Comment max 2000 characters").optional().default(""),
});

module.exports = { createOrUpdateReviewSchema };
