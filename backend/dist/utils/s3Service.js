"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processImageForS3 = processImageForS3;
exports.uploadImageToS3 = uploadImageToS3;
exports.uploadImageWithThumbnail = uploadImageWithThumbnail;
exports.deleteImageFromS3 = deleteImageFromS3;
exports.deleteImageWithThumbnail = deleteImageWithThumbnail;
exports.generatePresignedUrl = generatePresignedUrl;
exports.getImageFromS3 = getImageFromS3;
exports.getPublicUrl = getPublicUrl;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const sharp_1 = __importDefault(require("sharp"));
const s3Client = new client_s3_1.S3Client({
    region: process.env.IDRIVE_REGION || 'us-east-1',
    endpoint: process.env.IDRIVE_ENDPOINT,
    credentials: {
        accessKeyId: process.env.IDRIVE_ACCESS_KEY_ID,
        secretAccessKey: process.env.IDRIVE_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
});
const BUCKET_NAME = process.env.IDRIVE_BUCKET_NAME;
async function processImageForS3(buffer, originalName, mimeType) {
    const originalImage = (0, sharp_1.default)(buffer);
    const originalMetadata = await originalImage.metadata();
    const progressiveBuffer = await (0, sharp_1.default)(buffer)
        .jpeg({
        quality: 85,
        progressive: true,
        mozjpeg: true
    })
        .toBuffer();
    const thumbnailBuffer = await (0, sharp_1.default)(buffer)
        .resize(300, 300, {
        fit: 'cover',
        withoutEnlargement: true
    })
        .jpeg({
        quality: 80,
        progressive: true,
        mozjpeg: true
    })
        .toBuffer();
    return {
        originalBuffer: progressiveBuffer,
        thumbnailBuffer,
        width: originalMetadata.width || 0,
        height: originalMetadata.height || 0,
        size: progressiveBuffer.length,
    };
}
async function uploadImageToS3(buffer, key, mimeType, metadata) {
    const command = new client_s3_1.PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        Metadata: metadata,
        ACL: 'public-read',
    });
    await s3Client.send(command);
    return key;
}
async function uploadImageWithThumbnail(originalBuffer, thumbnailBuffer, originalName, mimeType, userId) {
    const timestamp = Date.now();
    const fileExtension = originalName.split('.').pop() || 'jpg';
    const baseKey = `uploads/${userId}/${timestamp}`;
    const originalKey = `${baseKey}.${fileExtension}`;
    const thumbnailKey = `${baseKey}_thumb.${fileExtension}`;
    const originalUrl = await uploadImageToS3(originalBuffer, originalKey, mimeType, { originalName });
    const thumbnailUrl = await uploadImageToS3(thumbnailBuffer, thumbnailKey, 'image/jpeg', { originalName: `${originalName}_thumb` });
    return {
        key: originalKey,
        url: originalKey,
        thumbnailKey,
        thumbnailUrl: thumbnailKey,
        size: originalBuffer.length,
    };
}
async function deleteImageFromS3(key) {
    const command = new client_s3_1.DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
    });
    await s3Client.send(command);
}
async function deleteImageWithThumbnail(originalKey, thumbnailKey) {
    await deleteImageFromS3(originalKey);
    if (thumbnailKey) {
        await deleteImageFromS3(thumbnailKey);
    }
}
async function generatePresignedUrl(key, expiresIn = 3600) {
    const command = new client_s3_1.GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
    });
    return await (0, s3_request_presigner_1.getSignedUrl)(s3Client, command, { expiresIn });
}
async function getImageFromS3(key) {
    const command = new client_s3_1.GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
    });
    const response = await s3Client.send(command);
    if (!response.Body) {
        throw new Error('No image data received from S3');
    }
    const chunks = [];
    for await (const chunk of response.Body) {
        chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}
async function getPublicUrl(key) {
    return await generatePresignedUrl(key, 24 * 60 * 60);
}
//# sourceMappingURL=s3Service.js.map