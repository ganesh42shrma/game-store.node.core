const Order = require("../models/order.model");
const Cart = require("../models/cart.model");
const Product = require("../models/product.model");
const Address = require("../models/address.model");

const GST_RATE = 18;

async function createOrderFromCart(userId, addressId = null) {
    const cart = await Cart.findOne({ user: userId }).populate("items.product");
    if (!cart || !cart.items || cart.items.length === 0) {
        return { order: null, code: "EMPTY_CART" };
    }

    let billingAddress = null;
    if (addressId) {
        const address = await Address.findOne({
            _id: addressId,
            user: userId,
        });
        if (!address) {
            return { order: null, code: "ADDRESS_NOT_FOUND" };
        }
        billingAddress = {
            line1: address.line1,
            line2: address.line2 || undefined,
            city: address.city,
            state: address.state,
            pincode: address.pincode,
            country: address.country || "India",
            phone: address.phone || undefined,
        };
    }

    const orderItems = [];
    let subtotal = 0;
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
        subtotal += price * qty;
    }
    if (orderItems.length === 0) {
        return { order: null, code: "NO_VALID_ITEMS" };
    }

    const gstAmount = Math.round(subtotal * (GST_RATE / 100) * 100) / 100;
    const totalAmount = Math.round((subtotal + gstAmount) * 100) / 100;

    const order = await Order.create({
        user: userId,
        items: orderItems,
        billingAddress: billingAddress || undefined,
        subTotal: subtotal,
        gstRate: GST_RATE,
        gstAmount,
        totalAmount,
        status: "pending",
        paymentStatus: "unpaid",
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

async function getOrdersForAdmin(filters) {
    const { page = 1, limit = 10, status, paymentStatus, userId, from, to, sort } = filters;
    const query = {};
    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (userId) query.user = userId;
    if (from || to) {
        query.createdAt = {};
        if (from) query.createdAt.$gte = new Date(from);
        if (to) query.createdAt.$lte = new Date(to);
    }
    const skip = (Number(page) - 1) * Number(limit);
    const sortStr = sort ? sort.split(",").join(" ") : "-createdAt";
    const [orders, total] = await Promise.all([
        Order.find(query)
            .sort(sortStr)
            .skip(skip)
            .limit(Number(limit))
            .populate({ path: "user", select: "email name" })
            .populate({ path: "items.product", select: "title price platform" })
            .lean(),
        Order.countDocuments(query),
    ]);
    return {
        orders,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)) || 1,
    };
}

async function updateOrderStatus(orderId, status) {
    const { ORDER_STATUS } = require("../models/order.model");
    if (!ORDER_STATUS.includes(status)) {
        return null;
    }
    const order = await Order.findByIdAndUpdate(
        orderId,
        { $set: { status } },
        { new: true }
    ).populate({ path: "items.product", select: "title price platform" });
    return order;
}

module.exports = {
    createOrderFromCart,
    getOrdersByUserId,
    getOrderById,
    getOrdersForAdmin,
    updateOrderStatus,
};
