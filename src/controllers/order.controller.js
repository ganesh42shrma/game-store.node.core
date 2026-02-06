const orderService = require("../services/order.service");

async function createOrder(req, res, next) {
    try {
        const result = await orderService.createOrderFromCart(req.user.id);
        if (result.code === "EMPTY_CART") {
            return res.status(400).json({
                success: false,
                message: "Cart is empty",
            });
        }
        if (result.code === "NO_VALID_ITEMS") {
            return res.status(400).json({
                success: false,
                message: "No valid products in cart",
            });
        }
        res.status(201).json({
            success: true,
            data: result.order,
        });
    } catch (error) {
        next(error);
    }
}

async function getOrders(req, res, next) {
    try {
        const { orders, total, page, limit } = await orderService.getOrdersByUserId(
            req.user.id,
            req.query
        );
        const totalPages = Math.ceil(total / limit) || 1;
        res.status(200).json({
            success: true,
            data: orders,
            meta: { total, page, limit, totalPages },
        });
    } catch (error) {
        next(error);
    }
}

async function getOrder(req, res, next) {
    try {
        const order = await orderService.getOrderById(
            req.params.id,
            req.user.id
        );
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }
        res.status(200).json({
            success: true,
            data: order,
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    createOrder,
    getOrders,
    getOrder,
};
