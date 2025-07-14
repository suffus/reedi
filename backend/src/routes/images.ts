import { Router, Request, Response } from 'express'
import multer from 'multer'
import { prisma } from '@/index'
import { asyncHandler } from '@/middleware/errorHandler'
import { authMiddleware } from '@/middleware/auth'
import { AuthenticatedRequest } from '@/types'
import { processImage, deleteImageFiles } from '@/utils/imageProcessor'
import { generatePresignedUrl, getImageFromS3 } from '@/utils/s3Service'

const router = Router()

// Configure multer for file uploads
const storage = multer.memoryStorage()
const upload = multer({ 
  storage,
  limits: {
    fileSize: 40 * 1024 * 1024, // 10MB limit
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
router.get('/user/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params
  const { page = 1, limit = 20 } = req.query
  const offset = (Number(page) - 1) * Number(limit)

  const [images, total] = await Promise.all([
    prisma.image.findMany({
      where: { authorId: userId },
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
        createdAt: true,
        updatedAt: true,
        authorId: true
      }
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

// Get a single image by ID
router.get('/:id', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { id } = req.params

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  const image = await prisma.image.findUnique({
    where: { id },
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
      createdAt: true,
      updatedAt: true,
      authorId: true
    }
  })

  if (!image) {
    res.status(404).json({
      success: false,
      error: 'Image not found'
    })
    return
  }

  res.json({
    success: true,
    data: { image }
  })
}))

// Upload an image (alternative route)
router.post('/upload', authMiddleware, upload.single('image'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  console.log('Upload request received for user:', req.user?.id)
  console.log('Form data:', req.body)
  console.log('File:', req.file ? { filename: req.file.originalname, size: req.file.size, mimetype: req.file.mimetype } : 'No file')
  
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
      error: 'No image file provided'
    })
    return
  }

  // Process image and generate thumbnail
  const processedImage = await processImage(
    req.file.buffer,
    req.file.originalname,
    req.file.mimetype,
    userId
  )

  // Parse tags from form data
  let tags: string[] = []
  if (req.body.tags) {
    try {
      tags = JSON.parse(req.body.tags)
    } catch (error) {
      console.warn('Failed to parse tags:', error)
    }
  }

  const image = await prisma.image.create({
    data: {
      url: processedImage.imagePath,
      thumbnail: processedImage.thumbnailPath,
      s3Key: processedImage.s3Key,
      thumbnailS3Key: processedImage.thumbnailS3Key,
      altText: req.body.title || req.body.altText || 'Uploaded image',
      caption: req.body.description || req.body.caption || '',
      tags: tags,
      width: processedImage.width,
      height: processedImage.height,
      size: processedImage.size,
      mimeType: req.file.mimetype,
      authorId: userId
    }
  })

  console.log('Image created successfully:', { 
    id: image.id, 
    title: image.altText, 
    authorId: image.authorId,
    imagePath: processedImage.imagePath,
    thumbnailPath: processedImage.thumbnailPath
  })

  res.status(201).json({
    success: true,
    data: { image },
    message: 'Image uploaded successfully'
  })
}))

// Upload an image (main route)
router.post('/', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { url, altText, caption, postId, galleryId } = req.body

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
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

// Update an image
router.put('/:id', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { id } = req.params
  const { altText, caption, title, description, tags } = req.body

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  const image = await prisma.image.findUnique({
    where: { id }
  })

  if (!image) {
    res.status(404).json({
      success: false,
      error: 'Image not found'
    })
    return
  }

  if (image.authorId !== userId) {
    res.status(403).json({
      success: false,
      error: 'Not authorized to update this image'
    })
    return
  }

  // Support both old (altText/caption) and new (title/description) field names
  const newAltText = title || altText || null
  const newCaption = description || caption || null

  // Update the image
  const updatedImage = await prisma.image.update({
    where: { id },
    data: {
      altText: newAltText,
      caption: newCaption,
      tags: tags || undefined
    }
  })

  res.json({
    success: true,
    data: { image: updatedImage },
    message: 'Image updated successfully'
  })
}))

// Delete an image
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

  const image = await prisma.image.findUnique({
    where: { id },
    select: {
      id: true,
      url: true,
      thumbnail: true,
      s3Key: true,
      thumbnailS3Key: true,
      authorId: true
    }
  })

  if (!image) {
    res.status(404).json({
      success: false,
      error: 'Image not found'
    })
    return
  }

  if (image.authorId !== userId) {
    res.status(403).json({
      success: false,
      error: 'Not authorized to delete this image'
    })
    return
  }

  // Delete the image files from S3
  if (image.s3Key) {
    await deleteImageFiles(image.s3Key, image.thumbnailS3Key || undefined)
  }

  // Delete from database
  await prisma.image.delete({
    where: { id }
  })

  res.json({
    success: true,
    message: 'Image deleted successfully'
  })
}))

export default router 