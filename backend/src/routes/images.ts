import { Router, Request, Response } from 'express'
import multer from 'multer'
import { prisma } from '@/index'
import { asyncHandler } from '@/middleware/errorHandler'
import { authMiddleware, optionalAuthMiddleware } from '@/middleware/auth'
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

// Get images for a user's public page, filtered by visibility
router.get('/user/:userId/public', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params
  const viewerId = req.user?.id
  const { page = 1, limit = 20 } = req.query
  const offset = (Number(page) - 1) * Number(limit)

  // Determine which images the viewer can see
  let visibilityFilter: any[] = [
    { visibility: 'PUBLIC' }
  ]

  if (viewerId) {
    if (viewerId === userId) {
      visibilityFilter = [] // Show all
    } else {
      const isFriend = await prisma.friendRequest.findFirst({
        where: {
          OR: [
            { senderId: viewerId, receiverId: userId, status: 'ACCEPTED' },
            { senderId: userId, receiverId: viewerId, status: 'ACCEPTED' }
          ]
        }
      })
      if (isFriend) {
        visibilityFilter.push({ visibility: 'FRIENDS_ONLY' })
      }
    }
  }

  const where: any = {
    authorId: userId,
    ...(visibilityFilter.length > 0 ? { OR: visibilityFilter } : {})
  }

  const [images, total] = await Promise.all([
    prisma.image.findMany({
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
        createdAt: true,
        updatedAt: true,
        authorId: true
      }
    }),
    prisma.image.count({ where })
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

  // Process image and generate thumbnail first
  const processedImage = await processImage(
    req.file!.buffer,
    req.file!.originalname,
    req.file!.mimetype,
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

  // Use transaction to ensure atomicity and proper connection management
  const image = await prisma.$transaction(async (tx) => {
    // Create image record within transaction
    return await tx.image.create({
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
        mimeType: req.file!.mimetype,
        authorId: userId
      }
    })
  }, {
    maxWait: 5000, // 5 seconds max wait for transaction
    timeout: 10000, // 10 seconds timeout
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
  const { altText, caption, title, description, tags, mergeTags } = req.body

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

  // Build update data - only include fields that are provided
  const updateData: any = {}

  // Handle title/altText - only update if provided
  if (title !== undefined) {
    updateData.altText = title
  } else if (altText !== undefined) {
    updateData.altText = altText
  }

  // Handle description/caption - only update if provided
  if (description !== undefined) {
    updateData.caption = description
  } else if (caption !== undefined) {
    updateData.caption = caption
  }

  // Handle tags - merge with existing tags if mergeTags is true
  if (tags !== undefined) {
    if (mergeTags && Array.isArray(tags)) {
      // Merge tags: combine existing tags with new tags, remove duplicates
      const existingTags = image.tags || []
      const newTags = tags.filter(tag => tag && tag.trim().length > 0)
      const mergedTags = [...new Set([...existingTags, ...newTags])]
      updateData.tags = mergedTags
    } else {
      // Replace tags
      updateData.tags = tags
    }
  }

  // Update the image
  const updatedImage = await prisma.image.update({
    where: { id },
    data: updateData
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