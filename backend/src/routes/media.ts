import { Router, Request, Response } from 'express'
import multer from 'multer'
import { prisma } from '@/index'
import { asyncHandler } from '@/middleware/errorHandler'
import { authMiddleware, optionalAuthMiddleware } from '@/middleware/auth'
import { AuthenticatedRequest } from '@/types'
import { processImage, deleteImageFiles } from '@/utils/imageProcessor'
import { generatePresignedUrl, getImageFromS3, uploadToS3 } from '@/utils/s3Service'

const router = Router()

// Configure multer for file uploads (support both images and videos)
const storage = multer.memoryStorage()
const upload = multer({ 
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit for videos
  },
  fileFilter: (req, file, cb) => {
    // Accept both images and videos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true)
    } else {
      cb(new Error('Only image and video files are allowed'))
    }
  }
})

// Get user's media
router.get('/user/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params
  const { page = 1, limit = 20 } = req.query
  const offset = (Number(page) - 1) * Number(limit)

  const [media, total] = await Promise.all([
    prisma.media.findMany({
      where: { authorId: userId },
      skip: offset,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        s3Key: true,
        thumbnailS3Key: true,
        originalFilename: true,
        altText: true,
        caption: true,
        width: true,
        height: true,
        size: true,
        mimeType: true,
        tags: true,
        mediaType: true,
        processingStatus: true,
        duration: true,
        codec: true,
        bitrate: true,
        framerate: true,
        videoUrl: true,
        videoS3Key: true,
        createdAt: true,
        updatedAt: true,
        authorId: true
      }
    }),
    prisma.media.count({
      where: { authorId: userId }
    })
  ])

  res.json({
    success: true,
    data: {
      media,
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

// Get media for a user's public page, filtered by visibility
router.get('/user/:userId/public', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params
  const viewerId = req.user?.id
  const { page = 1, limit = 20 } = req.query
  const offset = (Number(page) - 1) * Number(limit)

  // Determine which media the viewer can see
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

  const [media, total] = await Promise.all([
    prisma.media.findMany({
      where: {
        authorId: userId,
        OR: visibilityFilter
      },
      skip: offset,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        s3Key: true,
        thumbnailS3Key: true,
        originalFilename: true,
        altText: true,
        caption: true,
        width: true,
        height: true,
        size: true,
        mimeType: true,
        tags: true,
        mediaType: true,
        processingStatus: true,
        duration: true,
        codec: true,
        bitrate: true,
        framerate: true,
        videoUrl: true,
        videoS3Key: true,
        createdAt: true,
        updatedAt: true,
        authorId: true
      }
    }),
    prisma.media.count({
      where: {
        authorId: userId,
        OR: visibilityFilter
      }
    })
  ])

  res.json({
    success: true,
    data: {
      media,
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

// Upload media (images and videos)
router.post('/upload', authMiddleware, upload.single('media'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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
      error: 'No media file provided'
    })
    return
  }

  const isVideo = req.file.mimetype.startsWith('video/')
  const mediaType = isVideo ? 'VIDEO' : 'IMAGE'

  // Parse tags from form data
  let tags: string[] = []
  if (req.body.tags) {
    try {
      tags = JSON.parse(req.body.tags)
    } catch (error) {
      console.warn('Failed to parse tags:', error)
    }
  }

  let media

  if (isVideo) {
    // For videos, upload to S3 and set status to PENDING
    const s3Key = await uploadToS3(req.file.buffer, req.file.originalname, req.file.mimetype, userId)
    
    media = await prisma.media.create({
      data: {
        url: s3Key, // Store S3 key for now
        s3Key: s3Key,
        originalFilename: req.file.originalname,
        altText: req.body.title || req.body.altText || 'Uploaded video',
        caption: req.body.description || req.body.caption || '',
        tags: tags,
        size: req.file.size,
        mimeType: req.file.mimetype,
        mediaType: 'VIDEO',
        processingStatus: 'PENDING',
        authorId: userId
      }
    })

    // TODO: Queue video processing job
    // await videoProcessingQueue.add('process-video', {
    //   mediaId: media.id,
    //   s3Key: s3Key,
    //   userId: userId,
    //   originalFilename: req.file.originalname,
    //   mimeType: req.file.mimetype
    // })

  } else {
    // For images, process immediately (existing flow)
    const processedImage = await processImage(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      userId
    )

    media = await prisma.media.create({
      data: {
        url: processedImage.imagePath,
        thumbnail: processedImage.thumbnailPath,
        s3Key: processedImage.s3Key,
        thumbnailS3Key: processedImage.thumbnailS3Key,
        originalFilename: req.file.originalname,
        altText: req.body.title || req.body.altText || 'Uploaded image',
        caption: req.body.description || req.body.caption || '',
        tags: tags,
        width: processedImage.width,
        height: processedImage.height,
        size: processedImage.size,
        mimeType: req.file.mimetype,
        mediaType: 'IMAGE',
        processingStatus: 'COMPLETED',
        authorId: userId
      }
    })
  }

  console.log('Media created successfully:', { 
    id: media.id, 
    title: media.altText, 
    authorId: media.authorId,
    mediaType: media.mediaType,
    processingStatus: media.processingStatus
  })

  res.status(201).json({
    success: true,
    data: { media },
    message: `${mediaType === 'VIDEO' ? 'Video' : 'Image'} uploaded successfully`
  })
}))

// Upload media (main route - for URLs)
router.post('/', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { url, altText, caption, postId, galleryId, mediaType = 'IMAGE' } = req.body

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  const media = await prisma.media.create({
    data: {
      url,
      altText,
      caption,
      postId,
      galleryId,
      mediaType: mediaType as 'IMAGE' | 'VIDEO',
      processingStatus: mediaType === 'VIDEO' ? 'PENDING' : 'COMPLETED',
      authorId: userId
    }
  })

  res.status(201).json({
    success: true,
    data: { media },
    message: 'Media created successfully'
  })
}))

// Get media by ID
router.get('/:id', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const viewerId = req.user?.id

  const media = await prisma.media.findUnique({
    where: { id },
    select: {
      id: true,
      url: true,
      thumbnail: true,
      s3Key: true,
      thumbnailS3Key: true,
      originalFilename: true,
      altText: true,
      caption: true,
      width: true,
      height: true,
      size: true,
      mimeType: true,
      tags: true,
      visibility: true,
      mediaType: true,
      processingStatus: true,
      duration: true,
      codec: true,
      bitrate: true,
      framerate: true,
      videoUrl: true,
      videoS3Key: true,
      createdAt: true,
      updatedAt: true,
      authorId: true,
      author: {
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true
        }
      }
    }
  })

  if (!media) {
    res.status(404).json({
      success: false,
      error: 'Media not found'
    })
    return
  }

  // Check visibility
  if (media.visibility === 'PRIVATE' && viewerId !== media.authorId) {
    res.status(403).json({
      success: false,
      error: 'Access denied'
    })
    return
  }

  if (media.visibility === 'FRIENDS_ONLY' && viewerId !== media.authorId) {
    if (!viewerId) {
      res.status(403).json({
        success: false,
        error: 'Access denied'
      })
      return
    }

    const isFriend = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: viewerId, receiverId: media.authorId, status: 'ACCEPTED' },
          { senderId: media.authorId, receiverId: viewerId, status: 'ACCEPTED' }
        ]
      }
    })

    if (!isFriend) {
      res.status(403).json({
        success: false,
        error: 'Access denied'
      })
      return
    }
  }

  res.json({
    success: true,
    data: { media }
  })
}))

// Update media
router.put('/:id', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const userId = req.user?.id
  const { title, description, altText, caption, tags, visibility } = req.body

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  const media = await prisma.media.findUnique({
    where: { id },
    select: { authorId: true }
  })

  if (!media) {
    res.status(404).json({
      success: false,
      error: 'Media not found'
    })
    return
  }

  if (media.authorId !== userId) {
    res.status(403).json({
      success: false,
      error: 'Not authorized to update this media'
    })
    return
  }

  const updatedMedia = await prisma.media.update({
    where: { id },
    data: {
      altText: title || altText,
      caption: description || caption,
      tags: tags || undefined,
      visibility
    }
  })

  res.json({
    success: true,
    data: { media: updatedMedia },
    message: 'Media updated successfully'
  })
}))

// Delete media
router.delete('/:id', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const userId = req.user?.id

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  const media = await prisma.media.findUnique({
    where: { id },
    select: { 
      authorId: true, 
      s3Key: true, 
      thumbnailS3Key: true,
      videoS3Key: true,
      mediaType: true
    }
  })

  if (!media) {
    res.status(404).json({
      success: false,
      error: 'Media not found'
    })
    return
  }

  if (media.authorId !== userId) {
    res.status(403).json({
      success: false,
      error: 'Not authorized to delete this media'
    })
    return
  }

  // Delete files from S3
  try {
    if (media.mediaType === 'VIDEO') {
      // Delete video files
      if (media.s3Key) {
        await deleteImageFiles(media.s3Key, media.thumbnailS3Key || undefined)
      }
      if (media.videoS3Key) {
        await deleteImageFiles(media.videoS3Key)
      }
    } else {
      // Delete image files
      if (media.s3Key) {
        await deleteImageFiles(media.s3Key, media.thumbnailS3Key || undefined)
      }
    }
  } catch (error) {
    console.error('Error deleting files from S3:', error)
    // Continue with deletion even if S3 deletion fails
  }

  // Delete from database
  await prisma.media.delete({
    where: { id }
  })

  res.json({
    success: true,
    message: 'Media deleted successfully'
  })
}))

// Bulk update media
router.put('/bulk/update', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { mediaIds, updates } = req.body

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  if (!mediaIds || !Array.isArray(mediaIds) || mediaIds.length === 0) {
    res.status(400).json({
      success: false,
      error: 'Media IDs are required'
    })
    return
  }

  // Verify ownership of all media
  const media = await prisma.media.findMany({
    where: {
      id: { in: mediaIds },
      authorId: userId
    },
    select: { id: true }
  })

  if (media.length !== mediaIds.length) {
    res.status(403).json({
      success: false,
      error: 'Not authorized to update some media'
    })
    return
  }

  // Update all media
  const updatePromises = mediaIds.map(id =>
    prisma.media.update({
      where: { id },
      data: updates
    })
  )

  const updatedMedia = await Promise.all(updatePromises)

  res.json({
    success: true,
    data: { media: updatedMedia },
    message: 'Media updated successfully'
  })
}))

// Search media by tags
router.get('/search/tags', asyncHandler(async (req: Request, res: Response) => {
  const { tags, page = 1, limit = 20 } = req.query
  const offset = (Number(page) - 1) * Number(limit)

  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    res.status(400).json({
      success: false,
      error: 'Tags are required'
    })
    return
  }

  const [media, total] = await Promise.all([
    prisma.media.findMany({
      where: {
        tags: {
          hasSome: tags as string[]
        },
        visibility: 'PUBLIC'
      },
      skip: offset,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        s3Key: true,
        thumbnailS3Key: true,
        originalFilename: true,
        altText: true,
        caption: true,
        width: true,
        height: true,
        size: true,
        mimeType: true,
        tags: true,
        mediaType: true,
        processingStatus: true,
        duration: true,
        codec: true,
        bitrate: true,
        framerate: true,
        videoUrl: true,
        videoS3Key: true,
        createdAt: true,
        updatedAt: true,
        authorId: true
      }
    }),
    prisma.media.count({
      where: {
        tags: {
          hasSome: tags as string[]
        },
        visibility: 'PUBLIC'
      }
    })
  ])

  res.json({
    success: true,
    data: {
      media,
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