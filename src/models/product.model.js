const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            required: true,
        },
        price: {
            type: Number,
            required: true,
            min: 0,
        },
        platform: {
            type: String,
            enum: ["PC", "PS5", "XBOX", "SWITCH"],
            required: true
        },
        genre: {
            type: String,
            required: true,
        },
        stock: {
            type: Number,
            required: true,
            min: 0,
            default: 0
        },
        rating: {
            type: Number,
            min: 0,
            max: 5,
            default: 0,
        },
        coverImage: {
            type: String,
        },
        releaseDate: {
            type: Date,
        },
        isActive: {
            type: Boolean,
            default: true,
        }
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("Product", productSchema);