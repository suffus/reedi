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
                publicationStatus: 'PUBLIC',
                visibility: 'PUBLIC'
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
                },
                images: {
                    include: { image: true },
                    orderBy: { order: 'asc' }
                }
            },
            skip: offset,
            take: Number(limit),
            orderBy: { createdAt: 'desc' }
        }),
        index_1.prisma.post.count({
            where: {
                publicationStatus: 'PUBLIC',
                visibility: 'PUBLIC'
            }
        })
    ]);
    const postsWithOrderedImages = posts.map(post => ({
        ...post,
        images: post.images.map(pi => pi.image)
    }));
    res.json({
        success: true,
        data: {
            posts: postsWithOrderedImages,
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
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
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
                        },
                        publicationStatus: 'PUBLIC',
                        visibility: {
                            in: ['PUBLIC', 'FRIENDS_ONLY']
                        }
                    },
                    {
                        author: {
                            OR: [
                                {
                                    friendRequestsSent: {
                                        some: {
                                            receiverId: userId,
                                            status: 'ACCEPTED'
                                        }
                                    }
                                },
                                {
                                    friendRequestsReceived: {
                                        some: {
                                            senderId: userId,
                                            status: 'ACCEPTED'
                                        }
                                    }
                                }
                            ]
                        },
                        publicationStatus: 'PUBLIC',
                        visibility: {
                            in: ['PUBLIC', 'FRIENDS_ONLY']
                        }
                    },
                    {
                        visibility: 'PUBLIC',
                        publicationStatus: 'PUBLIC'
                    },
                    {
                        authorId: userId,
                        publicationStatus: {
                            in: ['PUBLIC', 'PAUSED']
                        }
                    }
                ]
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
                },
                images: {
                    include: { image: true },
                    orderBy: { order: 'asc' }
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
                        },
                        publicationStatus: 'PUBLIC',
                        visibility: {
                            in: ['PUBLIC', 'FRIENDS_ONLY']
                        }
                    },
                    {
                        author: {
                            OR: [
                                {
                                    friendRequestsSent: {
                                        some: {
                                            receiverId: userId,
                                            status: 'ACCEPTED'
                                        }
                                    }
                                },
                                {
                                    friendRequestsReceived: {
                                        some: {
                                            senderId: userId,
                                            status: 'ACCEPTED'
                                        }
                                    }
                                }
                            ]
                        },
                        publicationStatus: 'PUBLIC',
                        visibility: {
                            in: ['PUBLIC', 'FRIENDS_ONLY']
                        }
                    },
                    {
                        visibility: 'PUBLIC',
                        publicationStatus: 'PUBLIC'
                    },
                    {
                        authorId: userId,
                        publicationStatus: {
                            in: ['PUBLIC', 'PAUSED']
                        }
                    }
                ]
            }
        })
    ]);
    const postsWithOrderedImages = posts.map(post => ({
        ...post,
        images: post.images.map(pi => pi.image)
    }));
    res.json({
        success: true,
        data: {
            posts: postsWithOrderedImages,
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
    const { title, content, visibility, hashtags, mentions, imageIds } = req.body;
    if (!userId) {
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
    }
    if (imageIds && imageIds.length > 0) {
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
    }
    const postWithImages = await index_1.prisma.$transaction(async (tx) => {
        const post = await tx.post.create({
            data: {
                title,
                content,
                visibility: visibility || 'PUBLIC',
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
        if (imageIds && imageIds.length > 0) {
            await tx.postImage.createMany({
                data: imageIds.map((imageId, index) => ({
                    postId: post.id,
                    imageId,
                    order: index
                }))
            });
        }
        return await tx.post.findUnique({
            where: { id: post.id },
            include: {
                author: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        avatar: true
                    }
                },
                hashtags: true,
                images: {
                    include: { image: true },
                    orderBy: { order: 'asc' }
                }
            }
        });
    }, {
        maxWait: 5000,
        timeout: 10000,
    });
    const postWithOrderedImages = {
        ...postWithImages,
        images: postWithImages?.images.map(pi => pi.image) || []
    };
    res.status(201).json({
        success: true,
        data: { post: postWithOrderedImages },
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
                    avatar: true
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
            images: {
                include: { image: true },
                orderBy: { order: 'asc' }
            },
            hashtags: true
        }
    });
    if (!post) {
        res.status(404).json({
            success: false,
            error: 'Post not found'
        });
        return;
    }
    if (post.publicationStatus === 'DELETED') {
        res.status(404).json({
            success: false,
            error: 'Post not found'
        });
        return;
    }
    if (post.publicationStatus === 'PAUSED' && post.authorId !== userId) {
        res.status(404).json({
            success: false,
            error: 'Post not found'
        });
        return;
    }
    if (post.visibility !== 'PUBLIC' && post.authorId !== userId) {
        res.status(403).json({
            success: false,
            error: 'Access denied'
        });
        return;
    }
    const postWithOrderedImages = {
        ...post,
        images: post.images.map(pi => pi.image)
    };
    res.json({
        success: true,
        data: { post: postWithOrderedImages }
    });
}));
router.put('/:id', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { id } = req.params;
    const { title, content, visibility, hashtags, imageIds } = req.body;
    if (!userId) {
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
    }
    const post = await index_1.prisma.post.findUnique({
        where: { id }
    });
    if (!post) {
        res.status(404).json({
            success: false,
            error: 'Post not found'
        });
        return;
    }
    if (post.authorId !== userId) {
        res.status(403).json({
            success: false,
            error: 'Not authorized to update this post'
        });
        return;
    }
    if (imageIds && imageIds.length > 0) {
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
    }
    const updatedPost = await index_1.prisma.post.update({
        where: { id },
        data: {
            title,
            content,
            visibility,
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
    if (imageIds) {
        await index_1.prisma.postImage.deleteMany({
            where: { postId: id }
        });
        if (imageIds.length > 0) {
            await index_1.prisma.postImage.createMany({
                data: imageIds.map((imageId, index) => ({
                    postId: id,
                    imageId,
                    order: index
                }))
            });
        }
    }
    const postWithImages = await index_1.prisma.post.findUnique({
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
            hashtags: true,
            images: {
                include: { image: true },
                orderBy: { order: 'asc' }
            }
        }
    });
    const postWithOrderedImages = {
        ...postWithImages,
        images: postWithImages?.images.map(pi => pi.image) || []
    };
    res.json({
        success: true,
        data: { post: postWithOrderedImages },
        message: 'Post updated successfully'
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
    const post = await index_1.prisma.post.findUnique({
        where: { id }
    });
    if (!post) {
        res.status(404).json({
            success: false,
            error: 'Post not found'
        });
        return;
    }
    if (post.authorId !== userId) {
        res.status(403).json({
            success: false,
            error: 'Not authorized to delete this post'
        });
        return;
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
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
    }
    const post = await index_1.prisma.post.findUnique({
        where: { id: postId }
    });
    if (!post) {
        res.status(404).json({
            success: false,
            error: 'Post not found'
        });
        return;
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
        res.json({
            success: true,
            data: { reaction: updatedReaction },
            message: 'Reaction updated successfully'
        });
        return;
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
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
    }
    const reaction = await index_1.prisma.reaction.findFirst({
        where: {
            postId,
            authorId: userId
        }
    });
    if (!reaction) {
        res.status(404).json({
            success: false,
            error: 'Reaction not found'
        });
        return;
    }
    await index_1.prisma.reaction.delete({
        where: { id: reaction.id }
    });
    res.json({
        success: true,
        message: 'Reaction removed successfully'
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
    const post = await index_1.prisma.post.findUnique({
        where: { id },
        include: {
            images: {
                include: { image: true },
                orderBy: { order: 'asc' }
            }
        }
    });
    if (!post) {
        res.status(404).json({
            success: false,
            error: 'Post not found'
        });
        return;
    }
    if (post.authorId !== userId) {
        res.status(403).json({
            success: false,
            error: 'Not authorized to reorder images in this post'
        });
        return;
    }
    const postImageIds = post.images.map(pi => pi.image.id);
    const isValidOrder = imageIds.every((imageId) => postImageIds.includes(imageId));
    const hasAllImages = postImageIds.every(imageId => imageIds.includes(imageId));
    if (!isValidOrder || !hasAllImages) {
        res.status(400).json({
            success: false,
            error: 'Invalid image order provided'
        });
        return;
    }
    for (let i = 0; i < imageIds.length; i++) {
        await index_1.prisma.postImage.updateMany({
            where: {
                postId: id,
                imageId: imageIds[i]
            },
            data: {
                order: i
            }
        });
    }
    res.json({
        success: true,
        message: 'Image order updated successfully'
    });
}));
router.patch('/:id/status', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { id } = req.params;
    const { publicationStatus } = req.body;
    if (!userId) {
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
    }
    const validStatuses = ['PUBLIC', 'PAUSED', 'CONTROLLED', 'DELETED'];
    if (!validStatuses.includes(publicationStatus)) {
        res.status(400).json({
            success: false,
            error: 'Invalid publication status'
        });
        return;
    }
    const post = await index_1.prisma.post.findUnique({
        where: { id }
    });
    if (!post) {
        res.status(404).json({
            success: false,
            error: 'Post not found'
        });
        return;
    }
    if (post.authorId !== userId) {
        res.status(403).json({
            success: false,
            error: 'Not authorized to update this post'
        });
        return;
    }
    const updatedPost = await index_1.prisma.post.update({
        where: { id },
        data: { publicationStatus },
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
                include: { image: true },
                orderBy: { order: 'asc' }
            }
        }
    });
    const postWithOrderedImages = {
        ...updatedPost,
        images: updatedPost.images.map(pi => pi.image)
    };
    res.json({
        success: true,
        data: { post: postWithOrderedImages },
        message: 'Post status updated successfully'
    });
}));
router.patch('/:id/visibility', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { id } = req.params;
    const { visibility } = req.body;
    if (!userId) {
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
    }
    const validVisibilities = ['PUBLIC', 'FRIENDS_ONLY', 'PRIVATE'];
    if (!validVisibilities.includes(visibility)) {
        res.status(400).json({
            success: false,
            error: 'Invalid visibility setting'
        });
        return;
    }
    const post = await index_1.prisma.post.findUnique({
        where: { id }
    });
    if (!post) {
        res.status(404).json({
            success: false,
            error: 'Post not found'
        });
        return;
    }
    if (post.authorId !== userId) {
        res.status(403).json({
            success: false,
            error: 'Not authorized to update this post'
        });
        return;
    }
    const updatedPost = await index_1.prisma.post.update({
        where: { id },
        data: { visibility },
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
                include: { image: true },
                orderBy: { order: 'asc' }
            }
        }
    });
    const postWithOrderedImages = {
        ...updatedPost,
        images: updatedPost.images.map(pi => pi.image)
    };
    res.json({
        success: true,
        data: { post: postWithOrderedImages },
        message: 'Post visibility updated successfully'
    });
}));
router.get('/user/:userId/public', auth_1.optionalAuthMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { userId } = req.params;
    const viewerId = req.user?.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    console.log('Public posts request:', { userId, viewerId, page, limit });
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
    const user = await index_1.prisma.user.findFirst({
        where: {
            OR: [
                { id: userId },
                { username: userId }
            ]
        },
        select: { id: true, username: true }
    });
    if (!user) {
        res.status(404).json({
            success: false,
            error: 'User not found'
        });
        return;
    }
    console.log('Found user:', user);
    const where = {
        authorId: user.id,
        publicationStatus: 'PUBLIC',
        ...(visibilityFilter.length > 0 ? { OR: visibilityFilter } : {})
    };
    console.log('Query where clause:', where);
    const [posts, total] = await Promise.all([
        index_1.prisma.post.findMany({
            where,
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
                },
                images: {
                    include: { image: true },
                    orderBy: { order: 'asc' }
                }
            },
            skip: offset,
            take: Number(limit),
            orderBy: { createdAt: 'desc' }
        }),
        index_1.prisma.post.count({ where })
    ]);
    console.log('Found posts:', posts.length, 'Total:', total);
    const postsWithOrderedImages = posts.map(post => ({
        ...post,
        images: (post.images || []).map((pi) => pi.image)
    }));
    res.json({
        success: true,
        data: {
            posts: postsWithOrderedImages,
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
router.get('/public', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const [posts, total] = await Promise.all([
        index_1.prisma.post.findMany({
            where: {
                publicationStatus: 'PUBLIC',
                visibility: 'PUBLIC'
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
                images: {
                    include: {
                        image: true
                    }
                },
                hashtags: true,
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
                publicationStatus: 'PUBLIC',
                visibility: 'PUBLIC'
            }
        })
    ]);
    const formattedPosts = posts.map(post => ({
        ...post,
        images: post.images.map(pi => pi.image)
    }));
    res.json({
        success: true,
        data: {
            posts: formattedPosts,
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
//# sourceMappingURL=posts.js.map