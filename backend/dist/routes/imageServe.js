"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("@/index");
const errorHandler_1 = require("@/middleware/errorHandler");
const auth_1 = require("@/middleware/auth");
const s3Service_1 = require("@/utils/s3Service");
const router = (0, express_1.Router)();
router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }
    next();
});
async function canViewImage(imageId, viewerId) {
    const image = await index_1.prisma.image.findUnique({
        where: { id: imageId },
        select: {
            id: true,
            visibility: true,
            authorId: true
        }
    });
    if (!image) {
        return false;
    }
    if (image.visibility === 'PUBLIC') {
        return true;
    }
    if (image.visibility === 'PRIVATE') {
        return viewerId === image.authorId;
    }
    if (image.visibility === 'FRIENDS_ONLY') {
        if (!viewerId) {
            return false;
        }
        if (viewerId === image.authorId) {
            return true;
        }
        const friendship = await index_1.prisma.friendRequest.findFirst({
            where: {
                OR: [
                    { senderId: viewerId, receiverId: image.authorId, status: 'ACCEPTED' },
                    { senderId: image.authorId, receiverId: viewerId, status: 'ACCEPTED' }
                ]
            }
        });
        return !!friendship;
    }
    return false;
}
router.get('/:id', auth_1.optionalAuthMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const viewerId = req.user?.id;
    const canView = await canViewImage(id, viewerId);
    if (!canView) {
        res.status(403).json({
            success: false,
            error: 'Access denied'
        });
        return;
    }
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
router.get('/:id/thumbnail', auth_1.optionalAuthMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const viewerId = req.user?.id;
    const canView = await canViewImage(id, viewerId);
    if (!canView) {
        res.status(403).json({
            success: false,
            error: 'Access denied'
        });
        return;
    }
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