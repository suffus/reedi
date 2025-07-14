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
const router = (0, express_1.Router)();
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 40 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        }
        else {
            cb(new Error('Only image files are allowed'));
        }
    }
});
router.get('/user/:userId', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const [images, total] = await Promise.all([
        index_1.prisma.image.findMany({
            where: { authorId: userId },
            skip: offset,
            take: Number(limit),
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                s3Key: true,
                thumbnailS3Key: true,
                altText: true,
                caption: true,
                width: true,
                height: true,
                size: true,
                mimeType: true,
                tags: true,
                createdAt: true,
                updatedAt: true,
                authorId: true
            }
        }),
        index_1.prisma.image.count({
            where: { authorId: userId }
        })
    ]);
    res.json({
        success: true,
        data: {
            images,
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
router.get('/:id', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) {
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
    }
    const image = await index_1.prisma.image.findUnique({
        where: { id },
        select: {
            id: true,
            s3Key: true,
            thumbnailS3Key: true,
            altText: true,
            caption: true,
            width: true,
            height: true,
            size: true,
            mimeType: true,
            tags: true,
            createdAt: true,
            updatedAt: true,
            authorId: true
        }
    });
    if (!image) {
        res.status(404).json({
            success: false,
            error: 'Image not found'
        });
        return;
    }
    res.json({
        success: true,
        data: { image }
    });
}));
router.post('/upload', auth_1.authMiddleware, upload.single('image'), (0, errorHandler_1.asyncHandler)(async (req, res) => {
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
            error: 'No image file provided'
        });
        return;
    }
    const processedImage = await (0, imageProcessor_1.processImage)(req.file.buffer, req.file.originalname, req.file.mimetype, userId);
    let tags = [];
    if (req.body.tags) {
        try {
            tags = JSON.parse(req.body.tags);
        }
        catch (error) {
            console.warn('Failed to parse tags:', error);
        }
    }
    const image = await index_1.prisma.image.create({
        data: {
            url: processedImage.imagePath,
            thumbnail: processedImage.thumbnailPath,
            s3Key: processedImage.s3Key,
            thumbnailS3Key: processedImage.thumbnailS3Key,
            altText: req.body.title || req.body.altText || 'Uploaded image',
            caption: req.body.description || req.body.caption || '',
            tags: tags,
            width: processedImage.width,
            height: processedImage.height,
            size: processedImage.size,
            mimeType: req.file.mimetype,
            authorId: userId
        }
    });
    console.log('Image created successfully:', {
        id: image.id,
        title: image.altText,
        authorId: image.authorId,
        imagePath: processedImage.imagePath,
        thumbnailPath: processedImage.thumbnailPath
    });
    res.status(201).json({
        success: true,
        data: { image },
        message: 'Image uploaded successfully'
    });
}));
router.post('/', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { url, altText, caption, postId, galleryId } = req.body;
    if (!userId) {
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
    }
    const image = await index_1.prisma.image.create({
        data: {
            url,
            altText,
            caption,
            postId,
            galleryId,
            authorId: userId
        }
    });
    res.status(201).json({
        success: true,
        data: { image },
        message: 'Image uploaded successfully'
    });
}));
router.put('/:id', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { id } = req.params;
    const { altText, caption, title, description, tags } = req.body;
    if (!userId) {
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
    }
    const image = await index_1.prisma.image.findUnique({
        where: { id }
    });
    if (!image) {
        res.status(404).json({
            success: false,
            error: 'Image not found'
        });
        return;
    }
    if (image.authorId !== userId) {
        res.status(403).json({
            success: false,
            error: 'Not authorized to update this image'
        });
        return;
    }
    const newAltText = title || altText || null;
    const newCaption = description || caption || null;
    const updatedImage = await index_1.prisma.image.update({
        where: { id },
        data: {
            altText: newAltText,
            caption: newCaption,
            tags: tags || undefined
        }
    });
    res.json({
        success: true,
        data: { image: updatedImage },
        message: 'Image updated successfully'
    });
}));
router.delete('/:id', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) {
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
    }
    const image = await index_1.prisma.image.findUnique({
        where: { id },
        select: {
            id: true,
            url: true,
            thumbnail: true,
            s3Key: true,
            thumbnailS3Key: true,
            authorId: true
        }
    });
    if (!image) {
        res.status(404).json({
            success: false,
            error: 'Image not found'
        });
        return;
    }
    if (image.authorId !== userId) {
        res.status(403).json({
            success: false,
            error: 'Not authorized to delete this image'
        });
        return;
    }
    if (image.s3Key) {
        await (0, imageProcessor_1.deleteImageFiles)(image.s3Key, image.thumbnailS3Key || undefined);
    }
    await index_1.prisma.image.delete({
        where: { id }
    });
    res.json({
        success: true,
        message: 'Image deleted successfully'
    });
}));
exports.default = router;
//# sourceMappingURL=images.js.map