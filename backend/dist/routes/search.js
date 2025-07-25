"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("@/index");
const errorHandler_1 = require("@/middleware/errorHandler");
const auth_1 = require("@/middleware/auth");
const router = (0, express_1.Router)();
router.get('/images/tags', auth_1.optionalAuthMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { tags, page = 1, limit = 20 } = req.query;
    const userId = req.user?.id;
    if (!tags || typeof tags !== 'string') {
        res.status(400).json({
            success: false,
            error: 'Tags parameter is required'
        });
        return;
    }
    const offset = (Number(page) - 1) * Number(limit);
    const tagArray = tags.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag.length > 0);
    if (tagArray.length === 0) {
        res.status(400).json({
            success: false,
            error: 'At least one valid tag is required'
        });
        return;
    }
    let visibilityFilter = [
        { visibility: 'PUBLIC' }
    ];
    if (userId) {
        const friendRelationships = await index_1.prisma.friendRequest.findMany({
            where: {
                OR: [
                    { senderId: userId, status: 'ACCEPTED' },
                    { receiverId: userId, status: 'ACCEPTED' }
                ]
            },
            select: {
                senderId: true,
                receiverId: true
            }
        });
        const friendIds = friendRelationships.map(rel => rel.senderId === userId ? rel.receiverId : rel.senderId);
        if (friendIds.length > 0) {
            visibilityFilter.push({
                AND: [
                    { visibility: 'FRIENDS_ONLY' },
                    { authorId: { in: friendIds } }
                ]
            });
        }
        visibilityFilter.push({ authorId: userId });
    }
    const tagWhereClause = tagArray.length === 1
        ? { tags: { has: tagArray[0] } }
        : { AND: tagArray.map(tag => ({ tags: { has: tag } })) };
    const where = {
        ...tagWhereClause,
        OR: visibilityFilter
    };
    const [media, total] = await Promise.all([
        index_1.prisma.media.findMany({
            where,
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
        }),
        index_1.prisma.media.count({ where })
    ]);
    res.json({
        success: true,
        data: {
            media,
            tags: tagArray,
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
router.get('/', auth_1.optionalAuthMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { q: query, type = 'all', page = 1, limit = 20 } = req.query;
    const userId = req.user?.id;
    if (!query || typeof query !== 'string') {
        res.status(400).json({
            success: false,
            error: 'Search query is required'
        });
        return;
    }
    const offset = (Number(page) - 1) * Number(limit);
    const searchTerm = query.toLowerCase();
    let results = {};
    let total = 0;
    if (type === 'all' || type === 'posts') {
        const [posts, postsCount] = await Promise.all([
            index_1.prisma.post.findMany({
                where: {
                    OR: [
                        { title: { contains: searchTerm, mode: 'insensitive' } },
                        { content: { contains: searchTerm, mode: 'insensitive' } }
                    ],
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
                    OR: [
                        { title: { contains: searchTerm, mode: 'insensitive' } },
                        { content: { contains: searchTerm, mode: 'insensitive' } }
                    ],
                    publicationStatus: 'PUBLIC',
                    visibility: 'PUBLIC'
                }
            })
        ]);
        results.posts = posts;
        total += postsCount;
    }
    if (type === 'all' || type === 'users') {
        const [users, usersCount] = await Promise.all([
            index_1.prisma.user.findMany({
                where: {
                    OR: [
                        { name: { contains: searchTerm, mode: 'insensitive' } },
                        { username: { contains: searchTerm, mode: 'insensitive' } },
                        { bio: { contains: searchTerm, mode: 'insensitive' } }
                    ]
                },
                select: {
                    id: true,
                    name: true,
                    username: true,
                    avatar: true,
                    bio: true,
                    _count: {
                        select: {
                            posts: true,
                            followers: true,
                            following: true
                        }
                    }
                },
                skip: offset,
                take: Number(limit),
                orderBy: { name: 'asc' }
            }),
            index_1.prisma.user.count({
                where: {
                    OR: [
                        { name: { contains: searchTerm, mode: 'insensitive' } },
                        { username: { contains: searchTerm, mode: 'insensitive' } },
                        { bio: { contains: searchTerm, mode: 'insensitive' } }
                    ]
                }
            })
        ]);
        results.users = users;
        total += usersCount;
    }
    if (type === 'all' || type === 'hashtags') {
        const [hashtags, hashtagsCount] = await Promise.all([
            index_1.prisma.hashtag.findMany({
                where: {
                    name: { contains: searchTerm, mode: 'insensitive' }
                },
                include: {
                    _count: {
                        select: {
                            posts: true
                        }
                    }
                },
                skip: offset,
                take: Number(limit),
                orderBy: { name: 'asc' }
            }),
            index_1.prisma.hashtag.count({
                where: {
                    name: { contains: searchTerm, mode: 'insensitive' }
                }
            })
        ]);
        results.hashtags = hashtags;
        total += hashtagsCount;
    }
    if (userId) {
        await index_1.prisma.searchHistory.create({
            data: {
                query: searchTerm,
                userId
            }
        });
    }
    res.json({
        success: true,
        data: {
            results,
            query: searchTerm,
            type,
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
router.get('/suggestions', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { q: query } = req.query;
    if (!query || typeof query !== 'string') {
        res.json({
            success: true,
            data: { suggestions: [] }
        });
        return;
    }
    const searchTerm = query.toLowerCase();
    const [users, hashtags] = await Promise.all([
        index_1.prisma.user.findMany({
            where: {
                OR: [
                    { name: { contains: searchTerm, mode: 'insensitive' } },
                    { username: { contains: searchTerm, mode: 'insensitive' } }
                ]
            },
            select: {
                id: true,
                name: true,
                username: true,
                avatar: true
            },
            take: 5,
            orderBy: { name: 'asc' }
        }),
        index_1.prisma.hashtag.findMany({
            where: {
                name: { contains: searchTerm, mode: 'insensitive' }
            },
            take: 5,
            orderBy: { name: 'asc' }
        })
    ]);
    const suggestions = [
        ...users.map(user => ({ type: 'user', ...user })),
        ...hashtags.map(tag => ({ type: 'hashtag', ...tag }))
    ];
    res.json({
        success: true,
        data: { suggestions }
    });
}));
exports.default = router;
//# sourceMappingURL=search.js.map