const { z } = require("zod");
const { PAYMENT_METHOD } = require("../models/payment.model");

const objectIdRegex = /^[a-f0-9]{24}$/i;

const createPaymentSchema = z.object({
    orderId: z.string().regex(objectIdRegex, "Invalid order ID"),
    method: z.enum(PAYMENT_METHOD).optional(),
});

const paymentIdParamSchema = z.object({
    id: z.string().regex(objectIdRegex, "Invalid payment ID"),
});

const createRazorpayOrderSchema = z.object({
    orderId: z.string().regex(objectIdRegex, "Invalid order ID"),
});

const verifyRazorpaySchema = z.object({
    razorpay_order_id: z.string(),
    razorpay_payment_id: z.string(),
    razorpay_signature: z.string(),
    appOrderId: z.string().regex(objectIdRegex, "Invalid order ID"),
});

module.exports = {
    createPaymentSchema,
    paymentIdParamSchema,
    createRazorpayOrderSchema,
    verifyRazorpaySchema,
};
