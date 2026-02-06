const productService = require("../services/product.service");

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
        console.log("REQ BODY:", req.body)
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
        const product = await productService.deleteProduct(req.params.id)
        if (!product) {
            res.status(404).json({
                success: false,
                message: "Product not found",
            })
        }
        res.status(200).json({
            success: true,
            message: `Product deleted successfully.`
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
    deleteProduct
}