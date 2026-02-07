const express = require("express");
const invoiceController = require("../controllers/invoice.controller");
const authenticateJWT = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { invoiceIdParamSchema } = require("../validators/invoice.schema");

const router = express.Router();

router.use(authenticateJWT);

router.get(
    "/:id",
    validate(invoiceIdParamSchema, "params"),
    invoiceController.getInvoice
);

module.exports = router;
