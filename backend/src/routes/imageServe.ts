import { Router, Request, Response } from 'express'
import { prisma } from '@/index'
import { asyncHandler } from '@/middleware/errorHandler'
import { optionalAuthMiddleware } from '@/middleware/auth'
import { AuthenticatedRequest } from '@/types'
import { getImageFromS3 } from '@/utils/s3Service'

const router = Router()

// Add CORS headers for all image serve requests
router.use((req: Request, res: Response, next) => {
  res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000')
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.header('Cross-Origin-Resource-Policy', 'cross-origin')
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
    return
  }
  
  next()
})

// Helper function to check if user can view image
async function canViewImage(imageId: string, viewerId?: string): Promise<boolean> {
  const image = await prisma.image.findUnique({
    where: { id: imageId },
    select: {
      id: true,
      visibility: true,
      authorId: true
    }
  })

  if (!image) {
    return false
  }

  // Public images can be viewed by anyone
  if (image.visibility === 'PUBLIC') {
    return true
  }

  // Private images can only be viewed by the author
  if (image.visibility === 'PRIVATE') {
    return viewerId === image.authorId
  }

  // Friends only images can be viewed by the author or friends
  if (image.visibility === 'FRIENDS_ONLY') {
    if (!viewerId) {
      return false
    }
    
    if (viewerId === image.authorId) {
      return true
    }

    // Check if they are friends
    const friendship = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: viewerId, receiverId: image.authorId, status: 'ACCEPTED' },
          { senderId: image.authorId, receiverId: viewerId, status: 'ACCEPTED' }
        ]
      }
    })

    return !!friendship
  }

  return false
}

// Serve image directly from backend
router.get('/:id', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const viewerId = req.user?.id

  // Check if user can view this image
  const canView = await canViewImage(id, viewerId)
  if (!canView) {
    res.status(403).json({
      success: false,
      error: 'Access denied'
    })
    return
  }

  const image = await prisma.image.findUnique({
    where: { id },
    select: {
      id: true,
      s3Key: true,
      thumbnailS3Key: true,
      mimeType: true
    }
  })

  if (!image) {
    res.status(404).json({
      success: false,
      error: 'Image not found'
    })
    return
  }

  try {
    // Get the image from S3
    const imageBuffer = await getImageFromS3(image.s3Key!)
    
    // Set appropriate headers
    res.setHeader('Content-Type', image.mimeType || 'image/jpeg')
    res.setHeader('Content-Length', imageBuffer.length)
    res.setHeader('Cache-Control', 'public, max-age=3600') // Cache for 1 hour
    
    // Send the image
    res.send(imageBuffer)
  } catch (error) {
    console.error('Error serving image:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to serve image'
    })
  }
}))

// Serve thumbnail directly from backend
router.get('/:id/thumbnail', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const viewerId = req.user?.id

  // Check if user can view this image
  const canView = await canViewImage(id, viewerId)
  if (!canView) {
    res.status(403).json({
      success: false,
      error: 'Access denied'
    })
    return
  }

  const image = await prisma.image.findUnique({
    where: { id },
    select: {
      id: true,
      thumbnailS3Key: true,
      mimeType: true
    }
  })

  if (!image || !image.thumbnailS3Key) {
    res.status(404).json({
      success: false,
      error: 'Thumbnail not found'
    })
    return
  }

  try {
    // Get the thumbnail from S3
    const thumbnailBuffer = await getImageFromS3(image.thumbnailS3Key)
    
    // Set appropriate headers
    res.setHeader('Content-Type', 'image/jpeg')
    res.setHeader('Content-Length', thumbnailBuffer.length)
    res.setHeader('Cache-Control', 'public, max-age=3600') // Cache for 1 hour
    
    // Send the thumbnail
    res.send(thumbnailBuffer)
  } catch (error) {
    console.error('Error serving thumbnail:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to serve thumbnail'
    })
  }
}))

export default router 