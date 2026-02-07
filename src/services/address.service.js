const Address = require("../models/address.model");

async function getAddressesByUserId(userId) {
    const addresses = await Address.find({ user: userId }).sort({
        isDefault: -1,
        createdAt: -1,
    });
    return addresses;
}

async function getAddressById(addressId, userId) {
    const address = await Address.findOne({ _id: addressId, user: userId });
    return address;
}

async function createAddress(userId, data) {
    if (data.isDefault) {
        await Address.updateMany({ user: userId },
            { $set: { isDefault: false } }
        );
    }
    const address = await Address.create({
        user: userId,
        ...data,
    });
    return address;
}

async function updateAddress(addressId, userId, data) {
    const address = await Address.findOne({ _id: addressId, user: userId });
    if (!address) {
        return null;
    }
    if (data.isDefault === true) {
        await Address.updateMany(
            { user: userId, _id: { $ne: addressId } },
            { $set: { isDefault: false } }
        );
    }
    Object.assign(address, data);
    await address.save();
    return address;
}

async function deleteAddress(addressId, userId) {
    const address = await Address.findOneAndDelete({
        _id: addressId,
        user: userId,
    });
    return address;
}

async function setDefaultAddress(addressId, userId) {
    const address = await Address.findOne({
        _id: addressId,
        user: userId,
    });
    if (!address) {
        return null;
    };
    await Address.updateMany({ user: userId, _id: { $ne: addressId } }, { $set: { isDefault: false } });
    address.isDefault = true;
    await address.save();
    return address;
}

module.exports = {
    getAddressesByUserId,
    getAddressById,
    createAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
};