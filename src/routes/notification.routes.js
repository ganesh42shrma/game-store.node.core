const express = require("express");
const notificationController = require("../controllers/notification.controller");
const authenticateJWT = require("../middlewares/auth.middleware");

const router = express.Router();

router.use(authenticateJWT);

router.get("/", notificationController.listNotifications);
router.patch("/read", notificationController.markAsRead);
router.patch("/read-all", notificationController.markAllAsRead);

module.exports = router;
