"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("@/index");
const errorHandler_1 = require("@/middleware/errorHandler");
const auth_1 = require("@/middleware/auth");
const router = (0, express_1.Router)();
router.get('/post/:postId', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { postId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const [comments, total] = await Promise.all([
        index_1.prisma.comment.findMany({
            where: {
                postId,
                parentId: null
            },
            include: {
                author: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        avatar: true
                    }
                },
                replies: {
                    include: {
                        author: {
                            select: {
                                id: true,
                                name: true,
                                username: true,
                                avatar: true
                            }
                        }
                    }
                },
                _count: {
                    select: {
                        replies: true,
                        reactions: true
                    }
                }
            },
            skip: offset,
            take: Number(limit),
            orderBy: { createdAt: 'desc' }
        }),
        index_1.prisma.comment.count({
            where: {
                postId,
                parentId: null
            }
        })
    ]);
    res.json({
        success: true,
        data: {
            comments,
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
    const { content, postId, parentId } = req.body;
    if (!userId) {
        return res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
    }
    const comment = await index_1.prisma.comment.create({
        data: {
            content,
            postId,
            parentId,
            authorId: userId
        },
        include: {
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
    res.status(201).json({
        success: true,
        data: { comment },
        message: 'Comment created successfully'
    });
}));
router.put('/:id', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { id } = req.params;
    const { content } = req.body;
    if (!userId) {
        return res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
    }
    const comment = await index_1.prisma.comment.findUnique({
        where: { id }
    });
    if (!comment) {
        return res.status(404).json({
            success: false,
            error: 'Comment not found'
        });
    }
    if (comment.authorId !== userId) {
        return res.status(403).json({
            success: false,
            error: 'Not authorized to update this comment'
        });
    }
    const updatedComment = await index_1.prisma.comment.update({
        where: { id },
        data: { content },
        include: {
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
    res.json({
        success: true,
        data: { comment: updatedComment },
        message: 'Comment updated successfully'
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
    const comment = await index_1.prisma.comment.findUnique({
        where: { id }
    });
    if (!comment) {
        return res.status(404).json({
            success: false,
            error: 'Comment not found'
        });
    }
    if (comment.authorId !== userId) {
        return res.status(403).json({
            success: false,
            error: 'Not authorized to delete this comment'
        });
    }
    await index_1.prisma.comment.delete({
        where: { id }
    });
    res.json({
        success: true,
        message: 'Comment deleted successfully'
    });
}));
exports.default = router;
//# sourceMappingURL=comments.js.map