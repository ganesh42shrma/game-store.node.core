const paymentService = require("../services/payment.service");

async function createPayment(req, res, next) {
    try {
        const { orderId, method } = req.body;
        const result = await paymentService.createPaymentForOrder(
            orderId,
            req.user.id,
            method
        );
        if (result.code === "ORDER_NOT_FOUND") {
            return res.sendError("Order not found", 404);
        }
        if (result.code === "ORDER_ALREADY_PAID") {
            return res.sendError("Order is already paid", 400);
        }
        res.created({
            payment: result.payment,
            mockPaymentUrl: result.mockPaymentUrl,
        });
    } catch (error) {
        next(error);
    }
}

async function getPayment(req, res, next) {
    try {
        const payment = await paymentService.getPaymentById(
            req.params.id,
            req.user.id
        );
        if (!payment) {
            return res.sendError("Payment not found", 404);
        }
        res.success(payment);
    } catch (error) {
        next(error);
    }
}

async function confirmPayment(req, res, next) {
    try {
        const result = await paymentService.confirmPayment(
            req.params.id,
            req.user.id
        );
        if (result.code === "PAYMENT_NOT_FOUND") {
            return res.sendError("Payment not found", 404);
        }
        if (result.code === "ALREADY_CAPTURED") {
            return res.successWithMessage(result.payment, "Payment already captured");
        }
        if (result.code === "PAYMENT_FAILED") {
            return res.sendError("Payment has failed", 400);
        }
        res.successWithMessage(result.payment, "Payment confirmed successfully");
    } catch (error) {
        next(error);
    }
}

module.exports = {
    createPayment,
    getPayment,
    confirmPayment,
};
