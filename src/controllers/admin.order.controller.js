const orderService = require("../services/order.service");

async function listOrders(req, res, next) {
    try {
        const result = await orderService.getOrdersForAdmin(req.query);
        res.paginated(result.orders, {
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages,
        });
    } catch (error) {
        next(error);
    }
}

async function getOrder(req, res, next) {
    try {
        const order = await orderService.getOrderByIdForAdmin(req.params.id);
        if (!order) {
            return res.sendError("Order not found", 404);
        }
        res.success(order);
    } catch (error) {
        next(error);
    }
}

async function updateOrderStatus(req, res, next) {
    try {
        const order = await orderService.updateOrderStatus(
            req.params.id,
            req.body.status
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
    listOrders,
    getOrder,
    updateOrderStatus,
};
