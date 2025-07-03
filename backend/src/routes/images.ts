import { Router } from 'express'
import multer from 'multer'
import { prisma } from '@/index'
import { asyncHandler } from '@/middleware/errorHandler'
import { authMiddleware } from '@/middleware/auth'
import { AuthenticatedRequest } from '@/types'

const router = Router()

// Configure multer for file uploads
const storage = multer.memoryStorage()
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Only image files are allowed'))
    }
  }
})

// Get user's images
router.get('/user/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params
  const { page = 1, limit = 20 } = req.query
  const offset = (Number(page) - 1) * Number(limit)

  const [images, total] = await Promise.all([
    prisma.image.findMany({
      where: { authorId: userId },
      skip: offset,
      take: Number(limit),
      orderBy: { createdAt: 'desc' }
    }),
    prisma.image.count({
      where: { authorId: userId }
    })
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

// Upload an image (alternative route)
router.post('/upload', authMiddleware, upload.single('image'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
  }

  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No image file provided'
    })
  }

  // For now, we'll store the file data as a base64 string
  // In production, you'd want to upload to a cloud storage service
  const base64Data = req.file.buffer.toString('base64')
  const dataUrl = `data:${req.file.mimetype};base64,${base64Data}`

  const image = await prisma.image.create({
    data: {
      url: dataUrl,
      altText: req.body.title || req.body.altText || 'Uploaded image',
      caption: req.body.description || req.body.caption || '',
      authorId: userId
    }
  })

  res.status(201).json({
    success: true,
    data: { image },
    message: 'Image uploaded successfully'
  })
}))

// Upload an image (main route)
router.post('/', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id
  const { url, altText, caption, postId, galleryId } = req.body

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
  }

  const image = await prisma.image.create({
    data: {
      url,
      altText,
      caption,
      postId,
      galleryId,
      authorId: userId
    }
  })

  res.status(201).json({
    success: true,
    data: { image },
    message: 'Image uploaded successfully'
  })
}))

// Delete an image
router.delete('/:id', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id
  const { id } = req.params

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
  }

  const image = await prisma.image.findUnique({
    where: { id }
  })

  if (!image) {
    return res.status(404).json({
      success: false,
      error: 'Image not found'
    })
  }

  if (image.authorId !== userId) {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to delete this image'
    })
  }

  await prisma.image.delete({
    where: { id }
  })

  res.json({
    success: true,
    message: 'Image deleted successfully'
  })
}))

export default router 