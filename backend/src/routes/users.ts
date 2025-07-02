import { Router } from 'express'
import { prisma } from '@/index'
import { asyncHandler } from '@/middleware/errorHandler'
import { authMiddleware } from '@/middleware/auth'
import { AuthenticatedRequest } from '@/types'

const router = Router()

// Update user profile
router.put('/profile', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id
  const { name, username, bio, location, website, isPrivate } = req.body

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
  }

  // Check if username is already taken by another user
  if (username) {
    const existingUser = await prisma.user.findFirst({
      where: {
        username,
        id: { not: userId }
      }
    })

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'Username already taken'
      })
    }
  }

  const updatedUser = await prisma.user.update({
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
  })

  res.json({
    success: true,
    data: { user: updatedUser },
    message: 'Profile updated successfully'
  })
}))

// Get user profile by ID or username
router.get('/:identifier', asyncHandler(async (req, res) => {
  const { identifier } = req.params

  const user = await prisma.user.findFirst({
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
  })

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    })
  }

  res.json({
    success: true,
    data: { user }
  })
}))

// Follow a user
router.post('/:userId/follow', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const followerId = req.user?.id
  const { userId } = req.params

  if (!followerId) {
    return res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
  }

  if (followerId === userId) {
    return res.status(400).json({
      success: false,
      error: 'Cannot follow yourself'
    })
  }

  // Check if already following
  const existingFollow = await prisma.follows.findUnique({
    where: {
      followerId_followingId: {
        followerId,
        followingId: userId
      }
    }
  })

  if (existingFollow) {
    return res.status(409).json({
      success: false,
      error: 'Already following this user'
    })
  }

  // Create follow relationship
  await prisma.follows.create({
    data: {
      followerId,
      followingId: userId
    }
  })

  res.json({
    success: true,
    message: 'User followed successfully'
  })
}))

// Unfollow a user
router.delete('/:userId/follow', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const followerId = req.user?.id
  const { userId } = req.params

  if (!followerId) {
    return res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
  }

  // Delete follow relationship
  await prisma.follows.deleteMany({
    where: {
      followerId,
      followingId: userId
    }
  })

  res.json({
    success: true,
    message: 'User unfollowed successfully'
  })
}))

// Get user's followers
router.get('/:userId/followers', asyncHandler(async (req, res) => {
  const { userId } = req.params
  const { page = 1, limit = 20 } = req.query

  const offset = (Number(page) - 1) * Number(limit)

  const [followers, total] = await Promise.all([
    prisma.follows.findMany({
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
    prisma.follows.count({
      where: { followingId: userId }
    })
  ])

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
  })
}))

// Get user's following
router.get('/:userId/following', asyncHandler(async (req, res) => {
  const { userId } = req.params
  const { page = 1, limit = 20 } = req.query

  const offset = (Number(page) - 1) * Number(limit)

  const [following, total] = await Promise.all([
    prisma.follows.findMany({
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
    prisma.follows.count({
      where: { followerId: userId }
    })
  ])

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
  })
}))

export default router 