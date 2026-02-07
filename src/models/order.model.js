const mongoose = require("mongoose");

const ORDER_STATUS = ["pending", "completed", "cancelled"];
const PAYMENT_STATUS = ["unpaid","paid","failed","pending","refunded"];

const orderItemSchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
        },
        title: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true, min: 0 },
    },
    { _id: false }
);

const billingAddressSchema = new mongoose.Schema({
    line1: { type: String, required: true },
    line2: { type:String },
    city: { type: String, require:true },
    state: { type: String, require:true },
    pincode: { type: String, require:true },
    country: { type: String, default: "India" },
    phone: { type: String },
}, { _id: false });

const orderSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        items: [orderItemSchema],
        billingAddress: billingAddressSchema,
        subTotal: { type: Number, required: true, min: 0 },
        gstRate: { type: Number, default: 18, min: 0 },
        gstAmount: { type: Number, required: true, min: 0 },
        totalAmount:{type:Number, required:true, min:0},
        status: {
            type: String,
            enum: ORDER_STATUS,
            default: "pending", // "pending", "completed", "cancelled"
        },
        paymentStatus: {
            type: String,
            enum: PAYMENT_STATUS,
            default: "unpaid",
        },
        paidAt: { type: Date },
        payment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Payment",
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
module.exports.ORDER_STATUS = ORDER_STATUS;
module.exports.PAYMENT_STATUS = PAYMENT_STATUS;