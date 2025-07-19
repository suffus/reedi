"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("@/index");
const errorHandler_1 = require("@/middleware/errorHandler");
const auth_1 = require("@/middleware/auth");
const router = (0, express_1.Router)();
router.get('/user/:userId', auth_1.optionalAuthMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
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
    const where = {
        authorId: userId,
        ...(visibilityFilter.length > 0 ? { OR: visibilityFilter } : {})
    };
    const [galleries, total] = await Promise.all([
        index_1.prisma.gallery.findMany({
            where,
            include: {
                _count: {
                    select: {
                        images: true
                    }
                },
                coverImage: {
                    select: {
                        id: true,
                        s3Key: true,
                        thumbnailS3Key: true,
                        altText: true,
                        caption: true
                    }
                }
            },
            skip: offset,
            take: Number(limit),
            orderBy: { createdAt: 'desc' }
        }),
        index_1.prisma.gallery.count({ where })
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
router.get('/my', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    if (!userId) {
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
    }
    const [galleries, total] = await Promise.all([
        index_1.prisma.gallery.findMany({
            where: { authorId: userId },
            include: {
                _count: {
                    select: {
                        images: true
                    }
                },
                coverImage: {
                    select: {
                        id: true,
                        s3Key: true,
                        thumbnailS3Key: true,
                        altText: true,
                        caption: true
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
    const { name, description, visibility = 'PUBLIC' } = req.body;
    if (!userId) {
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
    }
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({
            success: false,
            error: 'Gallery name is required'
        });
        return;
    }
    const gallery = await index_1.prisma.gallery.create({
        data: {
            name: name.trim(),
            description: description?.trim(),
            visibility,
            authorId: userId
        },
        include: {
            _count: {
                select: {
                    images: true
                }
            }
        }
    });
    res.status(201).json({
        success: true,
        data: { gallery },
        message: 'Gallery created successfully'
    });
}));
router.get('/:id', auth_1.optionalAuthMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const viewerId = req.user?.id;
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
                orderBy: [
                    { order: 'asc' },
                    { createdAt: 'asc' }
                ],
                select: {
                    id: true,
                    s3Key: true,
                    thumbnailS3Key: true,
                    altText: true,
                    caption: true,
                    tags: true,
                    visibility: true,
                    createdAt: true,
                    order: true
                }
            },
            coverImage: {
                select: {
                    id: true,
                    s3Key: true,
                    thumbnailS3Key: true,
                    altText: true,
                    caption: true
                }
            },
            _count: {
                select: {
                    images: true
                }
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
    if (gallery.visibility === 'PRIVATE' && gallery.authorId !== viewerId) {
        res.status(403).json({
            success: false,
            error: 'Gallery is private'
        });
        return;
    }
    if (gallery.visibility === 'FRIENDS_ONLY' && gallery.authorId !== viewerId) {
        if (!viewerId) {
            res.status(403).json({
                success: false,
                error: 'Gallery is friends only'
            });
            return;
        }
        const isFriend = await index_1.prisma.friendRequest.findFirst({
            where: {
                OR: [
                    { senderId: viewerId, receiverId: gallery.authorId, status: 'ACCEPTED' },
                    { senderId: gallery.authorId, receiverId: viewerId, status: 'ACCEPTED' }
                ]
            }
        });
        if (!isFriend) {
            res.status(403).json({
                success: false,
                error: 'Gallery is friends only'
            });
            return;
        }
    }
    const visibleImages = gallery.images.filter(image => {
        if (image.visibility === 'PUBLIC')
            return true;
        if (gallery.authorId === viewerId)
            return true;
        if (image.visibility === 'FRIENDS_ONLY' && viewerId) {
            return true;
        }
        return false;
    });
    res.json({
        success: true,
        data: {
            gallery: {
                ...gallery,
                images: visibleImages
            }
        }
    });
}));
router.put('/:id', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { id } = req.params;
    const { name, description, visibility } = req.body;
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
    const updateData = {};
    if (name !== undefined)
        updateData.name = name.trim();
    if (description !== undefined)
        updateData.description = description?.trim();
    if (visibility !== undefined)
        updateData.visibility = visibility;
    const updatedGallery = await index_1.prisma.gallery.update({
        where: { id },
        data: updateData,
        include: {
            _count: {
                select: {
                    images: true
                }
            },
            coverImage: {
                select: {
                    id: true,
                    s3Key: true,
                    thumbnailS3Key: true,
                    altText: true,
                    caption: true
                }
            }
        }
    });
    res.json({
        success: true,
        data: { gallery: updatedGallery },
        message: 'Gallery updated successfully'
    });
}));
router.post('/:id/cover', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { id } = req.params;
    const { imageId } = req.body;
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
    if (imageId) {
        const image = await index_1.prisma.image.findUnique({
            where: { id: imageId }
        });
        if (!image || image.authorId !== userId) {
            res.status(400).json({
                success: false,
                error: 'Invalid image ID'
            });
            return;
        }
    }
    const updatedGallery = await index_1.prisma.gallery.update({
        where: { id },
        data: {
            coverImageId: imageId || null
        },
        include: {
            coverImage: {
                select: {
                    id: true,
                    s3Key: true,
                    thumbnailS3Key: true,
                    altText: true,
                    caption: true
                }
            }
        }
    });
    res.json({
        success: true,
        data: { gallery: updatedGallery },
        message: 'Gallery cover image updated successfully'
    });
}));
router.post('/:id/images', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { id } = req.params;
    const { imageIds } = req.body;
    if (!userId) {
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
    }
    if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
        res.status(400).json({
            success: false,
            error: 'Image IDs array is required'
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
            error: 'Not authorized to modify this gallery'
        });
        return;
    }
    const userImages = await index_1.prisma.image.findMany({
        where: {
            id: { in: imageIds },
            authorId: userId
        },
        select: { id: true }
    });
    if (userImages.length !== imageIds.length) {
        res.status(400).json({
            success: false,
            error: 'Some images do not belong to you or do not exist'
        });
        return;
    }
    await index_1.prisma.image.updateMany({
        where: {
            id: { in: imageIds }
        },
        data: {
            galleryId: id
        }
    });
    res.json({
        success: true,
        message: 'Images added to gallery successfully'
    });
}));
router.delete('/:id/images', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { id } = req.params;
    const { imageIds } = req.body;
    if (!userId) {
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
    }
    if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
        res.status(400).json({
            success: false,
            error: 'Image IDs array is required'
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
            error: 'Not authorized to modify this gallery'
        });
        return;
    }
    await index_1.prisma.image.updateMany({
        where: {
            id: { in: imageIds },
            galleryId: id
        },
        data: {
            galleryId: null
        }
    });
    res.json({
        success: true,
        message: 'Images removed from gallery successfully'
    });
}));
router.put('/:id/images/reorder', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { id } = req.params;
    const { imageIds } = req.body;
    if (!userId) {
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
    }
    const gallery = await index_1.prisma.gallery.findUnique({
        where: { id },
        include: {
            images: true
        }
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
            error: 'Not authorized to reorder images in this gallery'
        });
        return;
    }
    const galleryImageIds = gallery.images.map(img => img.id);
    const isValidOrder = imageIds.every((imageId) => galleryImageIds.includes(imageId));
    const hasAllImages = galleryImageIds.every(imageId => imageIds.includes(imageId));
    if (!isValidOrder || !hasAllImages) {
        res.status(400).json({
            success: false,
            error: 'Invalid image order provided'
        });
        return;
    }
    for (let i = 0; i < imageIds.length; i++) {
        await index_1.prisma.image.update({
            where: { id: imageIds[i] },
            data: { order: i }
        });
    }
    res.json({
        success: true,
        message: 'Image order updated successfully'
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