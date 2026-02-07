const bcrypt = require('bcrypt');
const User = require("../models/user.model");

async function getAllUsers(queryParams) {
    const { role, isActive, fields, sort, page = 1, limit = 10 } = queryParams;

    const filter = {};
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === "true";

    let query = User.find(filter).select("-password");
    if (fields) {
        const projection = fields.split(",").join(" ");
        query = query.select(projection);
    }
    if (sort) {
        const sortBy = sort.split(",").join(" ") + " _id";
        query = query.sort(sortBy);
    } else {
        query = query.sort("-createdAt _id");
    }
    const skip = (Number(page) - 1) * Number(limit);
    query = query.skip(skip).limit(Number(limit));
    return query;
}

async function getUserById(userId) {
    return User.findById(userId).select("-password");
}

async function createUser(userData) {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const data = { ...userData, password: hashedPassword };
    return User.create(data);
}

async function updateUser(id, updateData) {
    return User.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
    }).select("-password");
}

async function updateUserProfilePicture(userId, profilePictureUrl) {
    return User.findByIdAndUpdate(
        userId,
        { $set: { profilePicture: profilePictureUrl } },
        { new: true }
    ).select("-password");
}

async function deleteUser(userId) {
    return User.findByIdAndDelete(userId);
}

module.exports = {
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    updateUserProfilePicture,
    deleteUser,
};
