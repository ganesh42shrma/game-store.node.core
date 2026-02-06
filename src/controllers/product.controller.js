const productService = require("../services/product.service");
const uploadService = require("../services/upload.service");

async function getProducts(req, res, next) {
    try {
        const products = await productService.getAllProducts(req.query);
        res.status(200).json({
            success: true,
            data: products,
        });
    } catch (error) {
        next(error);
    }
}

async function getProduct(req, res, next) {
    try {
        const product = await productService.getProductById(req.params.id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }
        res.status(200).json({
            success: true,
            data: product,
        })
    } catch (error) {
        next(error);
    }
}

async function createProduct(req, res, next) {
    try {
        const product = await productService.createProduct(req.body);

        res.status(201).json({
            success: true,
            data: product,
        })
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
            return res.status(404).json({
                success: false,
                message: "Product not found"
            })
        }

        res.status(200).json({
            success: true,
            data: product
        })

    } catch (error) {
        next(error);
    }
}

async function deleteProduct(req, res, next) {
    try {
        const product = await productService.deleteProduct(req.params.id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }
        res.status(200).json({
            success: true,
            message: "Product deleted successfully.",
        });
    } catch (error) {
        next(error);
    }
}

async function uploadProductImage(req, res, next) {
    try {
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({
                success: false,
                message: "No image file provided. Use multipart/form-data with field name 'image'.",
            });
        }
        const productId = req.params.id;
        const product = await productService.getProductById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }
        const key = uploadService.productImageKey(productId, req.file.originalname);
        const url = await uploadService.uploadToS3(
            req.file.buffer,
            key,
            req.file.mimetype
        );
        const updated = await productService.updateProductCoverImage(productId, url);
        res.status(200).json({
            success: true,
            data: updated,
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getProduct,
    getProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    uploadProductImage,
};