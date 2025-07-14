"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("@/index");
const errorHandler_1 = require("@/middleware/errorHandler");
const auth_1 = require("@/middleware/auth");
const router = (0, express_1.Router)();
router.get('/:userId', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const [images, total] = await Promise.all([
        index_1.prisma.image.findMany({
            where: { authorId: userId },
            orderBy: { createdAt: 'desc' },
            skip: offset,
            take: Number(limit),
        }),
        index_1.prisma.image.count({ where: { authorId: userId } })
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
router.get('/user/:userId', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const [galleries, total] = await Promise.all([
        index_1.prisma.gallery.findMany({
            where: { authorId: userId },
            include: {
                _count: {
                    select: {
                        images: true
                    }
                }
            },
            skip: offset,
            take: Number(limit),
            orderBy: { createdAt: 'desc' }
        }),
        index_1.prisma.gallery.count({
            where: { authorId: userId }
        })
    ]);
    res.json({
        success: true,
        data: {
            galleries,
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
router.post('/', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { name, description, isPrivate } = req.body;
    if (!userId) {
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
    }
    const gallery = await index_1.prisma.gallery.create({
        data: {
            name,
            description,
            isPrivate: isPrivate || false,
            authorId: userId
        }
    });
    res.status(201).json({
        success: true,
        data: { gallery },
        message: 'Gallery created successfully'
    });
}));
router.get('/:id', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const gallery = await index_1.prisma.gallery.findUnique({
        where: { id },
        include: {
            author: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                    avatar: true
                }
            },
            images: {
                orderBy: { createdAt: 'desc' }
            }
        }
    });
    if (!gallery) {
        res.status(404).json({
            success: false,
            error: 'Gallery not found'
        });
        return;
    }
    res.json({
        success: true,
        data: { gallery }
    });
}));
router.put('/:id', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { id } = req.params;
    const { name, description, isPrivate } = req.body;
    if (!userId) {
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
    }
    const gallery = await index_1.prisma.gallery.findUnique({
        where: { id }
    });
    if (!gallery) {
        res.status(404).json({
            success: false,
            error: 'Gallery not found'
        });
        return;
    }
    if (gallery.authorId !== userId) {
        res.status(403).json({
            success: false,
            error: 'Not authorized to update this gallery'
        });
        return;
    }
    const updatedGallery = await index_1.prisma.gallery.update({
        where: { id },
        data: {
            name,
            description,
            isPrivate
        }
    });
    res.json({
        success: true,
        data: { gallery: updatedGallery },
        message: 'Gallery updated successfully'
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
    const gallery = await index_1.prisma.gallery.findUnique({
        where: { id }
    });
    if (!gallery) {
        res.status(404).json({
            success: false,
            error: 'Gallery not found'
        });
        return;
    }
    if (gallery.authorId !== userId) {
        res.status(403).json({
            success: false,
            error: 'Not authorized to delete this gallery'
        });
        return;
    }
    await index_1.prisma.gallery.delete({
        where: { id }
    });
    res.json({
        success: true,
        message: 'Gallery deleted successfully'
    });
}));
exports.default = router;
//# sourceMappingURL=galleries.js.map