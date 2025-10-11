import { Router, Request, Response } from 'express'
import multer from 'multer'
import { prisma } from '@/db'
import { asyncHandler } from '@/middleware/errorHandler'
import { authMiddleware } from '@/middleware/auth'
import { AuthenticatedRequest } from '@/types'

const router = Router()

// Get all users (for messaging)
router.get('/', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const currentUserId = req.user?.id
  
  if (!currentUserId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  const users = await prisma.user.findMany({
    where: {
      id: { not: currentUserId } // Exclude current user
    },
    select: {
      id: true,
      name: true,
      username: true,
      avatar: true,
      isPrivate: true
    },
    orderBy: {
      name: 'asc'
    }
  })

  res.json(users)
}))

// Configure multer for avatar uploads
const storage = multer.memoryStorage()
const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Only image files are allowed'))
    }
  }
})

// Update user profile
router.put('/profile', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { name, username, bio, location, website, isPrivate } = req.body

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
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
      res.status(409).json({
        success: false,
        error: 'Username already taken'
      })
      return
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

// Upload avatar
router.post('/avatar', authMiddleware, upload.single('avatar'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  
  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  if (!req.file) {
    res.status(400).json({
      success: false,
      error: 'No avatar file provided'
    })
    return
  }

  try {
    // Import sharp for image processing
    const sharp = require('sharp')
    
    // Process the image to 180x180 with proper scaling
    const processedBuffer = await sharp(req.file.buffer)
      .resize(180, 180, {
        fit: 'cover', // Crop to cover the 180x180 area
        position: 'center' // Center the crop
      })
      .jpeg({ 
        quality: 85,
        progressive: true
      })
      .toBuffer()

    // Convert processed image to base64
    const base64Data = processedBuffer.toString('base64')
    const dataUrl = `data:image/jpeg;base64,${base64Data}`

    const updatedUser = await prisma.user.update({
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
    })

    res.json({
      success: true,
      data: { user: updatedUser },
      message: 'Avatar uploaded successfully'
    })
  } catch (error) {
    console.error('Error processing avatar:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to process avatar image'
    })
  }
}))

// Get user profile by ID or username
router.get('/:identifier', asyncHandler(async (req: Request, res: Response) => {
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
    res.status(404).json({
      success: false,
      error: 'User not found'
    })
    return
  }

  res.json({
    success: true,
    data: { user }
  })
}))

// Get public user profile by ID or username (no authentication required)
router.get('/:identifier/public', asyncHandler(async (req: Request, res: Response) => {
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
      username: true,
      avatar: true,
      bio: true,
      location: true,
      website: true,
      isVerified: true,
      createdAt: true,
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
    res.status(404).json({
      success: false,
      error: 'User not found'
    })
    return
  }

  res.json({
    success: true,
    data: { user }
  })
}))

// Follow a user
router.post('/:userId/follow', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const followerId = req.user?.id
  const { userId } = req.params

  if (!followerId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  if (followerId === userId) {
    res.status(400).json({
      success: false,
      error: 'Cannot follow yourself'
    })
    return
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
    res.status(409).json({
      success: false,
      error: 'Already following this user'
    })
    return
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
router.delete('/:userId/follow', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const followerId = req.user?.id
  const { userId } = req.params

  if (!followerId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
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
router.get('/:userId/followers', asyncHandler(async (req: Request, res: Response) => {
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
router.get('/:userId/following', asyncHandler(async (req: Request, res: Response) => {
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