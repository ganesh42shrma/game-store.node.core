const Payment = require("../models/payment.model");
const Order = require("../models/order.model");
const invoiceService = require("./invoice.service");

async function createPaymentForOrder(orderId, userId, method = null) {
    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) {
        return { payment: null, code: "ORDER_NOT_FOUND" };
    }
    if (order.paymentStatus === "paid") {
        return { payment: null, code: "ORDER_ALREADY_PAID" };
    }
    const existing = await Payment.findOne({
        order: orderId,
        user: userId,
        status: { $in: ["created", "authorized"] },
    });
    if (existing) {
        const mockPaymentUrl = `/pay/${existing._id}`;
        return {
            payment: existing,
            mockPaymentUrl,
            code: "OK",
        };
    }
    const payment = await Payment.create({
        order: orderId,
        user: userId,
        amount: order.totalAmount,
        currency: "INR",
        status: "created",
        method: method || undefined,
        gatewayPaymentId: null,
    });
    payment.gatewayPaymentId = `mock_${payment._id}`;
    await payment.save();
    const mockPaymentUrl = `/pay/${payment._id}`;
    return { payment, mockPaymentUrl, code: "OK" };
}

async function getPaymentById(paymentId, userId) {
    const payment = await Payment.findOne({
        _id: paymentId,
        user: userId,
    }).populate({ path: "order", select: "totalAmount status paymentStatus" });
    return payment;
}

async function confirmPayment(paymentId, userId) {
    const payment = await Payment.findOne({
        _id: paymentId,
        user: userId,
    });
    if (!payment) {
        return { payment: null, code: "PAYMENT_NOT_FOUND" };
    }
    if (payment.status === "captured") {
        return { payment, code: "ALREADY_CAPTURED" };
    }
    if (payment.status === "failed") {
        return { payment: null, code: "PAYMENT_FAILED" };
    }
    payment.status = "captured";
    payment.capturedAt = new Date();
    await payment.save();

    await Order.findByIdAndUpdate(payment.order, {
        paymentStatus: "paid",
        paidAt: new Date(),
        payment: payment._id,
        status: "completed",
    });

    const order = await Order.findById(payment.order).lean();
    if (order) {
        await invoiceService.createInvoiceFromOrder(order);
    }

    const populated = await Payment.findById(payment._id).populate({
        path: "order",
        select: "totalAmount status paymentStatus paidAt",
    });
    return { payment: populated, code: "OK" };
}

module.exports = {
    createPaymentForOrder,
    getPaymentById,
    confirmPayment,
};
