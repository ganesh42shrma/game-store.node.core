const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    label: {
        type: String,
        trim: true,
    },
    line1: {
        type: String,
        required: true,
        trim: true,
    },
    line2: {
        type: String,
        trim: true,
    },
    city: {
        type: String,
        required: true,
        trim: true,
    },
    state: {
        type: String,
        required: true,
        trim: true,
    },
    pincode: {
        type: String,
        required: true,
        trim: true,
    },
    country: {
        type: String,
        default: "India",
        trim: true,
    },
    phone: {
        type: String,
        trim: true,
    },
    isDefault: {
        type: Boolean,
        default: false,
    }
},
    { timestamps: true }
);
addressSchema.index({ user: 1, isDefault: 1 });

module.exports = mongoose.model("Address", addressSchema);