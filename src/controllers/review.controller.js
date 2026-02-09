const reviewService = require("../services/review.service");
const productService = require("../services/product.service");

async function getReviews(req, res, next) {
    try {
        const productId = req.params.id;
        const product = await productService.getProductById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }
        const page = parseInt(req.query.page, 10) || 1;
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
        const sort = req.query.sort === "createdAt" ? "createdAt" : "-createdAt";
        const { reviews, total } = await reviewService.getReviewsForProduct(productId, { page, limit, sort });
        const summary = reviewService.getReviewSummary(product.reviewCount, product.positiveCount);
        res.status(200).json({
            success: true,
            data: {
                summary,
                reviews,
                meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
            },
        });
    } catch (error) {
        next(error);
    }
}

async function createOrUpdateReview(req, res, next) {
    try {
        const productId = req.params.id;
        const userId = req.user.id;
        const product = await productService.getProductById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }
        const review = await reviewService.createOrUpdateReview(userId, productId, req.body);
        res.status(200).json({ success: true, data: review });
    } catch (error) {
        next(error);
    }
}

async function deleteMyReview(req, res, next) {
    try {
        const productId = req.params.id;
        const userId = req.user.id;
        const deleted = await reviewService.deleteReview(userId, productId);
        if (!deleted) {
            return res.status(404).json({ success: false, message: "Review not found" });
        }
        res.status(200).json({ success: true, message: "Review deleted" });
    } catch (error) {
        next(error);
    }
}

async function getMyReview(req, res, next) {
    try {
        const productId = req.params.id;
        const userId = req.user.id;
        const product = await productService.getProductById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }
        const review = await reviewService.getMyReview(userId, productId);
        res.status(200).json({ success: true, data: review });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getReviews,
    createOrUpdateReview,
    deleteMyReview,
    getMyReview,
};
