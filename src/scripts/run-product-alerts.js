"use strict";

/**
 * Run product alert cron: check user alerts against product state,
 * fire notifications (email + in-app) when conditions match.
 *
 * Usage: node src/scripts/run-product-alerts.js
 *
 * Schedule with cron, e.g. every 15 minutes:
 *   */15 * * * * cd /path/to/project && node src/scripts/run-product-alerts.js
 *
 * Env: MONGODB_URI, SEND_GRID_API_KEY, MAIL_FROM
 */
require("dotenv").config();

const { connectDB } = require("../config/db");
const { runAlertCron } = require("../services/alertCron.service");

async function main() {
  await connectDB();
  const result = await runAlertCron();
  console.log("Product alerts:", result);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
