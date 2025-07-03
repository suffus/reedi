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
const router = (0, express_1.Router)();
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024,
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
            orderBy: { createdAt: 'desc' }
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
router.post('/upload', auth_1.authMiddleware, upload.single('image'), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
    }
    if (!req.file) {
        return res.status(400).json({
            success: false,
            error: 'No image file provided'
        });
    }
    const base64Data = req.file.buffer.toString('base64');
    const dataUrl = `data:${req.file.mimetype};base64,${base64Data}`;
    const image = await index_1.prisma.image.create({
        data: {
            url: dataUrl,
            altText: req.body.title || 'Uploaded image',
            caption: req.body.description || '',
            authorId: userId
        }
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
        return res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
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
router.delete('/:id', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) {
        return res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
    }
    const image = await index_1.prisma.image.findUnique({
        where: { id }
    });
    if (!image) {
        return res.status(404).json({
            success: false,
            error: 'Image not found'
        });
    }
    if (image.authorId !== userId) {
        return res.status(403).json({
            success: false,
            error: 'Not authorized to delete this image'
        });
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