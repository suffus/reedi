import { Router, Request, Response } from 'express'
import { prisma } from '@/db'
import { asyncHandler } from '@/middleware/errorHandler'
import { authMiddleware, optionalAuthMiddleware } from '@/middleware/auth'
import { AuthenticatedRequest } from '@/types'
import { getAuthContext } from '@/middleware/authContext'
import {
  canSendFriendRequest,
  canViewReceivedRequests,
  canViewSentRequests,
  canAcceptFriendRequest,
  canRejectFriendRequest,
  canCancelFriendRequest,
  canViewFriendshipStatus,
  canViewFriendsList
} from '@/auth/friends'
import { safePermissionCheck, auditPermission } from '@/lib/permissions'

const router = Router()

// Send a friend request
router.post('/request/:userId', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const auth = getAuthContext(req)
  const senderId = req.user?.id
  const { userId } = req.params

  if (!senderId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  // Check permission to send friend request
  const canSend = await safePermissionCheck(
    () => canSendFriendRequest(auth, userId),
    'friend-request-send'
  )

  if (!canSend.granted) {
    res.status(403).json({
      success: false,
      error: canSend.reason
    })
    return
  }

  // Check if user exists
  const targetUser = await prisma.user.findUnique({
    where: { id: userId }
  })

  if (!targetUser) {
    res.status(404).json({
      success: false,
      error: 'User not found'
    })
    return
  }

  // Check if friend request already exists
  const existingRequest = await prisma.friendRequest.findUnique({
    where: {
      senderId_receiverId: {
        senderId,
        receiverId: userId
      }
    }
  })

  if (existingRequest) {
    res.status(409).json({
      success: false,
      error: 'Friend request already sent'
    })
    return
  }

  // Check if reverse request exists
  const reverseRequest = await prisma.friendRequest.findUnique({
    where: {
      senderId_receiverId: {
        senderId: userId,
        receiverId: senderId
      }
    }
  })

  if (reverseRequest) {
    res.status(409).json({
      success: false,
      error: 'Friend request already exists from this user'
    })
    return
  }

  // Create friend request
  const friendRequest = await prisma.friendRequest.create({
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
  })

  // Create notification for receiver
  await prisma.notification.create({
    data: {
      type: 'FRIEND_REQUEST',
      title: 'New Friend Request',
      message: `${friendRequest.sender.name} sent you a friend request`,
      userId: userId
    }
  })

  res.status(201).json({
    success: true,
    data: { friendRequest },
    message: 'Friend request sent successfully'
  })
}))

// Get user's friend requests (received) - MUST come before /:userId/friends
router.get('/requests/received', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const auth = getAuthContext(req)
  const userId = req.user?.id
  const { page = 1, limit = 20 } = req.query

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  // Check permission to view received requests
  const canView = await safePermissionCheck(
    () => canViewReceivedRequests(auth),
    'friend-requests-received'
  )

  if (!canView.granted) {
    res.status(403).json({
      success: false,
      error: canView.reason
    })
    return
  }

  const offset = (Number(page) - 1) * Number(limit)

  const [requests, total] = await Promise.all([
    prisma.friendRequest.findMany({
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
    prisma.friendRequest.count({
      where: {
        receiverId: userId,
        status: 'PENDING'
      }
    })
  ])

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
  })
}))

// Get user's friend requests (sent) - MUST come before /:userId/friends
router.get('/requests/sent', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const auth = getAuthContext(req)
  const userId = req.user?.id
  const { page = 1, limit = 20 } = req.query

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  // Check permission to view sent requests
  const canView = await safePermissionCheck(
    () => canViewSentRequests(auth),
    'friend-requests-sent'
  )

  if (!canView.granted) {
    res.status(403).json({
      success: false,
      error: canView.reason
    })
    return
  }

  const offset = (Number(page) - 1) * Number(limit)

  const [requests, total] = await Promise.all([
    prisma.friendRequest.findMany({
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
    prisma.friendRequest.count({
      where: {
        senderId: userId,
        status: 'PENDING'
      }
    })
  ])

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
  })
}))

// Accept a friend request - MUST come before /:userId/friends
router.put('/accept/:requestId', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const auth = getAuthContext(req)
  const userId = req.user?.id
  const { requestId } = req.params

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  // Find the friend request
  const friendRequest = await prisma.friendRequest.findUnique({
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
  })

  if (!friendRequest) {
    res.status(404).json({
      success: false,
      error: 'Friend request not found'
    })
    return
  }

  // Check permission to accept
  const canAccept = await safePermissionCheck(
    () => canAcceptFriendRequest(auth, friendRequest as any),
    'friend-request-accept'
  )

  if (!canAccept.granted) {
    res.status(403).json({
      success: false,
      error: canAccept.reason
    })
    return
  }

  if (friendRequest.status !== 'PENDING') {
    res.status(400).json({
      success: false,
      error: 'Friend request is not pending'
    })
    return
  }

  // Update friend request status to accepted
  const updatedRequest = await prisma.friendRequest.update({
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
  })

  // Create notification for sender
  await prisma.notification.create({
    data: {
      type: 'FRIEND_REQUEST_ACCEPTED',
      title: 'Friend Request Accepted',
      message: `${friendRequest.receiver.name} accepted your friend request`,
      userId: friendRequest.senderId
    }
  })

  res.json({
    success: true,
    data: { friendRequest: updatedRequest },
    message: 'Friend request accepted successfully'
  })
}))

// Reject a friend request - MUST come before /:userId/friends
router.put('/reject/:requestId', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const auth = getAuthContext(req)
  const userId = req.user?.id
  const { requestId } = req.params

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  // Find the friend request
  const friendRequest = await prisma.friendRequest.findUnique({
    where: { id: requestId }
  })

  if (!friendRequest) {
    res.status(404).json({
      success: false,
      error: 'Friend request not found'
    })
    return
  }

  // Check permission to reject
  const canReject = await safePermissionCheck(
    () => canRejectFriendRequest(auth, friendRequest as any),
    'friend-request-reject'
  )

  if (!canReject.granted) {
    res.status(403).json({
      success: false,
      error: canReject.reason
    })
    return
  }

  if (friendRequest.status !== 'PENDING') {
    res.status(400).json({
      success: false,
      error: 'Friend request is not pending'
    })
    return
  }

  // Update friend request status to rejected
  await prisma.friendRequest.update({
    where: { id: requestId },
    data: { status: 'REJECTED' }
  })

  res.json({
    success: true,
    message: 'Friend request rejected successfully'
  })
}))

// Cancel a friend request - MUST come before /:userId/friends
router.delete('/cancel/:requestId', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const auth = getAuthContext(req)
  const userId = req.user?.id
  const { requestId } = req.params

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  // Find the friend request
  const friendRequest = await prisma.friendRequest.findUnique({
    where: { id: requestId }
  })

  if (!friendRequest) {
    res.status(404).json({
      success: false,
      error: 'Friend request not found'
    })
    return
  }

  // Check permission to cancel
  const canCancel = await safePermissionCheck(
    () => canCancelFriendRequest(auth, friendRequest as any),
    'friend-request-cancel'
  )

  if (!canCancel.granted) {
    res.status(403).json({
      success: false,
      error: 'Not authorized to cancel this request'
    })
    return
  }

  if (friendRequest.status !== 'PENDING') {
    res.status(400).json({
      success: false,
      error: 'Friend request is not pending'
    })
    return
  }

  // Delete the friend request
  await prisma.friendRequest.delete({
    where: { id: requestId }
  })

  res.json({
    success: true,
    message: 'Friend request cancelled successfully'
  })
}))

// Check friendship status between two users - MUST come before /:userId/friends
router.get('/status/:userId', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const auth = getAuthContext(req)
  const currentUserId = req.user?.id
  const { userId } = req.params

  if (!currentUserId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  // Check permission to view friendship status
  const canView = await safePermissionCheck(
    () => canViewFriendshipStatus(auth, userId),
    'friendship-status'
  )

  if (!canView.granted) {
    res.status(403).json({
      success: false,
      error: canView.reason
    })
    return
  }

  if (currentUserId === userId) {
    res.json({
      success: true,
      data: { status: 'SELF' }
    })
    return
  }

  // Check for friend request
  const friendRequest = await prisma.friendRequest.findFirst({
    where: {
      OR: [
        { senderId: currentUserId, receiverId: userId },
        { senderId: userId, receiverId: currentUserId }
      ]
    }
  })

  if (!friendRequest) {
    res.json({
      success: true,
      data: { status: 'NONE' }
    })
    return
  }

  if (friendRequest.status === 'PENDING') {
    const status = friendRequest.senderId === currentUserId ? 'REQUEST_SENT' : 'REQUEST_RECEIVED'
    res.json({
      success: true,
      data: { status, requestId: friendRequest.id }
    })
    return
  }

  if (friendRequest.status === 'ACCEPTED') {
    res.json({
      success: true,
      data: { status: 'FRIENDS' }
    })
    return
  }

  if (friendRequest.status === 'REJECTED') {
    res.json({
      success: true,
      data: { status: 'REJECTED' }
    })
    return
  }

  res.json({
    success: true,
    data: { status: 'NONE' }
  })
}))

// Get user's friends - MUST come LAST (most general route)
router.get('/:userId/friends', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const auth = getAuthContext(req)
  const { userId } = req.params
  const { page = 1, limit = 20 } = req.query

  // Check if user exists and get their privacy settings
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isPrivate: true }
  })

  if (!targetUser) {
    res.status(404).json({
      success: false,
      error: 'User not found'
    })
    return
  }

  // Check permission to view friends list
  const canView = await safePermissionCheck(
    () => canViewFriendsList(auth, userId, targetUser.isPrivate),
    'friends-list-view'
  )

  if (!canView.granted) {
    res.status(403).json({
      success: false,
      error: canView.reason
    })
    return
  }

  const offset = (Number(page) - 1) * Number(limit)

  // Get accepted friend requests where user is either sender or receiver
  const [friends, total] = await Promise.all([
    prisma.friendRequest.findMany({
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
    prisma.friendRequest.count({
      where: {
        OR: [
          { senderId: userId, status: 'ACCEPTED' },
          { receiverId: userId, status: 'ACCEPTED' }
        ]
      }
    })
  ])

  // Transform the data to show the friend (not the current user)
  const friendsList = friends.map(request => {
    if (request.senderId === userId) {
      return request.receiver
    } else {
      return request.sender
    }
  })

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
  })
}))

export default router 