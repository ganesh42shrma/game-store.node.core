const { z } = require("zod");
const { ORDER_STATUS, PAYMENT_STATUS } = require("../models/order.model");

const objectIdRegex = /^[a-f0-9]{24}$/i;

// Create order from cart - optional addressId in body
const createOrderSchema = z
    .object({
        addressId: z.string().regex(objectIdRegex).optional(),
    })
    .optional();

const orderIdParamSchema = z.object({
    id: z.string().regex(objectIdRegex, "Invalid order ID"),
});

const updateOrderStatusSchema = z.object({
    status: z.enum(ORDER_STATUS, { message: "status must be pending, completed, or cancelled" }),
});

const listOrdersAdminQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    status: z.enum(ORDER_STATUS).optional(),
    paymentStatus: z.enum(PAYMENT_STATUS).optional(),
    userId: z.string().regex(objectIdRegex).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    sort: z.string().optional(),
});

module.exports = {
    createOrderSchema,
    orderIdParamSchema,
    updateOrderStatusSchema,
    listOrdersAdminQuerySchema,
};
