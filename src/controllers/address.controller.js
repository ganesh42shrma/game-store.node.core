const addressService = require("../services/address.service");

async function getAddresses(req, res, next) {
    try {
        const addresses = await addressService.getAddressesByUserId(req.user.id);
        res.success(addresses);
    } catch (error) {
        next(error);
    }
}

async function getAddress(req, res, next) {
    try {
        const { id } = req.params;
        const address = await addressService.getAddressById(id, req.user.id);
        if (!address) {
            return res.sendError("Address not found", 404);
        }
        res.success(address);
    } catch (error) {
        next(error);
    }
}

async function createAddress(req, res, next) {
    try {
        const address = await addressService.createAddress(req.user.id, req.body);
        res.created(address);
    } catch (error) {
        next(error);
    }
}

async function updateAddress(req, res, next) {
    try {
        const { id } = req.params;
        const address = await addressService.updateAddress(
            id,
            req.user.id,
            req.body
        );
        if (!address) {
            return res.sendError("Address not found", 404);
        }
        res.success(address);
    } catch (error) {
        next(error);
    }
}

async function deleteAddress(req, res, next) {
    try {
        const { id } = req.params;
        const address = await addressService.deleteAddress(id, req.user.id);
        if (!address) {
            return res.sendError("Address not found", 404);
        }
        res.successMessage("Address deleted successfully");
    } catch (error) {
        next(error);
    }
}

async function setDefault(req, res, next) {
    try {
        const { id } = req.params;
        const address = await addressService.setDefaultAddress(id, req.user.id);
        if (!address) {
            return res.sendError("Address not found", 404);
        }
        res.successWithMessage(address, "Address set as default successfully");
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getAddresses,
    getAddress,
    createAddress,
    updateAddress,
    deleteAddress,
    setDefault,
};