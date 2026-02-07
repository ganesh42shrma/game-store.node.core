const mongoose = require("mongoose");
const Invoice = require("../models/invoice.model");

async function getNextInvoiceNumber() {
    const counter = await mongoose.connection
        .collection("counters")
        .findOneAndUpdate(
            { _id: "invoice" },
            { $inc: { seq: 1 } },
            { returnDocument: "after", upsert: true }
        );
    const year = new Date().getFullYear();
    const seq = counter.seq || counter.value;
    return `INV-${year}-${String(seq).padStart(5, "0")}`;
}

async function createInvoiceFromOrder(order) {
    const invoiceNumber = await getNextInvoiceNumber();
    const items = (order.items || []).map((item) => ({
        product: item.product,
        title: item.title,
        quantity: item.quantity,
        price: item.price,
        amount: Math.round(item.price * item.quantity * 100) / 100,
    }));
    const invoice = await Invoice.create({
        invoiceNumber,
        order: order._id,
        user: order.user,
        billingAddress: order.billingAddress || undefined,
        items,
        subTotal: order.subTotal,
        gstRate: order.gstRate,
        gstAmount: order.gstAmount,
        totalAmount: order.totalAmount,
        status: "issued",
        issuedAt: new Date(),
    });
    return invoice;
}

async function getInvoiceByOrderId(orderId, userId) {
    const invoice = await Invoice.findOne({
        order: orderId,
        user: userId,
    });
    return invoice;
}

async function getInvoiceById(invoiceId, userId, isAdmin = false) {
    const filter = { _id: invoiceId };
    if (!isAdmin) {
        filter.user = userId;
    }
    const invoice = await Invoice.findOne(filter).populate({
        path: "order",
        select: "paymentStatus paidAt status",
    });
    return invoice;
}

async function listInvoices(filters) {
    const { page = 1, limit = 10, from, to, userId, orderId, status } = filters;
    const query = {};
    if (userId) query.user = userId;
    if (orderId) query.order = orderId;
    if (status) query.status = status;
    if (from || to) {
        query.issuedAt = {};
        if (from) query.issuedAt.$gte = new Date(from);
        if (to) query.issuedAt.$lte = new Date(to);
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [invoices, total] = await Promise.all([
        Invoice.find(query)
            .sort({ issuedAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .populate({ path: "user", select: "email name" })
            .populate({ path: "order", select: "paymentStatus paidAt" })
            .lean(),
        Invoice.countDocuments(query),
    ]);
    return {
        invoices,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)) || 1,
    };
}

async function updateInvoice(invoiceId, data) {
    const invoice = await Invoice.findByIdAndUpdate(
        invoiceId,
        { $set: data },
        { new: true }
    );
    return invoice;
}

module.exports = {
    getNextInvoiceNumber,
    createInvoiceFromOrder,
    getInvoiceByOrderId,
    getInvoiceById,
    listInvoices,
    updateInvoice,
};
