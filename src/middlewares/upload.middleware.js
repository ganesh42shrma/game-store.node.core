const multer = require("multer");
const uploadService = require("../services/upload.service");

const allowedMimes = uploadService.getAllowedMimes();
const maxSize = uploadService.getMaxSizeBytes();

const memoryStorage = multer.memoryStorage();

const uploadSingleImage = multer({
    storage: memoryStorage,
    limits: { fileSize: maxSize },
    fileFilter: (req, file, cb) => {
        if (!allowedMimes.includes(file.mimetype)) {
            return cb(
                Object.assign(new Error(`Allowed types: ${allowedMimes.join(", ")}`), { statusCode: 400 }),
                false
            );
        }
        cb(null, true);
    },
}).single("image");

/**
 * Multer middleware for a single image field named "image".
 * Expects multipart/form-data with field name "image".
 */
function productImageUpload(req, res, next) {
    uploadSingleImage(req, res, (err) => {
        if (err) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(400).json({
                    success: false,
                    message: `File too large. Max size: ${Math.round(uploadService.getMaxSizeBytes() / 1024 / 1024)}MB`,
                });
            }
            return res.status(err.statusCode || 400).json({
                success: false,
                message: err.message || "Invalid file",
            });
        }
        next();
    });
}

module.exports = { productImageUpload };
