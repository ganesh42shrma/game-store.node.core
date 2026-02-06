const express = require("express");
const orderController = require("../controllers/order.controller");
const authenticateJWT = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { createOrderSchema } = require("../validators/order.schema");

const router = express.Router();

router.use(authenticateJWT);

router.post("/", validate(createOrderSchema), orderController.createOrder);
router.get("/", orderController.getOrders);
router.get("/:id", orderController.getOrder);

module.exports = router;
