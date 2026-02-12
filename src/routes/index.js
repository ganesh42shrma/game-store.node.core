const express = require("express");

const productRoutes = require("./product.routes");
const userRoutes = require("./user.routes");
const authRoutes = require("./auth.routes");
const cartRoutes = require("./cart.routes");
const orderRoutes = require("./order.routes");
const addressRoutes = require("./address.routes");
const paymentRoutes = require("./payment.routes");
const invoiceRoutes = require("./invoice.routes");
const adminRoutes = require("./admin.routes");
const eventsRoutes = require("./events.routes");
const chatRoutes = require("./chat.routes");
const alertRoutes = require("./alert.routes");
const notificationRoutes = require("./notification.routes");

const router = express.Router();

/**
 * Module Routes
 */
router.use("/events", eventsRoutes);
router.use("/alerts", alertRoutes);
router.use("/notifications", notificationRoutes);
router.use("/products", productRoutes);
router.use("/users", userRoutes);
router.use("/auth", authRoutes);
router.use("/cart", cartRoutes);
router.use("/orders", orderRoutes);
router.use("/addresses", addressRoutes);
router.use("/payments", paymentRoutes);
router.use("/invoices", invoiceRoutes);
router.use("/admin", adminRoutes);
router.use("/chat", chatRoutes);
module.exports = router;