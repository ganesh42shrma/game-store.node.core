const { z } = require("zod");

const objectIdRegex = /^[a-f0-9]{24}$/i;

const addCartItemSchema = z.object({
    productId: z.string().regex(objectIdRegex, "Invalid product ID"),
    quantity: z.number().int().min(1, "Quantity must be at least 1"),
});

const updateCartItemSchema = z.object({
    quantity: z.number().int().min(0, "Quantity must be 0 or more"),
});

module.exports = {
    addCartItemSchema,
    updateCartItemSchema,
};
