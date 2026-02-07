const express = require("express");
const orderController = require("../controllers/order.controller");
const invoiceController = require("../controllers/invoice.controller");
const authenticateJWT = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
    createOrderSchema,
    orderIdParamSchema,
} = require("../validators/order.schema");

const router = express.Router();

router.use(authenticateJWT);

router.post("/", validate(createOrderSchema), orderController.createOrder);
router.get("/", orderController.getOrders);
router.get(
    "/:id/invoice",
    validate(orderIdParamSchema, "params"),
    invoiceController.getInvoiceByOrderId
);
router.get("/:id", validate(orderIdParamSchema, "params"), orderController.getOrder);

module.exports = router;
