import { Router, Request, Response } from 'express'
import { prisma } from '@/index'
import { asyncHandler } from '@/middleware/errorHandler'
import { optionalAuthMiddleware } from '@/middleware/auth'
import { AuthenticatedRequest } from '@/types'
import { getImageFromS3 } from '@/utils/s3Service'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

const router = Router()

// Initialize S3 client for streaming
const s3Client = new S3Client({
  region: process.env.IDRIVE_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.IDRIVE_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.IDRIVE_SECRET_ACCESS_KEY || ''
  },
  endpoint: process.env.IDRIVE_ENDPOINT,
  forcePathStyle: true
})

// Function to stream video from S3
async function streamVideoFromS3(s3Key: string, mimeType: string | null, req: Request, res: Response) {
  try {
    const bucket = process.env.IDRIVE_BUCKET_NAME || ''
    
    // Get the range header from the request
    const range = req.headers.range
    
    // Prepare the S3 request
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      ...(range && { Range: range })
    })
    
    // Get the object from S3
    const response = await s3Client.send(command)
    
    if (!response.Body) {
      throw new Error('No body in S3 response')
    }
    
    // Set appropriate headers
    res.setHeader('Content-Type', mimeType || 'video/mp4')
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'public, max-age=31536000') // Cache for 1 year
    
    // Handle range requests
    if (range && response.ContentRange) {
      res.status(206)
      res.setHeader('Content-Range', response.ContentRange)
      res.setHeader('Content-Length', response.ContentLength?.toString() || '0')
    } else {
      res.setHeader('Content-Length', response.ContentLength?.toString() || '0')
    }
    
    // Stream the video data directly to the response
    const stream = response.Body as any
    stream.pipe(res)
    
  } catch (error) {
    console.error('Error streaming video from S3:', error)
    res.status(500).json({
      success: false,
      error: 'Error streaming video'
    })
  }
}

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

    // For videos, use streaming approach
    if (media.mediaType === 'VIDEO') {
      await streamVideoFromS3(s3Key, media.mimeType, req, res)
    } else {
      // For images, use the existing approach
      const mediaBuffer = await getImageFromS3(s3Key)
      
      // Set appropriate headers
      res.setHeader('Content-Type', media.mimeType || 'application/octet-stream')
      res.setHeader('Content-Length', mediaBuffer.length)
      res.setHeader('Cache-Control', 'public, max-age=31536000') // Cache for 1 year
      
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
      videoThumbnails: true,
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
    let thumbnailS3Key: string | null = null

    // For videos, check processed thumbnails first
    if (media.mediaType === 'VIDEO' && media.videoThumbnails) {
      const videoThumbnails = media.videoThumbnails as any[]
      if (videoThumbnails && videoThumbnails.length > 0) {
        // Use the first thumbnail (or could implement logic to pick the best one)
        thumbnailS3Key = videoThumbnails[0].s3_key || videoThumbnails[0].s3Key
      }
    }

    // Fall back to original thumbnailS3Key if no processed thumbnails
    if (!thumbnailS3Key) {
      thumbnailS3Key = media.thumbnailS3Key
    }

    if (!thumbnailS3Key) {
      res.status(404).json({
        success: false,
        error: 'Thumbnail not found'
      })
      return
    }

    // Get thumbnail from S3
    const thumbnailBuffer = await getImageFromS3(thumbnailS3Key)

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

// Serve processed video thumbnail
router.get('/:id/processed-thumbnail/:s3Key', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id, s3Key } = req.params
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
      mediaType: true,
      processingStatus: true,
      videoThumbnails: true
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
      error: 'This endpoint is for video thumbnails only'
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
    // Validate that the requested s3Key is actually a thumbnail for this video
    const videoThumbnails = media.videoThumbnails as any[]
    const isValidThumbnail = videoThumbnails && videoThumbnails.some((thumb: any) => 
      (thumb.s3_key || thumb.s3Key) === s3Key
    )

    if (!isValidThumbnail) {
      res.status(404).json({
        success: false,
        error: 'Thumbnail not found for this video'
      })
      return
    }

    // Get thumbnail from S3
    const thumbnailBuffer = await getImageFromS3(s3Key)

    // Set appropriate headers
    res.setHeader('Content-Type', 'image/jpeg')
    res.setHeader('Content-Length', thumbnailBuffer.length)
    res.setHeader('Cache-Control', 'public, max-age=31536000') // Cache for 1 year

    res.end(thumbnailBuffer)

  } catch (error) {
    console.error('Error serving processed thumbnail:', error)
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

    // Use the streaming function for better performance
    await streamVideoFromS3(s3Key, media.mimeType, req, res)

  } catch (error) {
    console.error('Error streaming video:', error)
    res.status(500).json({
      success: false,
      error: 'Error streaming video'
    })
  }
}))

// Serve processed video thumbnails
router.get('/:id/processed-thumbnail/:s3Key', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id, s3Key } = req.params
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
      mediaType: true,
      videoThumbnails: true
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
      error: 'This endpoint is for video thumbnails only'
    })
    return
  }

  // Verify that the requested S3 key is actually a thumbnail for this video
  const thumbnails = media.videoThumbnails as any[]
  const thumbnailExists = thumbnails && Array.isArray(thumbnails) && 
    thumbnails.some(thumb => {
      const thumbS3Key = thumb.s3Key || thumb.s3_key
      return thumbS3Key === decodeURIComponent(s3Key)
    })

  if (!thumbnailExists) {
    res.status(404).json({
      success: false,
      error: 'Thumbnail not found'
    })
    return
  }

  try {
    // Get thumbnail from S3
    const thumbnailBuffer = await getImageFromS3(decodeURIComponent(s3Key))

    // Set appropriate headers for image serving
    res.setHeader('Content-Type', 'image/jpeg')
    res.setHeader('Content-Length', thumbnailBuffer.length)
    res.setHeader('Cache-Control', 'public, max-age=31536000')
    res.setHeader('Accept-Ranges', 'bytes')

    res.end(thumbnailBuffer)

  } catch (error) {
    console.error('Error serving processed thumbnail:', error)
    res.status(500).json({
      success: false,
      error: 'Error serving thumbnail'
    })
  }
}))

export default router 