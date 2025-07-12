import { Router, Request, Response } from 'express'
import { prisma } from '@/index'
import { asyncHandler } from '@/middleware/errorHandler'
import { authMiddleware } from '@/middleware/auth'
import { AuthenticatedRequest } from '@/types'

const router = Router()

// Get user's images by user ID (flat list)
router.get('/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params
  const { page = 1, limit = 20 } = req.query
  const offset = (Number(page) - 1) * Number(limit)

  const [images, total] = await Promise.all([
    prisma.image.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: Number(limit),
    }),
    prisma.image.count({ where: { authorId: userId } })
  ])

  res.json({
    success: true,
    data: {
      images,
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

// Get user's galleries (alternative route)
router.get('/user/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params
  const { page = 1, limit = 20 } = req.query
  const offset = (Number(page) - 1) * Number(limit)

  const [galleries, total] = await Promise.all([
    prisma.gallery.findMany({
      where: { authorId: userId },
      include: {
        _count: {
          select: {
            images: true
          }
        }
      },
      skip: offset,
      take: Number(limit),
      orderBy: { createdAt: 'desc' }
    }),
    prisma.gallery.count({
      where: { authorId: userId }
    })
  ])

  res.json({
    success: true,
    data: {
      galleries,
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

// Create a gallery
router.post('/', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { name, description, isPrivate } = req.body

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  const gallery = await prisma.gallery.create({
    data: {
      name,
      description,
      isPrivate: isPrivate || false,
      authorId: userId
    }
  })

  res.status(201).json({
    success: true,
    data: { gallery },
    message: 'Gallery created successfully'
  })
}))

// Get gallery by ID
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params

  const gallery = await prisma.gallery.findUnique({
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
      images: {
        orderBy: { createdAt: 'desc' }
      }
    }
  })

  if (!gallery) {
    res.status(404).json({
      success: false,
      error: 'Gallery not found'
    })
    return
  }

  res.json({
    success: true,
    data: { gallery }
  })
}))

// Update gallery
router.put('/:id', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { id } = req.params
  const { name, description, isPrivate } = req.body

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  const gallery = await prisma.gallery.findUnique({
    where: { id }
  })

  if (!gallery) {
    res.status(404).json({
      success: false,
      error: 'Gallery not found'
    })
    return
  }

  if (gallery.authorId !== userId) {
    res.status(403).json({
      success: false,
      error: 'Not authorized to update this gallery'
    })
    return
  }

  const updatedGallery = await prisma.gallery.update({
    where: { id },
    data: {
      name,
      description,
      isPrivate
    }
  })

  res.json({
    success: true,
    data: { gallery: updatedGallery },
    message: 'Gallery updated successfully'
  })
}))

// Delete gallery
router.delete('/:id', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { id } = req.params

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  const gallery = await prisma.gallery.findUnique({
    where: { id }
  })

  if (!gallery) {
    res.status(404).json({
      success: false,
      error: 'Gallery not found'
    })
    return
  }

  if (gallery.authorId !== userId) {
    res.status(403).json({
      success: false,
      error: 'Not authorized to delete this gallery'
    })
    return
  }

  await prisma.gallery.delete({
    where: { id }
  })

  res.json({
    success: true,
    message: 'Gallery deleted successfully'
  })
}))

export default router 