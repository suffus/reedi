"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("@/index");
const errorHandler_1 = require("@/middleware/errorHandler");
const s3Service_1 = require("@/utils/s3Service");
const router = (0, express_1.Router)();
router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }
    next();
});
router.get('/:id', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const image = await index_1.prisma.image.findUnique({
        where: { id },
        select: {
            id: true,
            s3Key: true,
            thumbnailS3Key: true,
            mimeType: true
        }
    });
    if (!image) {
        res.status(404).json({
            success: false,
            error: 'Image not found'
        });
        return;
    }
    try {
        const imageBuffer = await (0, s3Service_1.getImageFromS3)(image.s3Key);
        res.setHeader('Content-Type', image.mimeType || 'image/jpeg');
        res.setHeader('Content-Length', imageBuffer.length);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.send(imageBuffer);
    }
    catch (error) {
        console.error('Error serving image:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to serve image'
        });
    }
}));
router.get('/:id/thumbnail', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const image = await index_1.prisma.image.findUnique({
        where: { id },
        select: {
            id: true,
            thumbnailS3Key: true,
            mimeType: true
        }
    });
    if (!image || !image.thumbnailS3Key) {
        res.status(404).json({
            success: false,
            error: 'Thumbnail not found'
        });
        return;
    }
    try {
        const thumbnailBuffer = await (0, s3Service_1.getImageFromS3)(image.thumbnailS3Key);
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Length', thumbnailBuffer.length);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.send(thumbnailBuffer);
    }
    catch (error) {
        console.error('Error serving thumbnail:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to serve thumbnail'
        });
    }
}));
exports.default = router;
//# sourceMappingURL=imageServe.js.map