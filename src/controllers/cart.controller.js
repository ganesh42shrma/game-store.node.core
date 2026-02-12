const cartService = require("../services/cart.service");

async function getCart(req, res, next) {
    try {
        const cart = await cartService.getCartByUserId(req.user.id);
        res.success(cart);
    } catch (error) {
        next(error);
    }
}

async function addItem(req, res, next) {
    try {
        const { productId, quantity } = req.body;
        const cart = await cartService.addItem(req.user.id, productId, quantity);
        if (!cart) {
            return res.sendError("Product not found or inactive", 404);
        }
        res.success(cart);
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
            return res.sendError("Cart or item not found", 404);
        }
        res.success(cart);
    } catch (error) {
        next(error);
    }
}

async function removeItem(req, res, next) {
    try {
        const cart = await cartService.removeItem(req.user.id, req.params.productId);
        res.success(cart);
    } catch (error) {
        next(error);
    }
}

async function clearCart(req, res, next) {
    try {
        const cart = await cartService.clearCart(req.user.id);
        res.successWithMessage(cart, "Cart cleared");
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
