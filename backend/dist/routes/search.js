"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("@/index");
const errorHandler_1 = require("@/middleware/errorHandler");
const auth_1 = require("@/middleware/auth");
const router = (0, express_1.Router)();
router.get('/', auth_1.optionalAuthMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { q: query, type = 'all', page = 1, limit = 20 } = req.query;
    const userId = req.user?.id;
    if (!query || typeof query !== 'string') {
        return res.status(400).json({
            success: false,
            error: 'Search query is required'
        });
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
                    isPublished: true,
                    isPrivate: false
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
        return res.json({
            success: true,
            data: { suggestions: [] }
        });
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