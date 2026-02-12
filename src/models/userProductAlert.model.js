"use strict";

const mongoose = require("mongoose");

/** Trigger types for product alerts */
const ALERT_TRIGGER_TYPES = ["price_drop", "on_sale", "available", "price_below"];

/**
 * User product alert: "notify me when game X is on sale / price drops / available".
 * Created via chat ("tell me when Elden Ring drops below $30") or REST API.
 * Cron job matches these against product state and fires notifications.
 */
const userProductAlertSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    triggerType: {
      type: String,
      enum: ALERT_TRIGGER_TYPES,
      required: true,
    },
    /** For price_drop / price_below: target price in cents or dollars (we use same unit as Product.price) */
    priceThreshold: {
      type: Number,
      default: null,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    /** Last time we fired a notification for this alert (cooldown) */
    lastNotifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    indexes: [
      { user: 1, product: 1, triggerType: 1 },
      { isActive: 1, product: 1, triggerType: 1 },
    ],
  }
);

module.exports = mongoose.model("UserProductAlert", userProductAlertSchema);
module.exports.ALERT_TRIGGER_TYPES = ALERT_TRIGGER_TYPES;
