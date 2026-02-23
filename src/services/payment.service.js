const Payment = require("../models/payment.model");
const Order = require("../models/order.model");
const User = require("../models/user.model");
const invoiceService = require("./invoice.service");
const recentPurchaseEvents = require("./recentPurchaseEvents");
const mailer = require("./mailer.service");
const razorpay = require("../config/razorpay");
const crypto = require("crypto");

// async function createPaymentForOrder(orderId, userId, method = null) {
//     const order = await Order.findOne({ _id: orderId, user: userId });
//     if (!order) {
//         return { payment: null, code: "ORDER_NOT_FOUND" };
//     }
//     if (order.paymentStatus === "paid") {
//         return { payment: null, code: "ORDER_ALREADY_PAID" };
//     }
//     const existing = await Payment.findOne({
//         order: orderId,
//         user: userId,
//         status: { $in: ["created", "authorized"] },
//     });
//     if (existing) {
//         const mockPaymentUrl = `/pay/${existing._id}`;
//         return {
//             payment: existing,
//             mockPaymentUrl,
//             code: "OK",
//         };
//     }
//     const payment = await Payment.create({
//         order: orderId,
//         user: userId,
//         amount: order.totalAmount,
//         currency: "INR",
//         status: "created",
//         method: method || undefined,
//         gatewayPaymentId: null,
//     });
//     payment.gatewayPaymentId = `mock_${payment._id}`;
//     await payment.save();
//     const mockPaymentUrl = `/pay/${payment._id}`;
//     return { payment, mockPaymentUrl, code: "OK" };
// }

// async function getPaymentById(paymentId, userId) {
//     const payment = await Payment.findOne({
//         _id: paymentId,
//         user: userId,
//     }).populate({ path: "order", select: "totalAmount status paymentStatus" });
//     return payment;
// }

// async function confirmPayment(paymentId, userId) {
//     const payment = await Payment.findOne({
//         _id: paymentId,
//         user: userId,
//     });
//     if (!payment) {
//         return { payment: null, code: "PAYMENT_NOT_FOUND" };
//     }
//     if (payment.status === "captured") {
//         return { payment, code: "ALREADY_CAPTURED" };
//     }
//     if (payment.status === "failed") {
//         return { payment: null, code: "PAYMENT_FAILED" };
//     }
//     payment.status = "captured";
//     payment.capturedAt = new Date();
//     await payment.save();

//     await Order.findByIdAndUpdate(payment.order, {
//         paymentStatus: "paid",
//         paidAt: new Date(),
//         payment: payment._id,
//         status: "completed",
//     });

//     const order = await Order.findById(payment.order).populate("user", "name email").lean();
//     if (order) {
//         const invoice = await invoiceService.createInvoiceFromOrder(order);
//         // Email: purchase confirmation with invoice
//         const user = await User.findById(order.user).select("email name").lean();
//         if (user?.email) {
//             mailer.sendPurchaseWithInvoice({
//                 to: user.email,
//                 userName: user.name || "Customer",
//                 invoiceNumber: invoice.invoiceNumber,
//                 orderId: String(order._id),
//                 items: invoice.items || [],
//                 subTotal: invoice.subTotal,
//                 gstRate: invoice.gstRate,
//                 gstAmount: invoice.gstAmount,
//                 totalAmount: invoice.totalAmount,
//                 issuedAt: invoice.issuedAt,
//             });
//         }
//         // Broadcast for "Someone from X just purchased Y" toast (SSE)
//         const buyerName = order.user?.name?.trim().split(/\s+/)[0] || "Someone";
//         const country = order.billingAddress?.country || "Unknown";
//         const productTitles = (order.items || []).map((i) => i.title).filter(Boolean);
//         recentPurchaseEvents.addRecentPurchase({
//             buyerName,
//             country,
//             productTitles,
//             orderId: String(order._id),
//         });
//     }

//     const populated = await Payment.findById(payment._id).populate({
//         path: "order",
//         select: "totalAmount status paymentStatus paidAt",
//     });
//     return { payment: populated, code: "OK" };
// }

async function createRazorpayOrder(appOrderId){
    if (!razorpay) throw new Error("Razorpay not configured");
    const order = await Order.findById(appOrderId).lean();
    if (!order) throw new Error("Order not found");

    const amountInPaise = Math.round(Number(order.totalAmount || order.total || order.amount || 0) * 100);
    const options = {
        amount: amountInPaise,
        currency: "INR",
        receipt: String(appOrderId),
        payment_capture: 1, // auto-capture
        notes: { appOrderId: String(appOrderId) },
    };
    const rOrder = await razorpay.orders.create(options);

    const paymentDoc = await Payment.create({
        order: appOrderId,
        user: order.user || undefined,
        amount: amountInPaise / 100,
        currency: rOrder.currency || "INR",
        status: "created",
        gatewayPaymentId: rOrder.id,
        metadata: rOrder,
    });

    return { rOrder, payment: paymentDoc };
}

async function getPaymentById(paymentId, userId) {
    const payment = await Payment.findOne({ _id: paymentId, user: userId }).populate({
        path: "order",
        select: "totalAmount status paymentStatus",
    });
    return payment;
}

function verifyRazorpaySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature }){
    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(payload).digest("hex");
    return expected === (razorpay_signature || "");
}

async function handleRazorpaySuccess({ razorpay_order_id, razorpay_payment_id, razorpay_signature, appOrderId, payer }) {
    const ok = verifyRazorpaySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature });
    if (!ok) {
        throw new Error("Invalid Razorpay signature");
    }

    const payment = await Payment.findOneAndUpdate(
        { gatewayPaymentId: razorpay_order_id },
        {
            status: "captured",
            gatewayPaymentId: razorpay_payment_id,
            capturedAt: new Date(),
            ["metadata.razorpay_order_id"]: razorpay_order_id,
            ["metadata.razorpay_payment_id"]: razorpay_payment_id,
            method: "razorpay",
        },
        { new: true }
    );

    await Order.findByIdAndUpdate(appOrderId, { paymentStatus: "paid", status: "completed", paidAt: new Date(), payment: payment?._id });

    const order = await Order.findById(appOrderId).populate("user", "name email").lean();

    try{
        await invoiceService.createInvoiceFromOrder(order);
    }catch(e){
        console.warn("Failed to create invoice for Razorpay order", e);
    }

    // emit recent purchase event (if service exists)
  try {
    recentPurchaseEvents && recentPurchaseEvents.addRecentPurchase && recentPurchaseEvents.addRecentPurchase({
      buyerName: (payer && payer.name) || order.buyerName || "Customer",
      country: (order.shippingAddress && order.shippingAddress.country) || "Unknown",
      productTitles: order.items ? order.items.map(i => i.title || i.name) : [],
      orderId: String(appOrderId),
      at: new Date(),
    });
  } catch (e) {}

  return { payment,order };
}

async function handleRazorpayWebhook(payload) {
    // payload is the parsed webhook JSON from Razorpay
    const event = payload.event;
    try {
        if (event === "payment.captured") {
            const entity = payload.payload?.payment?.entity;
            if (!entity) return;
            const razorpay_payment_id = entity.id;
            const razorpay_order_id = entity.order_id;

            // Find payment by various possible stored locations
            const payment = await Payment.findOneAndUpdate(
                {
                    $or: [
                        { gatewayPaymentId: razorpay_order_id },
                        { gatewayPaymentId: razorpay_payment_id },
                        { "metadata.id": razorpay_order_id },
                        { "metadata.order_id": razorpay_order_id },
                        { "metadata.razorpay_order_id": razorpay_order_id },
                    ],
                },
                {
                    status: "captured",
                    gatewayPaymentId: razorpay_payment_id,
                    capturedAt: new Date(),
                    ["metadata.razorpay_order_id"]: razorpay_order_id,
                    ["metadata.razorpay_payment_id"]: razorpay_payment_id,
                    method: "razorpay",
                },
                { new: true }
            );

            if (payment) {
                await Order.findByIdAndUpdate(payment.order, { paymentStatus: "paid", status: "completed", paidAt: new Date(), payment: payment._id });
                const order = await Order.findById(payment.order).populate("user", "name email").lean();
                try { await invoiceService.createInvoiceFromOrder(order); } catch (e) { console.warn("Invoice create failed (webhook)", e); }
                try { recentPurchaseEvents.addRecentPurchase && recentPurchaseEvents.addRecentPurchase({ buyerName: order.user?.name?.split(" ")[0] || "Customer", country: order.billingAddress?.country || "Unknown", productTitles: order.items?.map(i=>i.title), orderId: String(order._id), at: new Date() }); } catch(e){}
            }
        } else if (event === "payment.failed") {
            const entity = payload.payload?.payment?.entity;
            if (!entity) return;
            const razorpay_payment_id = entity.id;
            const razorpay_order_id = entity.order_id;
            await Payment.findOneAndUpdate(
                {
                    $or: [
                        { gatewayPaymentId: razorpay_order_id },
                        { gatewayPaymentId: razorpay_payment_id },
                        { "metadata.id": razorpay_order_id },
                        { "metadata.order_id": razorpay_order_id },
                    ],
                },
                { status: "failed", gatewayPaymentId: razorpay_payment_id },
                { new: true }
            );
        } else if (event === "order.paid") {
            // optional: handle order-level events
        }
    } catch (e) {
        console.warn("Error handling Razorpay webhook", e);
        throw e;
    }
}

module.exports = {
    createRazorpayOrder,
    verifyRazorpaySignature,
    handleRazorpaySuccess,
    getPaymentById,
    // createPaymentForOrder,
    // getPaymentById,
    // confirmPayment,
};
