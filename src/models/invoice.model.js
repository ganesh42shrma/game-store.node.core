const mongoose = require("mongoose");

const INVOICE_STATUS = ["draft", "issued"];

const invoiceItemSchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
        },
        title: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true, min: 0 },
        amount: { type: Number, required: true, min: 0 },
    },
    { _id: false }
);

const billingAddressSchema = new mongoose.Schema(
    {
        line1: { type: String, required: true },
        line2: { type: String },
        city: { type: String, required: true },
        state: { type: String, required: true },
        pincode: { type: String, required: true },
        country: { type: String, default: "India" },
        phone: { type: String },
    },
    { _id: false }
);

const invoiceSchema = new mongoose.Schema(
    {
        invoiceNumber: { type: String, required: true, unique: true },
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
        billingAddress: billingAddressSchema,
        items: [invoiceItemSchema],
        subTotal: { type: Number, required: true, min: 0 },
        gstRate: { type: Number, required: true, min: 0 },
        gstAmount: { type: Number, required: true, min: 0 },
        totalAmount: { type: Number, required: true, min: 0 },
        status: {
            type: String,
            enum: INVOICE_STATUS,
            default: "issued",
        },
        issuedAt: { type: Date, default: Date.now },
        notes: { type: String },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Invoice", invoiceSchema);
module.exports.INVOICE_STATUS = INVOICE_STATUS;
