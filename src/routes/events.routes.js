const express = require("express");
const eventsController = require("../controllers/events.controller");

const router = express.Router();

router.get("/recent-purchases", eventsController.streamRecentPurchases);

module.exports = router;
