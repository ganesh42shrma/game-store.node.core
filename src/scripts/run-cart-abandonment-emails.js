/**
 * Run cart abandonment emails: send "complete your purchase" to users whose cart
 * has been unchanged for more than a few hours.
 * Usage: node src/scripts/run-cart-abandonment-emails.js
 * Env: MONGODB_URI, SEND_GRID_API_KEY, MAIL_FROM
 *
 * Optional env:
 *   CART_ABANDONMENT_HOURS=3   (send if cart not updated in this many hours)
 *   CART_ABANDONMENT_COOLDOWN_HOURS=24 (don't send again to same cart within this many hours)
 *
 * Schedule with cron, e.g. every hour:
 *   0 * * * * cd /path/to/project && node src/scripts/run-cart-abandonment-emails.js
 */
require("dotenv").config();

const { connectDB } = require("../config/db");
const { runCartAbandonmentEmails } = require("../services/cartAbandonment.service");

const hoursOld = Number(process.env.CART_ABANDONMENT_HOURS) || 3;
const cooldownHours = Number(process.env.CART_ABANDONMENT_COOLDOWN_HOURS) || 24;

async function main() {
    await connectDB();
    const result = await runCartAbandonmentEmails({
        hoursOld,
        minHoursSinceLastEmail: cooldownHours,
    });
    console.log("Cart abandonment emails:", result);
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
