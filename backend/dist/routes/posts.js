"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("@/index");
const errorHandler_1 = require("@/middleware/errorHandler");
const auth_1 = require("@/middleware/auth");
const router = (0, express_1.Router)();
router.get('/', auth_1.optionalAuthMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const [posts, total] = await Promise.all([
        index_1.prisma.post.findMany({
            where: {
                isPublished: true,
                isPrivate: false
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
                reactions: {
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
                        comments: true,
                        reactions: true
                    }
                }
            },
            skip: offset,
            take: Number(limit),
            orderBy: { createdAt: 'desc' }
        }),
        index_1.prisma.post.count({
            where: {
                isPublished: true,
                isPrivate: false
            }
        })
    ]);
    res.json({
        success: true,
        data: {
            posts,
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
router.get('/feed', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    if (!userId) {
        return res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
    }
    const [posts, total] = await Promise.all([
        index_1.prisma.post.findMany({
            where: {
                OR: [
                    {
                        author: {
                            followers: {
                                some: {
                                    followerId: userId
                                }
                            }
                        }
                    },
                    {
                        isPrivate: false
                    },
                    {
                        authorId: userId
                    }
                ],
                isPublished: true
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
                reactions: {
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
                        comments: true,
                        reactions: true
                    }
                }
            },
            skip: offset,
            take: Number(limit),
            orderBy: { createdAt: 'desc' }
        }),
        index_1.prisma.post.count({
            where: {
                OR: [
                    {
                        author: {
                            followers: {
                                some: {
                                    followerId: userId
                                }
                            }
                        }
                    },
                    {
                        isPrivate: false
                    },
                    {
                        authorId: userId
                    }
                ],
                isPublished: true
            }
        })
    ]);
    res.json({
        success: true,
        data: {
            posts,
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
    const { title, content, isPrivate, hashtags, mentions } = req.body;
    if (!userId) {
        return res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
    }
    const post = await index_1.prisma.post.create({
        data: {
            title,
            content,
            isPrivate: isPrivate || false,
            authorId: userId,
            hashtags: {
                connectOrCreate: hashtags?.map((tag) => ({
                    where: { name: tag.toLowerCase() },
                    create: { name: tag.toLowerCase() }
                })) || []
            }
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
            hashtags: true
        }
    });
    res.status(201).json({
        success: true,
        data: { post },
        message: 'Post created successfully'
    });
}));
router.get('/:id', auth_1.optionalAuthMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id;
    const post = await index_1.prisma.post.findUnique({
        where: { id },
        include: {
            author: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                    avatar: true,
                    isPrivate: true
                }
            },
            comments: {
                include: {
                    author: {
                        select: {
                            id: true,
                            name: true,
                            username: true,
                            avatar: true
                        }
                    }
                },
                orderBy: { createdAt: 'asc' }
            },
            reactions: true,
            images: true,
            hashtags: true
        }
    });
    if (!post) {
        return res.status(404).json({
            success: false,
            error: 'Post not found'
        });
    }
    if (post.isPrivate && post.authorId !== userId) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }
    res.json({
        success: true,
        data: { post }
    });
}));
router.put('/:id', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { id } = req.params;
    const { title, content, isPrivate, hashtags } = req.body;
    if (!userId) {
        return res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
    }
    const post = await index_1.prisma.post.findUnique({
        where: { id }
    });
    if (!post) {
        return res.status(404).json({
            success: false,
            error: 'Post not found'
        });
    }
    if (post.authorId !== userId) {
        return res.status(403).json({
            success: false,
            error: 'Not authorized to update this post'
        });
    }
    const updatedPost = await index_1.prisma.post.update({
        where: { id },
        data: {
            title,
            content,
            isPrivate,
            hashtags: {
                set: [],
                connectOrCreate: hashtags?.map((tag) => ({
                    where: { name: tag.toLowerCase() },
                    create: { name: tag.toLowerCase() }
                })) || []
            }
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
            hashtags: true
        }
    });
    res.json({
        success: true,
        data: { post: updatedPost },
        message: 'Post updated successfully'
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
    const post = await index_1.prisma.post.findUnique({
        where: { id }
    });
    if (!post) {
        return res.status(404).json({
            success: false,
            error: 'Post not found'
        });
    }
    if (post.authorId !== userId) {
        return res.status(403).json({
            success: false,
            error: 'Not authorized to delete this post'
        });
    }
    await index_1.prisma.post.delete({
        where: { id }
    });
    res.json({
        success: true,
        message: 'Post deleted successfully'
    });
}));
router.get('/:postId/reactions', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { postId } = req.params;
    const reactions = await index_1.prisma.reaction.findMany({
        where: { postId },
        include: {
            author: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                    avatar: true
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    });
    res.json({
        success: true,
        data: { reactions }
    });
}));
router.post('/:postId/reactions', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { postId } = req.params;
    const { type = 'LIKE' } = req.body;
    if (!userId) {
        return res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
    }
    const post = await index_1.prisma.post.findUnique({
        where: { id: postId }
    });
    if (!post) {
        return res.status(404).json({
            success: false,
            error: 'Post not found'
        });
    }
    const existingReaction = await index_1.prisma.reaction.findFirst({
        where: {
            postId,
            authorId: userId
        }
    });
    if (existingReaction) {
        const updatedReaction = await index_1.prisma.reaction.update({
            where: { id: existingReaction.id },
            data: { type },
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
        return res.json({
            success: true,
            data: { reaction: updatedReaction },
            message: 'Reaction updated successfully'
        });
    }
    const reaction = await index_1.prisma.reaction.create({
        data: {
            type,
            postId,
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
        data: { reaction },
        message: 'Reaction added successfully'
    });
}));
router.delete('/:postId/reactions', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { postId } = req.params;
    if (!userId) {
        return res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
    }
    const reaction = await index_1.prisma.reaction.findFirst({
        where: {
            postId,
            authorId: userId
        }
    });
    if (!reaction) {
        return res.status(404).json({
            success: false,
            error: 'Reaction not found'
        });
    }
    await index_1.prisma.reaction.delete({
        where: { id: reaction.id }
    });
    res.json({
        success: true,
        message: 'Reaction removed successfully'
    });
}));
exports.default = router;
//# sourceMappingURL=posts.js.map