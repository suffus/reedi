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
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }
    next();
});
async function canViewMedia(mediaId, viewerId) {
    const media = await index_1.prisma.media.findUnique({
        where: { id: mediaId },
        select: {
            id: true,
            visibility: true,
            authorId: true
        }
    });
    if (!media) {
        return false;
    }
    if (media.visibility === 'PUBLIC') {
        return true;
    }
    if (media.visibility === 'PRIVATE') {
        return viewerId === media.authorId;
    }
    if (media.visibility === 'FRIENDS_ONLY') {
        if (!viewerId) {
            return false;
        }
        if (viewerId === media.authorId) {
            return true;
        }
        const friendship = await index_1.prisma.friendRequest.findFirst({
            where: {
                OR: [
                    { senderId: viewerId, receiverId: media.authorId, status: 'ACCEPTED' },
                    { senderId: media.authorId, receiverId: viewerId, status: 'ACCEPTED' }
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
    const canView = await canViewMedia(id, viewerId);
    if (!canView) {
        res.status(403).json({
            success: false,
            error: 'Access denied'
        });
        return;
    }
    const media = await index_1.prisma.media.findUnique({
        where: { id },
        select: {
            id: true,
            s3Key: true,
            thumbnailS3Key: true,
            videoS3Key: true,
            mimeType: true,
            mediaType: true,
            processingStatus: true
        }
    });
    if (!media) {
        res.status(404).json({
            success: false,
            error: 'Media not found'
        });
        return;
    }
    if (media.mediaType === 'VIDEO' && media.processingStatus !== 'COMPLETED') {
        res.status(202).json({
            success: false,
            error: 'Video is still processing',
            processingStatus: media.processingStatus
        });
        return;
    }
    try {
        let s3Key = media.s3Key;
        if (media.mediaType === 'VIDEO' && media.videoS3Key) {
            s3Key = media.videoS3Key;
        }
        if (!s3Key) {
            res.status(404).json({
                success: false,
                error: 'Media file not found'
            });
            return;
        }
        const mediaBuffer = await (0, s3Service_1.getImageFromS3)(s3Key);
        res.setHeader('Content-Type', media.mimeType || 'application/octet-stream');
        res.setHeader('Content-Length', mediaBuffer.length);
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.setHeader('Accept-Ranges', 'bytes');
        const range = req.headers.range;
        if (range && media.mediaType === 'VIDEO') {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : mediaBuffer.length - 1;
            const chunksize = (end - start) + 1;
            res.status(206);
            res.setHeader('Content-Range', `bytes ${start}-${end}/${mediaBuffer.length}`);
            res.setHeader('Content-Length', chunksize.toString());
            res.setHeader('Accept-Ranges', 'bytes');
            res.end(mediaBuffer.slice(start, end + 1));
        }
        else {
            res.end(mediaBuffer);
        }
    }
    catch (error) {
        console.error('Error serving media:', error);
        res.status(500).json({
            success: false,
            error: 'Error serving media'
        });
    }
}));
router.get('/:id/thumbnail', auth_1.optionalAuthMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const viewerId = req.user?.id;
    const canView = await canViewMedia(id, viewerId);
    if (!canView) {
        res.status(403).json({
            success: false,
            error: 'Access denied'
        });
        return;
    }
    const media = await index_1.prisma.media.findUnique({
        where: { id },
        select: {
            id: true,
            thumbnailS3Key: true,
            mimeType: true,
            mediaType: true,
            processingStatus: true
        }
    });
    if (!media) {
        res.status(404).json({
            success: false,
            error: 'Media not found'
        });
        return;
    }
    if (media.mediaType === 'VIDEO' && media.processingStatus !== 'COMPLETED') {
        res.status(202).json({
            success: false,
            error: 'Video thumbnail is still processing',
            processingStatus: media.processingStatus
        });
        return;
    }
    try {
        if (!media.thumbnailS3Key) {
            res.status(404).json({
                success: false,
                error: 'Thumbnail not found'
            });
            return;
        }
        const thumbnailBuffer = await (0, s3Service_1.getImageFromS3)(media.thumbnailS3Key);
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Length', thumbnailBuffer.length);
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.end(thumbnailBuffer);
    }
    catch (error) {
        console.error('Error serving thumbnail:', error);
        res.status(500).json({
            success: false,
            error: 'Error serving thumbnail'
        });
    }
}));
router.get('/:id/stream', auth_1.optionalAuthMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const viewerId = req.user?.id;
    const canView = await canViewMedia(id, viewerId);
    if (!canView) {
        res.status(403).json({
            success: false,
            error: 'Access denied'
        });
        return;
    }
    const media = await index_1.prisma.media.findUnique({
        where: { id },
        select: {
            id: true,
            videoS3Key: true,
            s3Key: true,
            mimeType: true,
            mediaType: true,
            processingStatus: true
        }
    });
    if (!media) {
        res.status(404).json({
            success: false,
            error: 'Media not found'
        });
        return;
    }
    if (media.mediaType !== 'VIDEO') {
        res.status(400).json({
            success: false,
            error: 'This endpoint is for video streaming only'
        });
        return;
    }
    if (media.processingStatus !== 'COMPLETED') {
        res.status(202).json({
            success: false,
            error: 'Video is still processing',
            processingStatus: media.processingStatus
        });
        return;
    }
    try {
        const s3Key = media.videoS3Key || media.s3Key;
        if (!s3Key) {
            res.status(404).json({
                success: false,
                error: 'Video file not found'
            });
            return;
        }
        const videoBuffer = await (0, s3Service_1.getImageFromS3)(s3Key);
        res.setHeader('Content-Type', media.mimeType || 'video/mp4');
        res.setHeader('Content-Length', videoBuffer.length);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        const range = req.headers.range;
        if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : videoBuffer.length - 1;
            const chunksize = (end - start) + 1;
            res.status(206);
            res.setHeader('Content-Range', `bytes ${start}-${end}/${videoBuffer.length}`);
            res.setHeader('Content-Length', chunksize.toString());
            res.end(videoBuffer.slice(start, end + 1));
        }
        else {
            res.end(videoBuffer);
        }
    }
    catch (error) {
        console.error('Error streaming video:', error);
        res.status(500).json({
            success: false,
            error: 'Error streaming video'
        });
    }
}));
exports.default = router;
//# sourceMappingURL=mediaServe.js.map