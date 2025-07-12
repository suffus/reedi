"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteImageFiles = exports.processImage = void 0;
const uuid_1 = require("uuid");
const s3Service_1 = require("./s3Service");
const generateFilename = (originalName) => {
    const ext = originalName.split('.').pop() || 'jpg';
    const baseName = originalName.replace(/\.[^/.]+$/, '');
    const uniqueId = (0, uuid_1.v4)();
    return `${baseName}_${uniqueId}.${ext}`;
};
const processImage = async (buffer, originalName, mimeType, userId) => {
    const processedImage = await (0, s3Service_1.processImageForS3)(buffer, originalName, mimeType);
    const uploadResult = await (0, s3Service_1.uploadImageWithThumbnail)(processedImage.originalBuffer, processedImage.thumbnailBuffer, originalName, mimeType, userId);
    return {
        imagePath: uploadResult.key,
        thumbnailPath: uploadResult.thumbnailKey || '',
        width: processedImage.width,
        height: processedImage.height,
        size: processedImage.size,
        s3Key: uploadResult.key,
        thumbnailS3Key: uploadResult.thumbnailKey
    };
};
exports.processImage = processImage;
const deleteImageFiles = async (s3Key, thumbnailS3Key) => {
    try {
        await (0, s3Service_1.deleteImageWithThumbnail)(s3Key, thumbnailS3Key);
    }
    catch (error) {
        console.error('Error deleting image files from S3:', error);
        throw error;
    }
};
exports.deleteImageFiles = deleteImageFiles;
//# sourceMappingURL=imageProcessor.js.map