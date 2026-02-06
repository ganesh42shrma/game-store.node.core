const Cart = require("../models/cart.model");
const Product = require("../models/product.model");

async function getCartByUserId(userId) {
    const cart = await Cart.findOne({ user: userId }).populate({
        path: "items.product",
        select: "title price platform coverImage isActive",
    });
    if (!cart) {
        return { items: [], user: userId };
    }
    const activeItems = (cart.items || []).filter(
        (item) => item.product && item.product.isActive !== false
    );
    return {
        _id: cart._id,
        user: cart.user,
        items: activeItems.map((item) => ({
            product: item.product,
            productId: item.product?._id,
            quantity: item.quantity,
        })),
    };
}

async function addItem(userId, productId, quantity) {
    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
        return null;
    }
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
        cart = await Cart.create({ user: userId, items: [] });
    }
    const existing = cart.items.find(
        (i) => i.product.toString() === productId.toString()
    );
    if (existing) {
        existing.quantity += quantity;
    } else {
        cart.items.push({ product: productId, quantity });
    }
    await cart.save();
    return getCartByUserId(userId);
}

async function updateItemQuantity(userId, productId, quantity) {
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
        return null;
    }
    const item = cart.items.find(
        (i) => i.product.toString() === productId.toString()
    );
    if (!item) {
        return null;
    }
    if (quantity === 0) {
        cart.items = cart.items.filter(
            (i) => i.product.toString() !== productId.toString()
        );
    } else {
        item.quantity = quantity;
    }
    await cart.save();
    return getCartByUserId(userId);
}

async function removeItem(userId, productId) {
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
        return getCartByUserId(userId);
    }
    cart.items = cart.items.filter(
        (i) => i.product.toString() !== productId.toString()
    );
    await cart.save();
    return getCartByUserId(userId);
}

async function clearCart(userId) {
    const cart = await Cart.findOne({ user: userId });
    if (cart) {
        cart.items = [];
        await cart.save();
    }
    return getCartByUserId(userId);
}

module.exports = {
    getCartByUserId,
    addItem,
    updateItemQuantity,
    removeItem,
    clearCart,
};
