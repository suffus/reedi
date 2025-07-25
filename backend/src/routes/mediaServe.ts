import { Router, Request, Response } from 'express'
import { prisma } from '@/index'
import { asyncHandler } from '@/middleware/errorHandler'
import { optionalAuthMiddleware } from '@/middleware/auth'
import { AuthenticatedRequest } from '@/types'
import { getImageFromS3 } from '@/utils/s3Service'

const router = Router()

// Add CORS headers for all media serve requests
router.use((req: Request, res: Response, next) => {
  res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000')
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range')
  res.header('Cross-Origin-Resource-Policy', 'cross-origin')
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
    return
  }
  
  next()
})

// Helper function to check if user can view media
async function canViewMedia(mediaId: string, viewerId?: string): Promise<boolean> {
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    select: {
      id: true,
      visibility: true,
      authorId: true
    }
  })

  if (!media) {
    return false
  }

  // Public media can be viewed by anyone
  if (media.visibility === 'PUBLIC') {
    return true
  }

  // Private media can only be viewed by the author
  if (media.visibility === 'PRIVATE') {
    return viewerId === media.authorId
  }

  // Friends only media can be viewed by the author or friends
  if (media.visibility === 'FRIENDS_ONLY') {
    if (!viewerId) {
      return false
    }
    
    if (viewerId === media.authorId) {
      return true
    }

    // Check if they are friends
    const friendship = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: viewerId, receiverId: media.authorId, status: 'ACCEPTED' },
          { senderId: media.authorId, receiverId: viewerId, status: 'ACCEPTED' }
        ]
      }
    })

    return !!friendship
  }

  return false
}

// Serve media directly from backend
router.get('/:id', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const viewerId = req.user?.id

  // Check if user can view this media
  const canView = await canViewMedia(id, viewerId)
  if (!canView) {
    res.status(403).json({
      success: false,
      error: 'Access denied'
    })
    return
  }

  const media = await prisma.media.findUnique({
    where: { id },
    select: {
      id: true,
      s3Key: true,
      thumbnailS3Key: true,
      videoS3Key: true,
      mimeType: true,
      mediaType: true,
      processingStatus: true
    }
  })

  if (!media) {
    res.status(404).json({
      success: false,
      error: 'Media not found'
    })
    return
  }

  // For videos that are still processing, return a placeholder or error
  if (media.mediaType === 'VIDEO' && media.processingStatus !== 'COMPLETED') {
    res.status(202).json({
      success: false,
      error: 'Video is still processing',
      processingStatus: media.processingStatus
    })
    return
  }

  try {
    // Determine which S3 key to serve
    let s3Key = media.s3Key
    if (media.mediaType === 'VIDEO' && media.videoS3Key) {
      s3Key = media.videoS3Key // Use processed video if available
    }

    if (!s3Key) {
      res.status(404).json({
        success: false,
        error: 'Media file not found'
      })
      return
    }

    // Get media from S3
    const mediaBuffer = await getImageFromS3(s3Key)

    // Set appropriate headers
    res.setHeader('Content-Type', media.mimeType || 'application/octet-stream')
    res.setHeader('Content-Length', mediaBuffer.length)
    res.setHeader('Cache-Control', 'public, max-age=31536000') // Cache for 1 year
    res.setHeader('Accept-Ranges', 'bytes')

    // Handle range requests for video streaming
    const range = req.headers.range
    if (range && media.mediaType === 'VIDEO') {
      const parts = range.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : mediaBuffer.length - 1
      const chunksize = (end - start) + 1

      res.status(206)
      res.setHeader('Content-Range', `bytes ${start}-${end}/${mediaBuffer.length}`)
      res.setHeader('Content-Length', chunksize.toString())
      res.setHeader('Accept-Ranges', 'bytes')

      res.end(mediaBuffer.slice(start, end + 1))
    } else {
      // Send full file
      res.end(mediaBuffer)
    }

  } catch (error) {
    console.error('Error serving media:', error)
    res.status(500).json({
      success: false,
      error: 'Error serving media'
    })
  }
}))

// Serve media thumbnail
router.get('/:id/thumbnail', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const viewerId = req.user?.id

  // Check if user can view this media
  const canView = await canViewMedia(id, viewerId)
  if (!canView) {
    res.status(403).json({
      success: false,
      error: 'Access denied'
    })
    return
  }

  const media = await prisma.media.findUnique({
    where: { id },
    select: {
      id: true,
      thumbnailS3Key: true,
      mimeType: true,
      mediaType: true,
      processingStatus: true
    }
  })

  if (!media) {
    res.status(404).json({
      success: false,
      error: 'Media not found'
    })
    return
  }

  // For videos that are still processing, return a placeholder
  if (media.mediaType === 'VIDEO' && media.processingStatus !== 'COMPLETED') {
    res.status(202).json({
      success: false,
      error: 'Video thumbnail is still processing',
      processingStatus: media.processingStatus
    })
    return
  }

  try {
    if (!media.thumbnailS3Key) {
      res.status(404).json({
        success: false,
        error: 'Thumbnail not found'
      })
      return
    }

    // Get thumbnail from S3
    const thumbnailBuffer = await getImageFromS3(media.thumbnailS3Key)

    // Set appropriate headers
    res.setHeader('Content-Type', 'image/jpeg')
    res.setHeader('Content-Length', thumbnailBuffer.length)
    res.setHeader('Cache-Control', 'public, max-age=31536000') // Cache for 1 year

    res.end(thumbnailBuffer)

  } catch (error) {
    console.error('Error serving thumbnail:', error)
    res.status(500).json({
      success: false,
      error: 'Error serving thumbnail'
    })
  }
}))

// Stream video (for future video streaming implementation)
router.get('/:id/stream', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const viewerId = req.user?.id

  // Check if user can view this media
  const canView = await canViewMedia(id, viewerId)
  if (!canView) {
    res.status(403).json({
      success: false,
      error: 'Access denied'
    })
    return
  }

  const media = await prisma.media.findUnique({
    where: { id },
    select: {
      id: true,
      videoS3Key: true,
      s3Key: true,
      mimeType: true,
      mediaType: true,
      processingStatus: true
    }
  })

  if (!media) {
    res.status(404).json({
      success: false,
      error: 'Media not found'
    })
    return
  }

  if (media.mediaType !== 'VIDEO') {
    res.status(400).json({
      success: false,
      error: 'This endpoint is for video streaming only'
    })
    return
  }

  if (media.processingStatus !== 'COMPLETED') {
    res.status(202).json({
      success: false,
      error: 'Video is still processing',
      processingStatus: media.processingStatus
    })
    return
  }

  try {
    // Use processed video if available, otherwise fall back to original
    const s3Key = media.videoS3Key || media.s3Key

    if (!s3Key) {
      res.status(404).json({
        success: false,
        error: 'Video file not found'
      })
      return
    }

    // Get video from S3
    const videoBuffer = await getImageFromS3(s3Key)

    // Set appropriate headers for video streaming
    res.setHeader('Content-Type', media.mimeType || 'video/mp4')
    res.setHeader('Content-Length', videoBuffer.length)
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'public, max-age=31536000')

    // Handle range requests for video streaming
    const range = req.headers.range
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : videoBuffer.length - 1
      const chunksize = (end - start) + 1

      res.status(206)
      res.setHeader('Content-Range', `bytes ${start}-${end}/${videoBuffer.length}`)
      res.setHeader('Content-Length', chunksize.toString())

      res.end(videoBuffer.slice(start, end + 1))
    } else {
      // Send full video
      res.end(videoBuffer)
    }

  } catch (error) {
    console.error('Error streaming video:', error)
    res.status(500).json({
      success: false,
      error: 'Error streaming video'
    })
  }
}))

export default router 