const { S3Client } = require("@aws-sdk/client-s3");

let client = null;

function getS3Client() {
    if (client) return client;
    const region = process.env.AWS_REGION || "us-east-1";
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    if (!accessKeyId || !secretAccessKey) {
        return null;
    }
    client = new S3Client({
        region,
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
    });
    return client;
}

function getBucket() {
    return process.env.S3_BUCKET || "";
}

function getPublicBaseUrl() {
    const base = process.env.S3_PUBLIC_BASE_URL;
    if (base) return base.replace(/\/$/, "");
    const bucket = getBucket();
    const region = process.env.AWS_REGION || "us-east-1";
    if (!bucket) return "";
    return `https://${bucket}.s3.${region}.amazonaws.com`;
}

module.exports = { getS3Client, getBucket, getPublicBaseUrl };
