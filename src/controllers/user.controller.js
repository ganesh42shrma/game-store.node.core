const userService = require("../services/user.service");
const uploadService = require("../services/upload.service");

async function getUsers(req, res, next) {
    try {
        const users = await userService.getAllUsers(req.query);
        res.success(users);
    } catch (error) {
        next(error);
    }
}

async function getMe(req, res, next) {
    try {
        const user = await userService.getUserById(req.user.id);
        if (!user) {
            return res.sendError("User not found", 404);
        }
        res.success(user);
    } catch (error) {
        next(error);
    }
}

async function getUser(req, res, next) {
    try {
        const user = await userService.getUserById(req.params.id);
        if (!user) {
            return res.sendError("User not found", 404);
        }
        res.success(user);
    } catch (error) {
        next(error);
    }
}

async function createUser(req, res, next) {
    try {
        const user = await userService.createUser(req.body);
        const { password, ...userWithoutPassword } = user.toObject();
        res.created(userWithoutPassword);
    } catch (error) {
        next(error);
    }
}

async function updateUser(req, res, next) {
    try {
        const user = await userService.updateUser(req.params.id, req.body);
        if (!user) {
            return res.sendError("User not found", 404);
        }
        res.success(user);
    } catch (error) {
        next(error);
    }
}

async function deleteUser(req, res, next) {
    try {
        const user = await userService.deleteUser(req.params.id);
        if (!user) {
            return res.sendError("User not found", 404);
        }
        res.successMessage("User deleted successfully.");
    } catch (error) {
        next(error);
    }
}

async function uploadProfilePicture(req, res, next) {
    try {
        if (!req.file || !req.file.buffer) {
            return res.sendError("No image file provided. Use multipart/form-data with field name 'image'.", 400);
        }
        const userId = req.user.id;
        const key = uploadService.userProfileImageKey(userId, req.file.originalname);
        const url = await uploadService.uploadToS3(
            req.file.buffer,
            key,
            req.file.mimetype
        );
        const user = await userService.updateUserProfilePicture(userId, url);
        res.successWithMessage(user, "Profile picture updated.");
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getUsers,
    getMe,
    getUser,
    createUser,
    updateUser,
    deleteUser,
    uploadProfilePicture,
};
