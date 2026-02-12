const productService = require("../services/product.service");
const uploadService = require("../services/upload.service");
const { getReviewSummary } = require("../utils/reviewSummary");

async function getProducts(req, res, next) {
    try {
        const products = await productService.getAllProducts(req.query);
        res.success(products);
    } catch (error) {
        next(error);
    }
}

async function getProductTags(req, res, next) {
    try {
        const tags = await productService.getAllTags();
        res.success(tags);
    } catch (error) {
        next(error);
    }
}

async function getProduct(req, res, next) {
    try {
        const product = await productService.getProductById(req.params.id);
        if (!product) {
            return res.sendError("Product not found", 404);
        }
        const data = product.toJSON ? product.toJSON() : product;
        data.reviewSummary = getReviewSummary(
            data.reviewCount ?? 0,
            data.positiveCount ?? 0
        );
        res.success(data);
    } catch (error) {
        next(error);
    }
}

async function getRelatedProducts(req, res, next) {
    try {
        const product = await productService.getProductById(req.params.id);
        if (!product) {
            return res.sendError("Product not found", 404);
        }
        const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 6));
        const related = await productService.getRelatedProducts(req.params.id, limit);
        res.success(related);
    } catch (error) {
        next(error);
    }
}

async function createProduct(req, res, next) {
    try {
        const product = await productService.createProduct(req.body);
        res.created(product);
    } catch (error) {
        next(error);
    }
}

async function updateProduct(req, res, next) {
    try {
        const product = await productService.updateProduct(
            req.params.id,
            req.body
        );
        if (!product) {
            return res.sendError("Product not found", 404);
        }
        res.success(product);
    } catch (error) {
        next(error);
    }
}

async function deleteProduct(req, res, next) {
    try {
        const product = await productService.deleteProduct(req.params.id);
        if (!product) {
            return res.sendError("Product not found", 404);
        }
        res.successMessage("Product deleted successfully.");
    } catch (error) {
        next(error);
    }
}

async function uploadProductImage(req, res, next) {
    try {
        if (!req.file || !req.file.buffer) {
            return res.sendError("No image file provided. Use multipart/form-data with field name 'image'.", 400);
        }
        const productId = req.params.id;
        const product = await productService.getProductById(productId);
        if (!product) {
            return res.sendError("Product not found", 404);
        }
        const key = uploadService.productImageKey(productId, req.file.originalname);
        const url = await uploadService.uploadToS3(
            req.file.buffer,
            key,
            req.file.mimetype
        );
        const updated = await productService.updateProductCoverImage(productId, url);
        res.success(updated);
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getProduct,
    getProducts,
    getProductTags,
    getRelatedProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    uploadProductImage,
};