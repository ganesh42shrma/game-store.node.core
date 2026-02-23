const paymentService = require("../services/payment.service");

// async function createPayment(req, res, next) {
//     try {
//         const { orderId, method } = req.body;
//         const result = await paymentService.createPaymentForOrder(
//             orderId,
//             req.user.id,
//             method
//         );
//         if (result.code === "ORDER_NOT_FOUND") {
//             return res.sendError("Order not found", 404);
//         }
//         if (result.code === "ORDER_ALREADY_PAID") {
//             return res.sendError("Order is already paid", 400);
//         }
//         res.created({
//             payment: result.payment,
//             mockPaymentUrl: result.mockPaymentUrl,
//         });
//     } catch (error) {
//         next(error);
//     }
// }

async function createRazorpayOrder(req, res, next) {
    try {
        const { orderId } = req.body || {};
        if (!orderId) return res.sendError("Order Id is required", 400);

        const { rOrder } = await paymentService.createRazorpayOrder(orderId);

        res.status(200).json({
            key: process.env.RAZORPAY_KEY_ID,
            order: {
                id: rOrder.id,
                amount: rOrder.amount,
                currency: rOrder.currency,
            },
            appOrderId: String(orderId),
        })
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

// async function confirmPayment(req, res, next) {
//     try {
//         const result = await paymentService.confirmPayment(
//             req.params.id,
//             req.user.id
//         );
//         if (result.code === "PAYMENT_NOT_FOUND") {
//             return res.sendError("Payment not found", 404);
//         }
//         if (result.code === "ALREADY_CAPTURED") {
//             return res.successWithMessage(result.payment, "Payment already captured");
//         }
//         if (result.code === "PAYMENT_FAILED") {
//             return res.sendError("Payment has failed", 400);
//         }
//         res.successWithMessage(result.payment, "Payment confirmed successfully");
//     } catch (error) {
//         next(error);
//     }
// }

async function verifyRazorpayPayment(req, res, next) {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, appOrderId } = req.body || {};
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !appOrderId) {
            return res.sendError("Missing required fields", 400);
        }

        const result = await paymentService.handleRazorpaySuccess({
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            appOrderId,
            payer: req.user || null, // optional, if authenticated
        });

        res.status(200).json({ success: true, result });
    } catch(err){
        next(err);
    }
}

module.exports = {
    createRazorpayOrder,
    verifyRazorpayPayment,
    getPayment,
};
