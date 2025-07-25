"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const index_1 = require("@/index");
const errorHandler_1 = require("@/middleware/errorHandler");
const auth_1 = require("@/middleware/auth");
const imageProcessor_1 = require("@/utils/imageProcessor");
const s3Service_1 = require("@/utils/s3Service");
const router = (0, express_1.Router)();
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 500 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        }
        else {
            cb(new Error('Only image and video files are allowed'));
        }
    }
});
router.get('/user/:userId', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const [media, total] = await Promise.all([
        index_1.prisma.media.findMany({
            where: { authorId: userId },
            skip: offset,
            take: Number(limit),
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                s3Key: true,
                thumbnailS3Key: true,
                originalFilename: true,
                altText: true,
                caption: true,
                width: true,
                height: true,
                size: true,
                mimeType: true,
                tags: true,
                mediaType: true,
                processingStatus: true,
                duration: true,
                codec: true,
                bitrate: true,
                framerate: true,
                videoUrl: true,
                videoS3Key: true,
                createdAt: true,
                updatedAt: true,
                authorId: true
            }
        }),
        index_1.prisma.media.count({
            where: { authorId: userId }
        })
    ]);
    res.json({
        success: true,
        data: {
            media,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit)),
                hasNext: offset + Number(limit) < total,
                hasPrev: Number(page) > 1
            }
        }
    });
}));
router.get('/user/:userId/public', auth_1.optionalAuthMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { userId } = req.params;
    const viewerId = req.user?.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    let visibilityFilter = [
        { visibility: 'PUBLIC' }
    ];
    if (viewerId) {
        if (viewerId === userId) {
            visibilityFilter = [];
        }
        else {
            const isFriend = await index_1.prisma.friendRequest.findFirst({
                where: {
                    OR: [
                        { senderId: viewerId, receiverId: userId, status: 'ACCEPTED' },
                        { senderId: userId, receiverId: viewerId, status: 'ACCEPTED' }
                    ]
                }
            });
            if (isFriend) {
                visibilityFilter.push({ visibility: 'FRIENDS_ONLY' });
            }
        }
    }
    const [media, total] = await Promise.all([
        index_1.prisma.media.findMany({
            where: {
                authorId: userId,
                OR: visibilityFilter
            },
            skip: offset,
            take: Number(limit),
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                s3Key: true,
                thumbnailS3Key: true,
                originalFilename: true,
                altText: true,
                caption: true,
                width: true,
                height: true,
                size: true,
                mimeType: true,
                tags: true,
                mediaType: true,
                processingStatus: true,
                duration: true,
                codec: true,
                bitrate: true,
                framerate: true,
                videoUrl: true,
                videoS3Key: true,
                createdAt: true,
                updatedAt: true,
                authorId: true
            }
        }),
        index_1.prisma.media.count({
            where: {
                authorId: userId,
                OR: visibilityFilter
            }
        })
    ]);
    res.json({
        success: true,
        data: {
            media,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit)),
                hasNext: offset + Number(limit) < total,
                hasPrev: Number(page) > 1
            }
        }
    });
}));
router.post('/upload', auth_1.authMiddleware, upload.single('media'), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    console.log('Upload request received for user:', req.user?.id);
    console.log('Form data:', req.body);
    console.log('File:', req.file ? { filename: req.file.originalname, size: req.file.size, mimetype: req.file.mimetype } : 'No file');
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
    }
    if (!req.file) {
        res.status(400).json({
            success: false,
            error: 'No media file provided'
        });
        return;
    }
    const isVideo = req.file.mimetype.startsWith('video/');
    const mediaType = isVideo ? 'VIDEO' : 'IMAGE';
    let tags = [];
    if (req.body.tags) {
        try {
            tags = JSON.parse(req.body.tags);
        }
        catch (error) {
            console.warn('Failed to parse tags:', error);
        }
    }
    let media;
    if (isVideo) {
        const s3Key = await (0, s3Service_1.uploadToS3)(req.file.buffer, req.file.originalname, req.file.mimetype, userId);
        media = await index_1.prisma.media.create({
            data: {
                url: s3Key,
                s3Key: s3Key,
                originalFilename: req.file.originalname,
                altText: req.body.title || req.body.altText || 'Uploaded video',
                caption: req.body.description || req.body.caption || '',
                tags: tags,
                size: req.file.size,
                mimeType: req.file.mimetype,
                mediaType: 'VIDEO',
                processingStatus: 'PENDING',
                authorId: userId
            }
        });
    }
    else {
        const processedImage = await (0, imageProcessor_1.processImage)(req.file.buffer, req.file.originalname, req.file.mimetype, userId);
        media = await index_1.prisma.media.create({
            data: {
                url: processedImage.imagePath,
                thumbnail: processedImage.thumbnailPath,
                s3Key: processedImage.s3Key,
                thumbnailS3Key: processedImage.thumbnailS3Key,
                originalFilename: req.file.originalname,
                altText: req.body.title || req.body.altText || 'Uploaded image',
                caption: req.body.description || req.body.caption || '',
                tags: tags,
                width: processedImage.width,
                height: processedImage.height,
                size: processedImage.size,
                mimeType: req.file.mimetype,
                mediaType: 'IMAGE',
                processingStatus: 'COMPLETED',
                authorId: userId
            }
        });
    }
    console.log('Media created successfully:', {
        id: media.id,
        title: media.altText,
        authorId: media.authorId,
        mediaType: media.mediaType,
        processingStatus: media.processingStatus
    });
    res.status(201).json({
        success: true,
        data: { media },
        message: `${mediaType === 'VIDEO' ? 'Video' : 'Image'} uploaded successfully`
    });
}));
router.post('/', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { url, altText, caption, postId, galleryId, mediaType = 'IMAGE' } = req.body;
    if (!userId) {
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
    }
    const media = await index_1.prisma.media.create({
        data: {
            url,
            altText,
            caption,
            postId,
            galleryId,
            mediaType: mediaType,
            processingStatus: mediaType === 'VIDEO' ? 'PENDING' : 'COMPLETED',
            authorId: userId
        }
    });
    res.status(201).json({
        success: true,
        data: { media },
        message: 'Media created successfully'
    });
}));
router.get('/:id', auth_1.optionalAuthMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const viewerId = req.user?.id;
    const media = await index_1.prisma.media.findUnique({
        where: { id },
        select: {
            id: true,
            url: true,
            thumbnail: true,
            s3Key: true,
            thumbnailS3Key: true,
            originalFilename: true,
            altText: true,
            caption: true,
            width: true,
            height: true,
            size: true,
            mimeType: true,
            tags: true,
            visibility: true,
            mediaType: true,
            processingStatus: true,
            duration: true,
            codec: true,
            bitrate: true,
            framerate: true,
            videoUrl: true,
            videoS3Key: true,
            createdAt: true,
            updatedAt: true,
            authorId: true,
            author: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                    avatar: true
                }
            }
        }
    });
    if (!media) {
        res.status(404).json({
            success: false,
            error: 'Media not found'
        });
        return;
    }
    if (media.visibility === 'PRIVATE' && viewerId !== media.authorId) {
        res.status(403).json({
            success: false,
            error: 'Access denied'
        });
        return;
    }
    if (media.visibility === 'FRIENDS_ONLY' && viewerId !== media.authorId) {
        if (!viewerId) {
            res.status(403).json({
                success: false,
                error: 'Access denied'
            });
            return;
        }
        const isFriend = await index_1.prisma.friendRequest.findFirst({
            where: {
                OR: [
                    { senderId: viewerId, receiverId: media.authorId, status: 'ACCEPTED' },
                    { senderId: media.authorId, receiverId: viewerId, status: 'ACCEPTED' }
                ]
            }
        });
        if (!isFriend) {
            res.status(403).json({
                success: false,
                error: 'Access denied'
            });
            return;
        }
    }
    res.json({
        success: true,
        data: { media }
    });
}));
router.put('/:id', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id;
    const { altText, caption, tags, visibility } = req.body;
    if (!userId) {
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
    }
    const media = await index_1.prisma.media.findUnique({
        where: { id },
        select: { authorId: true }
    });
    if (!media) {
        res.status(404).json({
            success: false,
            error: 'Media not found'
        });
        return;
    }
    if (media.authorId !== userId) {
        res.status(403).json({
            success: false,
            error: 'Not authorized to update this media'
        });
        return;
    }
    const updatedMedia = await index_1.prisma.media.update({
        where: { id },
        data: {
            altText,
            caption,
            tags: tags ? JSON.parse(tags) : undefined,
            visibility
        }
    });
    res.json({
        success: true,
        data: { media: updatedMedia },
        message: 'Media updated successfully'
    });
}));
router.delete('/:id', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
    }
    const media = await index_1.prisma.media.findUnique({
        where: { id },
        select: {
            authorId: true,
            s3Key: true,
            thumbnailS3Key: true,
            videoS3Key: true,
            mediaType: true
        }
    });
    if (!media) {
        res.status(404).json({
            success: false,
            error: 'Media not found'
        });
        return;
    }
    if (media.authorId !== userId) {
        res.status(403).json({
            success: false,
            error: 'Not authorized to delete this media'
        });
        return;
    }
    try {
        if (media.mediaType === 'VIDEO') {
            if (media.s3Key) {
                await (0, imageProcessor_1.deleteImageFiles)(media.s3Key, media.thumbnailS3Key || undefined);
            }
            if (media.videoS3Key) {
                await (0, imageProcessor_1.deleteImageFiles)(media.videoS3Key);
            }
        }
        else {
            if (media.s3Key) {
                await (0, imageProcessor_1.deleteImageFiles)(media.s3Key, media.thumbnailS3Key || undefined);
            }
        }
    }
    catch (error) {
        console.error('Error deleting files from S3:', error);
    }
    await index_1.prisma.media.delete({
        where: { id }
    });
    res.json({
        success: true,
        message: 'Media deleted successfully'
    });
}));
router.put('/bulk/update', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { mediaIds, updates } = req.body;
    if (!userId) {
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
    }
    if (!mediaIds || !Array.isArray(mediaIds) || mediaIds.length === 0) {
        res.status(400).json({
            success: false,
            error: 'Media IDs are required'
        });
        return;
    }
    const media = await index_1.prisma.media.findMany({
        where: {
            id: { in: mediaIds },
            authorId: userId
        },
        select: { id: true }
    });
    if (media.length !== mediaIds.length) {
        res.status(403).json({
            success: false,
            error: 'Not authorized to update some media'
        });
        return;
    }
    const updatePromises = mediaIds.map(id => index_1.prisma.media.update({
        where: { id },
        data: updates
    }));
    const updatedMedia = await Promise.all(updatePromises);
    res.json({
        success: true,
        data: { media: updatedMedia },
        message: 'Media updated successfully'
    });
}));
router.get('/search/tags', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { tags, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
        res.status(400).json({
            success: false,
            error: 'Tags are required'
        });
        return;
    }
    const [media, total] = await Promise.all([
        index_1.prisma.media.findMany({
            where: {
                tags: {
                    hasSome: tags
                },
                visibility: 'PUBLIC'
            },
            skip: offset,
            take: Number(limit),
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                s3Key: true,
                thumbnailS3Key: true,
                originalFilename: true,
                altText: true,
                caption: true,
                width: true,
                height: true,
                size: true,
                mimeType: true,
                tags: true,
                mediaType: true,
                processingStatus: true,
                duration: true,
                codec: true,
                bitrate: true,
                framerate: true,
                videoUrl: true,
                videoS3Key: true,
                createdAt: true,
                updatedAt: true,
                authorId: true
            }
        }),
        index_1.prisma.media.count({
            where: {
                tags: {
                    hasSome: tags
                },
                visibility: 'PUBLIC'
            }
        })
    ]);
    res.json({
        success: true,
        data: {
            media,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit)),
                hasNext: offset + Number(limit) < total,
                hasPrev: Number(page) > 1
            }
        }
    });
}));
exports.default = router;
//# sourceMappingURL=media.js.map