const Order = require("../models/order.model");
const Cart = require("../models/cart.model");
const Product = require("../models/product.model");

async function createOrderFromCart(userId) {
    const cart = await Cart.findOne({ user: userId }).populate("items.product");
    if (!cart || !cart.items || cart.items.length === 0) {
        return { order: null, code: "EMPTY_CART" };
    }
    const orderItems = [];
    let totalAmount = 0;
    for (const line of cart.items) {
        const product = line.product;
        if (!product || !product.isActive) {
            continue;
        }
        const price = product.price;
        const qty = line.quantity;
        orderItems.push({
            product: product._id,
            title: product.title,
            quantity: qty,
            price,
        });
        totalAmount += price * qty;
    }
    if (orderItems.length === 0) {
        return { order: null, code: "NO_VALID_ITEMS" };
    }
    const order = await Order.create({
        user: userId,
        items: orderItems,
        totalAmount,
        status: "pending",
    });
    cart.items = [];
    await cart.save();
    const populated = await Order.findById(order._id).populate({
        path: "items.product",
        select: "title price platform",
    });
    return { order: populated, code: "OK" };
}

async function getOrdersByUserId(userId, queryParams) {
    const { page = 1, limit = 10, status, sort } = queryParams;
    const filter = { user: userId };
    if (status) filter.status = status;
    let query = Order.find(filter)
        .sort(sort ? sort.split(",").join(" ") : "-createdAt")
        .populate({ path: "items.product", select: "title price platform" });
    const skip = (Number(page) - 1) * Number(limit);
    query = query.skip(skip).limit(Number(limit));
    const [orders, total] = await Promise.all([
        query.exec(),
        Order.countDocuments(filter),
    ]);
    return { orders, total, page: Number(page), limit: Number(limit) };
}

async function getOrderById(orderId, userId) {
    const order = await Order.findOne({ _id: orderId, user: userId }).populate({
        path: "items.product",
        select: "title price platform coverImage",
    });
    return order;
}

module.exports = {
    createOrderFromCart,
    getOrdersByUserId,
    getOrderById,
};
