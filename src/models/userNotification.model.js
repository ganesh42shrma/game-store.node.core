"use strict";

const mongoose = require("mongoose");

/** Types of in-app notifications */
const NOTIFICATION_TYPES = ["price_drop", "on_sale", "available", "price_below"];

/**
 * In-app notification for a user. Created when an alert fires.
 * User fetches via REST; optionally pushed via SSE when connected.
 */
const userNotificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    /** Product state at notification time (for display) */
    meta: {
      price: Number,
      discountedPrice: Number,
      isOnSale: Boolean,
      stock: Number,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    /** Reference to the alert that fired (optional) */
    alertId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserProductAlert",
      default: null,
    },
  },
  {
    timestamps: true,
    indexes: [
      { user: 1, read: 1, createdAt: -1 },
      { user: 1, createdAt: -1 },
    ],
  }
);

module.exports = mongoose.model("UserNotification", userNotificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
