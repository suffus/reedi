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
        fileSize: 5 * 1024 * 1024,
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
router.put('/profile', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { name, username, bio, location, website, isPrivate } = req.body;
    if (!userId) {
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
    }
    if (username) {
        const existingUser = await index_1.prisma.user.findFirst({
            where: {
                username,
                id: { not: userId }
            }
        });
        if (existingUser) {
            res.status(409).json({
                success: false,
                error: 'Username already taken'
            });
            return;
        }
    }
    const updatedUser = await index_1.prisma.user.update({
        where: { id: userId },
        data: {
            name,
            username,
            bio,
            location,
            website,
            isPrivate
        },
        select: {
            id: true,
            name: true,
            email: true,
            username: true,
            avatar: true,
            bio: true,
            location: true,
            website: true,
            isPrivate: true,
            isVerified: true,
            createdAt: true,
            updatedAt: true
        }
    });
    res.json({
        success: true,
        data: { user: updatedUser },
        message: 'Profile updated successfully'
    });
}));
router.post('/avatar', auth_1.authMiddleware, upload.single('avatar'), (0, errorHandler_1.asyncHandler)(async (req, res) => {
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
            error: 'No avatar file provided'
        });
        return;
    }
    const base64Data = req.file.buffer.toString('base64');
    const dataUrl = `data:${req.file.mimetype};base64,${base64Data}`;
    const updatedUser = await index_1.prisma.user.update({
        where: { id: userId },
        data: {
            avatar: dataUrl
        },
        select: {
            id: true,
            name: true,
            email: true,
            username: true,
            avatar: true,
            bio: true,
            location: true,
            website: true,
            isPrivate: true,
            isVerified: true,
            createdAt: true,
            updatedAt: true
        }
    });
    res.json({
        success: true,
        data: { user: updatedUser },
        message: 'Avatar uploaded successfully'
    });
}));
router.get('/:identifier', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { identifier } = req.params;
    const user = await index_1.prisma.user.findFirst({
        where: {
            OR: [
                { id: identifier },
                { username: identifier }
            ]
        },
        select: {
            id: true,
            name: true,
            email: true,
            username: true,
            avatar: true,
            bio: true,
            location: true,
            website: true,
            isPrivate: true,
            isVerified: true,
            createdAt: true,
            updatedAt: true,
            _count: {
                select: {
                    posts: true,
                    followers: true,
                    following: true
                }
            }
        }
    });
    if (!user) {
        res.status(404).json({
            success: false,
            error: 'User not found'
        });
        return;
    }
    res.json({
        success: true,
        data: { user }
    });
}));
router.post('/:userId/follow', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const followerId = req.user?.id;
    const { userId } = req.params;
    if (!followerId) {
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
    }
    if (followerId === userId) {
        res.status(400).json({
            success: false,
            error: 'Cannot follow yourself'
        });
        return;
    }
    const existingFollow = await index_1.prisma.follows.findUnique({
        where: {
            followerId_followingId: {
                followerId,
                followingId: userId
            }
        }
    });
    if (existingFollow) {
        res.status(409).json({
            success: false,
            error: 'Already following this user'
        });
        return;
    }
    await index_1.prisma.follows.create({
        data: {
            followerId,
            followingId: userId
        }
    });
    res.json({
        success: true,
        message: 'User followed successfully'
    });
}));
router.delete('/:userId/follow', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const followerId = req.user?.id;
    const { userId } = req.params;
    if (!followerId) {
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
    }
    await index_1.prisma.follows.deleteMany({
        where: {
            followerId,
            followingId: userId
        }
    });
    res.json({
        success: true,
        message: 'User unfollowed successfully'
    });
}));
router.get('/:userId/followers', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const [followers, total] = await Promise.all([
        index_1.prisma.follows.findMany({
            where: { followingId: userId },
            include: {
                follower: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        avatar: true,
                        bio: true
                    }
                }
            },
            skip: offset,
            take: Number(limit),
            orderBy: { createdAt: 'desc' }
        }),
        index_1.prisma.follows.count({
            where: { followingId: userId }
        })
    ]);
    res.json({
        success: true,
        data: {
            followers: followers.map(f => f.follower),
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
router.get('/:userId/following', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const [following, total] = await Promise.all([
        index_1.prisma.follows.findMany({
            where: { followerId: userId },
            include: {
                following: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        avatar: true,
                        bio: true
                    }
                }
            },
            skip: offset,
            take: Number(limit),
            orderBy: { createdAt: 'desc' }
        }),
        index_1.prisma.follows.count({
            where: { followerId: userId }
        })
    ]);
    res.json({
        success: true,
        data: {
            following: following.map(f => f.following),
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
//# sourceMappingURL=users.js.map