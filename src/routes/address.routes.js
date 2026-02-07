const express = require("express");
const addressController = require("../controllers/address.controller");
const authenticateJWT = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
    createAddressSchema,
    updateAddressSchema,
    addressIdParamSchema,
} = require("../validators/address.schema");

const router = express.Router();

router.use(authenticateJWT);

router.get("/", addressController.getAddresses);
router.get("/:id", validate(addressIdParamSchema, "params"), addressController.getAddress);
router.post("/", validate(createAddressSchema), addressController.createAddress);
router.patch("/:id", validate(addressIdParamSchema, "params"), validate(updateAddressSchema), addressController.updateAddress);
router.put("/:id", validate(addressIdParamSchema, "params"), validate(updateAddressSchema), addressController.updateAddress);
router.delete("/:id", validate(addressIdParamSchema, "params"), addressController.deleteAddress);
router.post("/:id/set-default", validate(addressIdParamSchema, "params"), addressController.setDefault);

module.exports = router;