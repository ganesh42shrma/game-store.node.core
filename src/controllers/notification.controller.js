"use strict";

const userNotificationService = require("../services/userNotification.service");

/**
 * List current user's notifications.
 * Query: limit, unreadOnly
 */
async function listNotifications(req, res, next) {
  try {
    const userId = req.user?.id ? String(req.user.id) : null;
    if (!userId) {
      return res.sendError("Authentication required", 401);
    }
    const limit = parseInt(req.query?.limit, 10) || 20;
    const unreadOnly = req.query?.unreadOnly === "true" || req.query?.unreadOnly === "1";
    const notifications = await userNotificationService.listForUser(userId, { limit, unreadOnly });
    res.success({ notifications });
  } catch (error) {
    next(error);
  }
}

/**
 * Mark notification(s) as read.
 * Body: { notificationIds: string | string[] }
 */
async function markAsRead(req, res, next) {
  try {
    const userId = req.user?.id ? String(req.user.id) : null;
    if (!userId) {
      return res.sendError("Authentication required", 401);
    }
    const { notificationIds } = req.body || {};
    const ids = notificationIds != null ? (Array.isArray(notificationIds) ? notificationIds : [notificationIds]) : [];
    if (ids.length === 0) {
      return res.sendError("notificationIds required", 400);
    }
    const { modified } = await userNotificationService.markAsRead(userId, ids);
    res.success({ modified });
  } catch (error) {
    next(error);
  }
}

/**
 * Mark all notifications as read.
 */
async function markAllAsRead(req, res, next) {
  try {
    const userId = req.user?.id ? String(req.user.id) : null;
    if (!userId) {
      return res.sendError("Authentication required", 401);
    }
    const { modified } = await userNotificationService.markAllAsRead(userId);
    res.success({ modified });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listNotifications,
  markAsRead,
  markAllAsRead,
};
