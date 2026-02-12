"use strict";

const UserProductAlert = require("../models/userProductAlert.model");
const User = require("../models/user.model");
const Product = require("../models/product.model");
const logger = require("../config/logger");

const { ALERT_TRIGGER_TYPES } = require("../models/userProductAlert.model");

/**
 * Create a product alert for a user.
 * @param {{ userId: string, productId: string, triggerType: string, priceThreshold?: number }} input
 * @returns {Promise<{ alert: object, created: boolean }>}
 */
async function createAlert(input) {
  const { userId, productId, triggerType, priceThreshold } = input;
  if (!userId || !productId || !triggerType || !ALERT_TRIGGER_TYPES.includes(triggerType)) {
    throw new Error("Invalid alert: userId, productId, and valid triggerType required");
  }
  if ((triggerType === "price_drop" || triggerType === "price_below") && (priceThreshold == null || typeof priceThreshold !== "number" || priceThreshold < 0)) {
    throw new Error("priceThreshold required for price_drop and price_below");
  }

  const product = await Product.findById(productId).lean();
  if (!product) {
    throw new Error("Product not found");
  }

  const existing = await UserProductAlert.findOne({
    user: userId,
    product: productId,
    triggerType,
    isActive: true,
  });

  if (existing) {
    const updates = {};
    if (priceThreshold != null) updates.priceThreshold = priceThreshold;
    if (Object.keys(updates).length > 0) {
      const updated = await UserProductAlert.findByIdAndUpdate(existing._id, updates, { new: true }).lean();
      return { alert: updated, created: false };
    }
    return { alert: existing, created: false };
  }

  const payload = {
    user: userId,
    product: productId,
    triggerType,
    isActive: true,
  };
  if (priceThreshold != null) payload.priceThreshold = priceThreshold;

  const alert = await UserProductAlert.create(payload);
  logger.info("[productAlert] Created", { userId, productId, triggerType, priceThreshold });
  return { alert: alert.toObject(), created: true };
}

/**
 * List active alerts for a user.
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
async function listUserAlerts(userId) {
  if (!userId) return [];
  const alerts = await UserProductAlert.find({ user: userId, isActive: true })
    .populate("product", "title price discountedPrice isOnSale stock isActive")
    .sort({ createdAt: -1 })
    .lean();

  return alerts.map((a) => ({
    id: a._id.toString(),
    productId: a.product?._id?.toString(),
    productTitle: a.product?.title,
    triggerType: a.triggerType,
    priceThreshold: a.priceThreshold,
    createdAt: a.createdAt,
  }));
}

/**
 * Deactivate an alert.
 * @param {string} alertId
 * @param {string} userId - optional, for ownership check
 */
async function deactivateAlert(alertId, userId) {
  const query = { _id: alertId };
  if (userId) query.user = userId;
  const result = await UserProductAlert.updateOne(query, { $set: { isActive: false } });
  if (result.modifiedCount) {
    logger.info("[productAlert] Deactivated", { alertId, userId });
  }
  return result.modifiedCount > 0;
}

/**
 * Get all active alerts grouped by product (for cron job).
 * @returns {Promise<Array<{ productId: string, alerts: object[] }>>}
 */
async function getActiveAlertsByProduct() {
  const alerts = await UserProductAlert.find({ isActive: true })
    .populate("user", "email name")
    .populate("product", "title price discountedPrice isOnSale stock isActive")
    .lean();

  const byProduct = new Map();
  for (const a of alerts) {
    const pid = a.product?._id?.toString();
    if (!pid || !a.product?.isActive) continue;
    if (!byProduct.has(pid)) {
      byProduct.set(pid, { productId: pid, product: a.product, alerts: [] });
    }
    byProduct.get(pid).alerts.push(a);
  }

  return [...byProduct.values()];
}

/**
 * Check if a product state matches an alert.
 * @param {object} product - product doc with price, discountedPrice, isOnSale, stock
 * @param {object} alert - alert with triggerType, priceThreshold
 * @returns {boolean}
 */
function alertMatchesProduct(product, alert) {
  const price = product.isOnSale && product.discountedPrice != null ? product.discountedPrice : product.price;
  const stock = product.stock ?? 0;

  switch (alert.triggerType) {
    case "on_sale":
      return product.isOnSale === true && product.discountedPrice != null;
    case "available":
      return stock > 0;
    case "price_drop":
    case "price_below":
      if (alert.priceThreshold == null) return false;
      return price <= alert.priceThreshold;
    default:
      return false;
  }
}

module.exports = {
  createAlert,
  listUserAlerts,
  deactivateAlert,
  getActiveAlertsByProduct,
  alertMatchesProduct,
};
