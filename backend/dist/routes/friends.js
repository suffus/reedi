"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("@/index");
const errorHandler_1 = require("@/middleware/errorHandler");
const auth_1 = require("@/middleware/auth");
const router = (0, express_1.Router)();
router.post('/request/:userId', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const senderId = req.user?.id;
    const { userId } = req.params;
    if (!senderId) {
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
    }
    if (senderId === userId) {
        res.status(400).json({
            success: false,
            error: 'Cannot send friend request to yourself'
        });
        return;
    }
    const targetUser = await index_1.prisma.user.findUnique({
        where: { id: userId }
    });
    if (!targetUser) {
        res.status(404).json({
            success: false,
            error: 'User not found'
        });
        return;
    }
    const existingRequest = await index_1.prisma.friendRequest.findUnique({
        where: {
            senderId_receiverId: {
                senderId,
                receiverId: userId
            }
        }
    });
    if (existingRequest) {
        res.status(409).json({
            success: false,
            error: 'Friend request already sent'
        });
        return;
    }
    const reverseRequest = await index_1.prisma.friendRequest.findUnique({
        where: {
            senderId_receiverId: {
                senderId: userId,
                receiverId: senderId
            }
        }
    });
    if (reverseRequest) {
        res.status(409).json({
            success: false,
            error: 'Friend request already exists from this user'
        });
        return;
    }
    const friendRequest = await index_1.prisma.friendRequest.create({
        data: {
            senderId,
            receiverId: userId
        },
        include: {
            sender: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                    avatar: true
                }
            },
            receiver: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                    avatar: true
                }
            }
        }
    });
    await index_1.prisma.notification.create({
        data: {
            type: 'FRIEND_REQUEST',
            title: 'New Friend Request',
            message: `${friendRequest.sender.name} sent you a friend request`,
            userId: userId
        }
    });
    res.status(201).json({
        success: true,
        data: { friendRequest },
        message: 'Friend request sent successfully'
    });
}));
router.get('/requests/received', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { page = 1, limit = 20 } = req.query;
    if (!userId) {
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
    }
    const offset = (Number(page) - 1) * Number(limit);
    const [requests, total] = await Promise.all([
        index_1.prisma.friendRequest.findMany({
            where: {
                receiverId: userId,
                status: 'PENDING'
            },
            include: {
                sender: {
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
        index_1.prisma.friendRequest.count({
            where: {
                receiverId: userId,
                status: 'PENDING'
            }
        })
    ]);
    res.json({
        success: true,
        data: {
            requests,
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
router.get('/requests/sent', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { page = 1, limit = 20 } = req.query;
    if (!userId) {
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
    }
    const offset = (Number(page) - 1) * Number(limit);
    const [requests, total] = await Promise.all([
        index_1.prisma.friendRequest.findMany({
            where: {
                senderId: userId,
                status: 'PENDING'
            },
            include: {
                receiver: {
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
        index_1.prisma.friendRequest.count({
            where: {
                senderId: userId,
                status: 'PENDING'
            }
        })
    ]);
    res.json({
        success: true,
        data: {
            requests,
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
router.put('/accept/:requestId', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { requestId } = req.params;
    if (!userId) {
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
    }
    const friendRequest = await index_1.prisma.friendRequest.findUnique({
        where: { id: requestId },
        include: {
            sender: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                    avatar: true
                }
            },
            receiver: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                    avatar: true
                }
            }
        }
    });
    if (!friendRequest) {
        res.status(404).json({
            success: false,
            error: 'Friend request not found'
        });
        return;
    }
    if (friendRequest.receiverId !== userId) {
        res.status(403).json({
            success: false,
            error: 'Not authorized to accept this request'
        });
        return;
    }
    if (friendRequest.status !== 'PENDING') {
        res.status(400).json({
            success: false,
            error: 'Friend request is not pending'
        });
        return;
    }
    const updatedRequest = await index_1.prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: 'ACCEPTED' },
        include: {
            sender: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                    avatar: true
                }
            },
            receiver: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                    avatar: true
                }
            }
        }
    });
    await index_1.prisma.notification.create({
        data: {
            type: 'FRIEND_REQUEST_ACCEPTED',
            title: 'Friend Request Accepted',
            message: `${friendRequest.receiver.name} accepted your friend request`,
            userId: friendRequest.senderId
        }
    });
    res.json({
        success: true,
        data: { friendRequest: updatedRequest },
        message: 'Friend request accepted successfully'
    });
}));
router.put('/reject/:requestId', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { requestId } = req.params;
    if (!userId) {
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
    }
    const friendRequest = await index_1.prisma.friendRequest.findUnique({
        where: { id: requestId }
    });
    if (!friendRequest) {
        res.status(404).json({
            success: false,
            error: 'Friend request not found'
        });
        return;
    }
    if (friendRequest.receiverId !== userId) {
        res.status(403).json({
            success: false,
            error: 'Not authorized to reject this request'
        });
        return;
    }
    if (friendRequest.status !== 'PENDING') {
        res.status(400).json({
            success: false,
            error: 'Friend request is not pending'
        });
        return;
    }
    await index_1.prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: 'REJECTED' }
    });
    res.json({
        success: true,
        message: 'Friend request rejected successfully'
    });
}));
router.delete('/cancel/:requestId', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { requestId } = req.params;
    if (!userId) {
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
    }
    const friendRequest = await index_1.prisma.friendRequest.findUnique({
        where: { id: requestId }
    });
    if (!friendRequest) {
        res.status(404).json({
            success: false,
            error: 'Friend request not found'
        });
        return;
    }
    if (friendRequest.senderId !== userId) {
        res.status(403).json({
            success: false,
            error: 'Not authorized to cancel this request'
        });
        return;
    }
    if (friendRequest.status !== 'PENDING') {
        res.status(400).json({
            success: false,
            error: 'Friend request is not pending'
        });
        return;
    }
    await index_1.prisma.friendRequest.delete({
        where: { id: requestId }
    });
    res.json({
        success: true,
        message: 'Friend request cancelled successfully'
    });
}));
router.get('/status/:userId', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const currentUserId = req.user?.id;
    const { userId } = req.params;
    if (!currentUserId) {
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
    }
    if (currentUserId === userId) {
        res.json({
            success: true,
            data: { status: 'SELF' }
        });
        return;
    }
    const friendRequest = await index_1.prisma.friendRequest.findFirst({
        where: {
            OR: [
                { senderId: currentUserId, receiverId: userId },
                { senderId: userId, receiverId: currentUserId }
            ]
        }
    });
    if (!friendRequest) {
        res.json({
            success: true,
            data: { status: 'NONE' }
        });
        return;
    }
    if (friendRequest.status === 'PENDING') {
        const status = friendRequest.senderId === currentUserId ? 'REQUEST_SENT' : 'REQUEST_RECEIVED';
        res.json({
            success: true,
            data: { status, requestId: friendRequest.id }
        });
        return;
    }
    if (friendRequest.status === 'ACCEPTED') {
        res.json({
            success: true,
            data: { status: 'FRIENDS' }
        });
        return;
    }
    if (friendRequest.status === 'REJECTED') {
        res.json({
            success: true,
            data: { status: 'REJECTED' }
        });
        return;
    }
    res.json({
        success: true,
        data: { status: 'NONE' }
    });
}));
router.get('/:userId/friends', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const [friends, total] = await Promise.all([
        index_1.prisma.friendRequest.findMany({
            where: {
                OR: [
                    { senderId: userId, status: 'ACCEPTED' },
                    { receiverId: userId, status: 'ACCEPTED' }
                ]
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        avatar: true,
                        bio: true
                    }
                },
                receiver: {
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
            orderBy: { updatedAt: 'desc' }
        }),
        index_1.prisma.friendRequest.count({
            where: {
                OR: [
                    { senderId: userId, status: 'ACCEPTED' },
                    { receiverId: userId, status: 'ACCEPTED' }
                ]
            }
        })
    ]);
    const friendsList = friends.map(request => {
        if (request.senderId === userId) {
            return request.receiver;
        }
        else {
            return request.sender;
        }
    });
    res.json({
        success: true,
        data: {
            friends: friendsList,
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
//# sourceMappingURL=friends.js.map