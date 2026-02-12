"use strict";

const UserNotification = require("../models/userNotification.model");
const Product = require("../models/product.model");
const User = require("../models/user.model");
const mailer = require("./mailer.service");
const userNotificationEvents = require("./userNotificationEvents");
const logger = require("../config/logger");

/**
 * Create an in-app notification and optionally send email + push via SSE.
 * @param {{ userId: string, type: string, productId: string, title: string, message: string, meta?: object, alertId?: string }} input
 */
async function createAndDeliver(input) {
  const { userId, type, productId, title, message, meta = {}, alertId } = input;

  const product = await Product.findById(productId).select("title price discountedPrice isOnSale stock").lean();
  const user = await User.findById(userId).select("email name").lean();

  const notification = await UserNotification.create({
    user: userId,
    type,
    product: productId,
    title,
    message,
    meta: {
      price: meta.price ?? product?.price,
      discountedPrice: meta.discountedPrice ?? product?.discountedPrice,
      isOnSale: meta.isOnSale ?? product?.isOnSale,
      stock: meta.stock ?? product?.stock,
    },
    alertId: alertId || undefined,
  });

  const payload = {
    id: notification._id.toString(),
    type,
    productId,
    productTitle: product?.title,
    title,
    message,
    meta: notification.meta,
    createdAt: notification.createdAt,
  };

  // Push to SSE if user is connected
  userNotificationEvents.pushToUser(userId, payload);

  // Send email
  if (user?.email) {
    await mailer.sendProductAlert({
      to: user.email,
      userName: user.name || "Customer",
      title,
      message,
      productTitle: product?.title ?? "Game",
      productId,
      price: meta.price ?? product?.price,
      discountedPrice: meta.discountedPrice ?? product?.discountedPrice,
      isOnSale: meta.isOnSale ?? product?.isOnSale,
    });
  }

  logger.info("[userNotification] Created and delivered", { userId, type, productId });
  return notification;
}

/**
 * List notifications for a user.
 * @param {string} userId
 * @param {{ limit?: number, unreadOnly?: boolean }} options
 */
async function listForUser(userId, options = {}) {
  const limit = Math.min(50, Math.max(1, options.limit || 20));
  const query = { user: userId };
  if (options.unreadOnly) query.read = false;

  const notifications = await UserNotification.find(query)
    .populate("product", "title price discountedPrice isOnSale stock coverImage")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return notifications.map((n) => ({
    id: n._id.toString(),
    type: n.type,
    productId: n.product?._id?.toString(),
    product: n.product,
    title: n.title,
    message: n.message,
    meta: n.meta,
    read: n.read,
    createdAt: n.createdAt,
  }));
}

/**
 * Mark notification(s) as read.
 * @param {string} userId
 * @param {string|string[]} notificationIds - single id or array
 */
async function markAsRead(userId, notificationIds) {
  const ids = Array.isArray(notificationIds) ? notificationIds : [notificationIds];
  if (ids.length === 0) return { modified: 0 };

  const result = await UserNotification.updateMany(
    { _id: { $in: ids }, user: userId },
    { $set: { read: true } }
  );
  return { modified: result.modifiedCount };
}

/**
 * Mark all notifications as read for a user.
 */
async function markAllAsRead(userId) {
  const result = await UserNotification.updateMany({ user: userId }, { $set: { read: true } });
  return { modified: result.modifiedCount };
}

module.exports = {
  createAndDeliver,
  listForUser,
  markAsRead,
  markAllAsRead,
};
