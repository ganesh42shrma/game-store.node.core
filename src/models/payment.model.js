const mongoose = require("mongoose");

const PAYMENT_STATUS = ["created", "authorized", "captured", "failed"];
const PAYMENT_METHOD = ["mock_card", "mock_upi", "mock_netbanking"];

const paymentSchema = new mongoose.Schema(
    {
        order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: true,
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        amount: { type: Number, required: true, min: 0 },
        currency: { type: String, default: "INR" },
        status: {
            type: String,
            enum: PAYMENT_STATUS,
            default: "created",
        },
        method: {
            type: String,
            enum: PAYMENT_METHOD,
        },
        gatewayPaymentId: { type: String },
        metadata: { type: mongoose.Schema.Types.Mixed },
        capturedAt: { type: Date },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
module.exports.PAYMENT_STATUS = PAYMENT_STATUS;
module.exports.PAYMENT_METHOD = PAYMENT_METHOD;
