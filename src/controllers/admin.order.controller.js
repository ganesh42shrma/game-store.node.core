const orderService = require("../services/order.service");

async function listOrders(req, res, next) {
    try {
        const result = await orderService.getOrdersForAdmin(req.query);
        res.status(200).json({
            success: true,
            data: result.orders,
            meta: {
                total: result.total,
                page: result.page,
                limit: result.limit,
                totalPages: result.totalPages,
            },
        });
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
    listOrders,
    updateOrderStatus,
};
