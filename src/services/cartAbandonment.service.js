/**
 * Cart abandonment: find carts not updated for several hours and send "complete your purchase" emails.
 * Run via cron (e.g. every hour) by executing: node src/scripts/run-cart-abandonment-emails.js
 */

const Cart = require("../models/cart.model");
const User = require("../models/user.model");
const mailer = require("./mailer.service");

const DEFAULT_HOURS_OLD = 3;
const MIN_HOURS_SINCE_LAST_EMAIL = 24;

/**
 * Find carts that have items and were last updated more than `hoursOld` ago,
 * and for which we haven't sent an abandonment email in the last `minHoursSinceLastEmail`.
 * Sends one email per cart and marks lastAbandonmentEmailSentAt.
 * @param {{ hoursOld?: number, minHoursSinceLastEmail?: number }} options
 * @returns {Promise<{ sent: number, skipped: number }>}
 */
async function runCartAbandonmentEmails(options = {}) {
    const hoursOld = options.hoursOld ?? DEFAULT_HOURS_OLD;
    const minHoursSinceLastEmail = options.minHoursSinceLastEmail ?? MIN_HOURS_SINCE_LAST_EMAIL;
    const cutoff = new Date(Date.now() - hoursOld * 60 * 60 * 1000);
    const lastEmailCutoff = new Date(Date.now() - minHoursSinceLastEmail * 60 * 60 * 1000);

    const carts = await Cart.find({
        "items.0": { $exists: true },
        updatedAt: { $lt: cutoff },
        $or: [
            { lastAbandonmentEmailSentAt: null },
            { lastAbandonmentEmailSentAt: { $lt: lastEmailCutoff } },
        ],
    })
        .populate({
            path: "items.product",
            select: "title price isOnSale discountedPrice isActive",
        })
        .populate("user", "email name")
        .lean();

    let sent = 0;
    let skipped = 0;

    for (const cart of carts) {
        const user = cart.user;
        if (!user?.email) {
            skipped++;
            continue;
        }
        const activeItems = (cart.items || []).filter(
            (i) => i.product && i.product.isActive !== false
        );
        if (activeItems.length === 0) {
            skipped++;
            continue;
        }

        let cartTotal = 0;
        const items = activeItems.map((item) => {
            const price =
                item.product.isOnSale && item.product.discountedPrice != null
                    ? item.product.discountedPrice
                    : item.product.price;
            const lineTotal = price * item.quantity;
            cartTotal += lineTotal;
            return {
                title: item.product.title,
                quantity: item.quantity,
                price,
            };
        });

        await mailer.sendCartAbandonment({
            to: user.email,
            userName: user.name || "Customer",
            items,
            cartTotal,
            hoursLeft: hoursOld,
        });

        await Cart.findByIdAndUpdate(cart._id, {
            lastAbandonmentEmailSentAt: new Date(),
        });
        sent++;
    }

    return { sent, skipped };
}

module.exports = { runCartAbandonmentEmails };
