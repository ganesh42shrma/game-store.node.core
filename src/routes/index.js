const express = require("express");

const productRoutes = require("./product.routes");
const userRoutes = require("./user.routes");
const authRoutes = require("./auth.routes");
const cartRoutes = require("./cart.routes");
const orderRoutes = require("./order.routes");

const router = express.Router();

/**
 * Module Routes
 */
router.use("/products", productRoutes);
router.use("/users", userRoutes);
router.use("/auth", authRoutes);
router.use("/cart", cartRoutes);
router.use("/orders", orderRoutes);
module.exports = router;