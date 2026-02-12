const orderService = require("../services/order.service");

async function createOrder(req, res, next) {
    try {
        const addressId = req.body?.addressId || null;
        const result = await orderService.createOrderFromCart(
            req.user.id,
            addressId
        );
        if (result.code === "EMPTY_CART") {
            return res.sendError("Cart is empty", 400);
        }
        if (result.code === "ADDRESS_NOT_FOUND") {
            return res.sendError("Address not found", 400);
        }
        if (result.code === "NO_VALID_ITEMS") {
            return res.sendError("No valid products in cart", 400);
        }
        res.created(result.order);
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
        res.paginated(orders, { total, page, limit, totalPages });
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
            return res.sendError("Order not found", 404);
        }
        res.success(order);
    } catch (error) {
        next(error);
    }
}

module.exports = {
    createOrder,
    getOrders,
    getOrder,
};
