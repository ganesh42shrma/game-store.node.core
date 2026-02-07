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
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }
        if (result.code === "ORDER_ALREADY_PAID") {
            return res.status(400).json({
                success: false,
                message: "Order is already paid",
            });
        }
        res.status(201).json({
            success: true,
            data: {
                payment: result.payment,
                mockPaymentUrl: result.mockPaymentUrl,
            },
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
            return res.status(404).json({
                success: false,
                message: "Payment not found",
            });
        }
        res.status(200).json({
            success: true,
            data: payment,
        });
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
            return res.status(404).json({
                success: false,
                message: "Payment not found",
            });
        }
        if (result.code === "ALREADY_CAPTURED") {
            return res.status(200).json({
                success: true,
                data: result.payment,
                message: "Payment already captured",
            });
        }
        if (result.code === "PAYMENT_FAILED") {
            return res.status(400).json({
                success: false,
                message: "Payment has failed",
            });
        }
        res.status(200).json({
            success: true,
            data: result.payment,
            message: "Payment confirmed successfully",
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    createPayment,
    getPayment,
    confirmPayment,
};
