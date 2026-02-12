"use strict";

const productAlertService = require("./productAlert.service");
const userNotificationService = require("./userNotification.service");
const UserProductAlert = require("../models/userProductAlert.model");
const logger = require("../config/logger");

/** Minimum hours between notifications for the same alert */
const COOLDOWN_HOURS = 24;

/**
 * Run the alert cron: check all active alerts against product state,
 * fire notifications for matches (with cooldown).
 * @returns {Promise<{ checked: number, fired: number, errors: number }>}
 */
async function runAlertCron() {
  const start = Date.now();
  const cutoff = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000);

  const byProduct = await productAlertService.getActiveAlertsByProduct();
  let fired = 0;
  let errors = 0;

  for (const { productId, product, alerts } of byProduct) {
    for (const alert of alerts) {
      try {
        const lastNotified = alert.lastNotifiedAt;
        if (lastNotified && new Date(lastNotified) > cutoff) {
          continue; // Cooldown
        }

        const matches = productAlertService.alertMatchesProduct(product, alert);
        if (!matches) continue;

        const effectivePrice = product.isOnSale && product.discountedPrice != null ? product.discountedPrice : product.price;
        let title, message;

        switch (alert.triggerType) {
          case "on_sale":
            title = "Game on sale!";
            message = `${product.title} is now on sale at ₹${effectivePrice.toFixed(2)}.`;
            break;
          case "available":
            title = "Game back in stock";
            message = `${product.title} is now available.`;
            break;
          case "price_drop":
          case "price_below":
            title = "Price alert!";
            message = `${product.title} is now ₹${effectivePrice.toFixed(2)} (your target: ₹${alert.priceThreshold.toFixed(2)}).`;
            break;
          default:
            continue;
        }

        await userNotificationService.createAndDeliver({
          userId: alert.user._id.toString(),
          type: alert.triggerType,
          productId,
          title,
          message,
          meta: {
            price: product.price,
            discountedPrice: product.discountedPrice,
            isOnSale: product.isOnSale,
            stock: product.stock,
          },
          alertId: alert._id.toString(),
        });

        await UserProductAlert.findByIdAndUpdate(alert._id, {
          lastNotifiedAt: new Date(),
        });

        fired++;
      } catch (err) {
        errors++;
        logger.error("[alertCron] Failed to fire notification", {
          alertId: alert._id,
          productId,
          error: err.message,
        });
      }
    }
  }

  const durationMs = Date.now() - start;
  logger.info("[alertCron] Complete", {
    productsChecked: byProduct.length,
    alertsFired: fired,
    errors,
    durationMs,
  });

  return {
    checked: byProduct.length,
    fired,
    errors,
  };
}

module.exports = { runAlertCron };
