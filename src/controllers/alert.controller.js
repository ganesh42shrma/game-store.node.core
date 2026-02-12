"use strict";

const productAlertService = require("../services/productAlert.service");

/**
 * List current user's product alerts.
 */
async function listAlerts(req, res, next) {
  try {
    const userId = req.user?.id ? String(req.user.id) : null;
    if (!userId) {
      return res.sendError("Authentication required", 401);
    }
    const alerts = await productAlertService.listUserAlerts(userId);
    res.success({ alerts });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a product alert.
 * Body: { productId, triggerType, priceThreshold? }
 */
async function createAlert(req, res, next) {
  try {
    const userId = req.user?.id ? String(req.user.id) : null;
    if (!userId) {
      return res.sendError("Authentication required", 401);
    }
    const { productId, triggerType, priceThreshold } = req.body || {};
    const { alert } = await productAlertService.createAlert({
      userId,
      productId,
      triggerType,
      priceThreshold,
    });
    res.status(201).json({ alert });
  } catch (error) {
    if (error.message?.includes("Invalid alert") || error.message?.includes("Product not found")) {
      return res.sendError(error.message, 400);
    }
    next(error);
  }
}

/**
 * Deactivate an alert.
 */
async function deleteAlert(req, res, next) {
  try {
    const userId = req.user?.id ? String(req.user.id) : null;
    if (!userId) {
      return res.sendError("Authentication required", 401);
    }
    const { id } = req.params;
    const deleted = await productAlertService.deactivateAlert(id, userId);
    if (!deleted) {
      return res.sendError("Alert not found or already inactive", 404);
    }
    res.success({ deleted: true });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listAlerts,
  createAlert,
  deleteAlert,
};
