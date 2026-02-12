const express = require("express");
const eventsController = require("../controllers/events.controller");
const authenticateJWT = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/recent-purchases", eventsController.streamRecentPurchases);
router.get("/my-alerts", authenticateJWT, eventsController.streamMyAlerts);

module.exports = router;
