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

const router = express.Router();

/**
 * Module Routes
 */
router.use("/products", productRoutes);
router.use("/users", userRoutes);
router.use("/auth", authRoutes);
router.use("/cart", cartRoutes);
router.use("/orders", orderRoutes);
router.use("/addresses", addressRoutes);
router.use("/payments", paymentRoutes);
router.use("/invoices", invoiceRoutes);
router.use("/admin", adminRoutes);
module.exports = router;