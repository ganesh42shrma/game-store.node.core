const Review = require("../models/review.model");
const Product = require("../models/product.model");
const { getReviewSummary } = require("../utils/reviewSummary");

const POSITIVE_RATING_THRESHOLD = 4;

async function updateProductReviewStats(productId) {
    const stats = await Review.aggregate([
        { $match: { product: productId } },
        {
            $group: {
                _id: null,
                count: { $sum: 1 },
                avg: { $avg: "$rating" },
                positive: { $sum: { $cond: [{ $gte: ["$rating", POSITIVE_RATING_THRESHOLD] }, 1, 0] } },
            },
        },
    ]);
    const doc = stats[0];
    const update = {
        reviewCount: doc ? doc.count : 0,
        positiveCount: doc ? doc.positive : 0,
        rating: doc ? Math.round(doc.avg * 10) / 10 : 0,
    };
    await Product.findByIdAndUpdate(productId, update);
    return update;
}

async function createOrUpdateReview(userId, productId, data) {
    const product = await Product.findById(productId);
    if (!product) return null;
    const { rating, comment } = data;
    const review = await Review.findOneAndUpdate(
        { user: userId, product: productId },
        { rating, comment: comment != null ? comment : "" },
        { new: true, upsert: true, runValidators: true }
    )
        .populate("user", "name profilePicture");
    await updateProductReviewStats(productId);
    return review;
}

async function deleteReview(userId, productId) {
    const deleted = await Review.findOneAndDelete({ user: userId, product: productId });
    if (deleted) await updateProductReviewStats(productId);
    return deleted;
}

async function getReviewsForProduct(productId, { page = 1, limit = 10, sort = "-createdAt" } = {}) {
    const skip = (Number(page) - 1) * Number(limit);
    const reviews = await Review.find({ product: productId })
        .populate("user", "name profilePicture")
        .sort(sort)
        .skip(skip)
        .limit(Math.min(50, Math.max(1, Number(limit))))
        .lean();
    const total = await Review.countDocuments({ product: productId });
    return { reviews, total };
}

async function getMyReview(userId, productId) {
    return Review.findOne({ user: userId, product: productId }).lean();
}

module.exports = {
    createOrUpdateReview,
    deleteReview,
    getReviewsForProduct,
    getMyReview,
    updateProductReviewStats,
    getReviewSummary,
};
