const express = require("express");
const paymentController = require("../controllers/payment.controller");
const authenticateJWT = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
    createPaymentSchema,
    paymentIdParamSchema,
} = require("../validators/payment.schema");

const router = express.Router();

router.use(authenticateJWT);

router.post("/", validate(createPaymentSchema), paymentController.createPayment);
router.get(
    "/:id",
    validate(paymentIdParamSchema, "params"),
    paymentController.getPayment
);
router.post(
    "/:id/confirm",
    validate(paymentIdParamSchema, "params"),
    paymentController.confirmPayment
);

module.exports = router;
