const mongoose = require("mongoose");

const DEFAULT_COVER_IMAGE_URL =
    "https://developer-s3-mh-dev.s3.ap-south-1.amazonaws.com/default-gamr.avif";

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
            default: DEFAULT_COVER_IMAGE_URL,
        },
        youtubeLinks: {
            type: [String],
            default: [],
            validate: {
                validator(v) {
                    return v.length <= 3;
                },
                message: "At most 3 YouTube links allowed",
            },
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
        toJSON: {
            transform(doc, ret) {
                ret.coverImage = ret.coverImage || DEFAULT_COVER_IMAGE_URL;
                ret.youtubeLinks = Array.isArray(ret.youtubeLinks) ? ret.youtubeLinks : [];
                return ret;
            },
        },
    }
);

module.exports = mongoose.model("Product", productSchema);
module.exports.DEFAULT_COVER_IMAGE_URL = DEFAULT_COVER_IMAGE_URL;