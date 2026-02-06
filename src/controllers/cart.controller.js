const cartService = require("../services/cart.service");

async function getCart(req, res, next) {
    try {
        const cart = await cartService.getCartByUserId(req.user.id);
        res.status(200).json({
            success: true,
            data: cart,
        });
    } catch (error) {
        next(error);
    }
}

async function addItem(req, res, next) {
    try {
        const { productId, quantity } = req.body;
        const cart = await cartService.addItem(req.user.id, productId, quantity);
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: "Product not found or inactive",
            });
        }
        res.status(200).json({
            success: true,
            data: cart,
        });
    } catch (error) {
        next(error);
    }
}

async function updateItem(req, res, next) {
    try {
        const { productId } = req.params;
        const { quantity } = req.body;
        const cart = await cartService.updateItemQuantity(
            req.user.id,
            productId,
            quantity
        );
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: "Cart or item not found",
            });
        }
        res.status(200).json({
            success: true,
            data: cart,
        });
    } catch (error) {
        next(error);
    }
}

async function removeItem(req, res, next) {
    try {
        const cart = await cartService.removeItem(req.user.id, req.params.productId);
        res.status(200).json({
            success: true,
            data: cart,
        });
    } catch (error) {
        next(error);
    }
}

async function clearCart(req, res, next) {
    try {
        const cart = await cartService.clearCart(req.user.id);
        res.status(200).json({
            success: true,
            data: cart,
            message: "Cart cleared",
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getCart,
    addItem,
    updateItem,
    removeItem,
    clearCart,
};
