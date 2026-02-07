const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { getS3Client, getBucket, getPublicBaseUrl } = require("../config/s3");

const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

function getAllowedMimes() {
    return ALLOWED_MIMES;
}

function getMaxSizeBytes() {
    return MAX_SIZE_BYTES;
}

/**
 * Upload a buffer to S3 and return the public URL.
 * @param {Buffer} buffer - File buffer
 * @param {string} key - S3 object key (e.g. products/abc123/cover.jpg)
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} Public URL of the uploaded object
 */
async function uploadToS3(buffer, key, contentType) {
    const s3 = getS3Client();
    const bucket = getBucket();
    if (!s3 || !bucket) {
        const err = new Error("S3 is not configured");
        err.statusCode = 503;
        throw err;
    }
    await s3.send(
        new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: buffer,
            ContentType: contentType,
        })
    );
    const baseUrl = getPublicBaseUrl();
    return `${baseUrl}/${key}`;
}

/**
 * Generate S3 key for a product cover image.
 * @param {string} productId - Product ID
 * @param {string} originalName - Original filename (used for extension)
 */
function productImageKey(productId, originalName) {
    const ext = originalName && originalName.includes(".")
        ? originalName.split(".").pop().toLowerCase()
        : "jpg";
    const safeExt = ["jpeg", "jpg", "png", "gif", "webp"].includes(ext) ? ext : "jpg";
    return `products/${productId}/cover-${Date.now()}.${safeExt}`;
}

/**
 * Generate S3 key for a user profile picture.
 * @param {string} userId - User ID
 * @param {string} originalName - Original filename (used for extension)
 */
function userProfileImageKey(userId, originalName) {
    const ext = originalName && originalName.includes(".")
        ? originalName.split(".").pop().toLowerCase()
        : "jpg";
    const safeExt = ["jpeg", "jpg", "png", "gif", "webp"].includes(ext) ? ext : "jpg";
    return `users/${userId}/profile-${Date.now()}.${safeExt}`;
}

module.exports = {
    uploadToS3,
    productImageKey,
    userProfileImageKey,
    getAllowedMimes,
    getMaxSizeBytes,
};
