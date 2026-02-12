/**
 * Set isActive: true on all products.
 * Run from project root: node src/scripts/set-all-products-active.js
 */
require("dotenv").config();
const { connectDB } = require("../config/db");
const Product = require("../models/product.model");

async function setAllProductsActive() {
    await connectDB();

    const result = await Product.updateMany(
        {},
        { $set: { isActive: true } }
    );

    console.log("Updated", result.modifiedCount, "of", result.matchedCount, "products to isActive: true.");
    process.exit(0);
}

setAllProductsActive().catch((err) => {
    console.error(err);
    process.exit(1);
});
