const express = require("express");
const alertController = require("../controllers/alert.controller");
const authenticateJWT = require("../middlewares/auth.middleware");

const router = express.Router();

router.use(authenticateJWT);

router.get("/", alertController.listAlerts);
router.post("/", alertController.createAlert);
router.delete("/:id", alertController.deleteAlert);

module.exports = router;
