/**
 * Fetch all products and put a subset on sale with a discounted price.
 * Sends "game on sale" emails to users who have those products in their cart.
 * Run: node src/scripts/put-some-products-on-sale.js
 * Env: MONGODB_URI, SEND_GRID_API_KEY, MAIL_FROM (for sale notifications)
 */
require("dotenv").config();

const { connectDB } = require("../config/db");
const Product = require("../models/product.model");
const { notifyCartUsersOfSale } = require("../services/saleNotification.service");

const HOW_MANY_ON_SALE = 10;
const MIN_DISCOUNT_PERCENT = 10;
const MAX_DISCOUNT_PERCENT = 35;

function randomDiscountPercent() {
    return MIN_DISCOUNT_PERCENT + Math.random() * (MAX_DISCOUNT_PERCENT - MIN_DISCOUNT_PERCENT);
}

function discountedPrice(price, percentOff) {
    return Math.round(price * (1 - percentOff / 100) * 100) / 100;
}

async function main() {
    await connectDB();

    const all = await Product.find({}).sort("_id").lean();
    console.log("Total products:", all.length);

    if (all.length === 0) {
        console.log("No products found.");
        process.exit(0);
    }

    const toPutOnSale = all.slice(0, Math.min(HOW_MANY_ON_SALE, all.length));
    console.log("Putting", toPutOnSale.length, "products on sale...\n");

    const putOnSaleIds = [];

    for (const p of toPutOnSale) {
        const percentOff = randomDiscountPercent();
        const newDiscounted = discountedPrice(p.price, percentOff);
        if (newDiscounted >= p.price) {
            console.log("SKIP", p.title, "- discount would be invalid");
            continue;
        }
        await Product.findByIdAndUpdate(p._id, {
            isOnSale: true,
            discountedPrice: newDiscounted,
        });
        putOnSaleIds.push(p._id.toString());
        console.log(
            "OK:",
            p.title,
            "|",
            p.price,
            "->",
            newDiscounted,
            `(${percentOff.toFixed(0)}% off)`
        );
    }

    if (putOnSaleIds.length > 0) {
        const result = await notifyCartUsersOfSale(putOnSaleIds);
        console.log("\nSale notifications:", result.emailsSent, "emails sent to", result.usersNotified, "users");
    }

    console.log("\nDone.");
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
