/**
 * Notify users when games go on sale. Finds users who have the given products in their cart
 * and sends one "games on sale" email per user with the products they have in cart.
 */

const Cart = require("../models/cart.model");
const Product = require("../models/product.model");
const User = require("../models/user.model");
const mailer = require("./mailer.service");

/**
 * For each product ID in productIds (assumed to be on sale), find carts containing any of them.
 * For each user (by email), send one email listing the sale products they have in cart.
 * @param {string[]} productIds - ObjectIds of products that just went on sale
 * @returns {Promise<{ emailsSent: number, usersNotified: number }>}
 */
async function notifyCartUsersOfSale(productIds) {
    if (!Array.isArray(productIds) || productIds.length === 0) {
        return { emailsSent: 0, usersNotified: 0 };
    }

    const carts = await Cart.find({
        "items.product": { $in: productIds },
    })
        .populate({
            path: "items.product",
            select: "title price isOnSale discountedPrice isActive",
        })
        .lean();

    const userToProductIds = new Map();
    for (const cart of carts) {
        const userId = cart.user?.toString?.() || cart.user;
        if (!userId) continue;
        const saleProductIds = new Set(productIds.map((id) => id.toString()));
        const inCart = (cart.items || []).filter((item) => {
            const pid = item.product?._id?.toString?.() || item.product?.toString?.();
            return pid && saleProductIds.has(pid) && item.product?.isOnSale && item.product?.isActive;
        });
        if (inCart.length === 0) continue;
        const existing = userToProductIds.get(userId) || new Set();
        inCart.forEach((i) => existing.add((i.product._id || i.product).toString()));
        userToProductIds.set(userId, existing);
    }

    const userIds = [...userToProductIds.keys()];
    const users = await User.find({ _id: { $in: userIds } }).select("email name").lean();
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    let emailsSent = 0;
    const productCache = new Map();

    for (const userId of userIds) {
        const user = userMap.get(userId);
        if (!user?.email) continue;

        const pids = [...userToProductIds.get(userId)];
        const products = [];
        for (const pid of pids) {
            if (productCache.has(pid)) {
                products.push(productCache.get(pid));
                continue;
            }
            const p = await Product.findById(pid)
                .select("title price discountedPrice isOnSale")
                .lean();
            if (p && p.isOnSale && p.discountedPrice != null) {
                products.push({
                    title: p.title,
                    price: p.price,
                    discountedPrice: p.discountedPrice,
                    productId: pid,
                });
                productCache.set(pid, products[products.length - 1]);
            }
        }

        if (products.length === 0) continue;

        await mailer.sendGameOnSale({
            to: user.email,
            userName: user.name || "Customer",
            products,
        });
        emailsSent++;
    }

    return { emailsSent, usersNotified: emailsSent };
}

module.exports = { notifyCartUsersOfSale };
