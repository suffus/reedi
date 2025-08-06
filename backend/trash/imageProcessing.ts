import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { ImageProcessingService } from '../services/imageProcessingService'
import { authMiddleware } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import logger from '../utils/logger'
import { RabbitMQService } from '../services/rabbitmqService'

const router = Router()
const prisma = new PrismaClient()

// Initialize services
const rabbitmqService = new RabbitMQService(
  process.env['RABBITMQ_URL'] || `amqp://${process.env['RABBITMQ_USER'] || 'guest'}:${process.env['RABBITMQ_PASSWORD'] || 'guest'}@localhost:${process.env['RABBITMQ_PORT'] || '5672'}`,
  {
    processing: 'media.processing',
    updates: 'media.updates'
  },
  'images',
  {
    requests: 'media.images.processing.requests',
    updates: 'media.images.processing.updates'
  }
)
const imageProcessingService = new ImageProcessingService(prisma, rabbitmqService)

// Start the image processing service
imageProcessingService.start().catch(error => {
  logger.error('Failed to start image processing service:', error)
})

// Request image processing
router.post('/request', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { mediaId, s3Key, originalFilename } = req.body
  const userId = (req as any).user.id

  if (!mediaId || !s3Key || !originalFilename) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: mediaId, s3Key, originalFilename'
    })
  }

  try {
    // Verify media exists and belongs to user
    const media = await prisma.media.findFirst({
      where: {
        id: mediaId,
        authorId: userId,
        mediaType: 'IMAGE'
      }
    })

    if (!media) {
      return res.status(404).json({
        success: false,
        error: 'Media not found or not accessible'
      })
    }

    // Check if processing is already in progress
    const existingJob = await prisma.mediaProcessingJob.findFirst({
      where: {
        mediaId,
        mediaType: 'IMAGE',
        status: { in: ['PENDING', 'PROCESSING'] }
      }
    })

    if (existingJob) {
      return res.status(409).json({
        success: false,
        error: 'Image processing already in progress',
        jobId: existingJob.id
      })
    }

    // Request image processing
    const jobId = await imageProcessingService.requestImageProcessing(
      mediaId,
      userId,
      s3Key,
      originalFilename
    )

    res.json({
      success: true,
      jobId,
      message: 'Image processing requested successfully'
    })

  } catch (error) {
    logger.error('Error requesting image processing:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to request image processing'
    })
  }
}))

// Get processing status
router.get('/status/:mediaId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { mediaId } = req.params
  const userId = (req as any).user.id

  try {
    // Verify media exists and belongs to user
    const media = await prisma.media.findFirst({
      where: {
        id: mediaId,
        authorId: userId,
        mediaType: 'IMAGE'
      }
    })

    if (!media) {
      return res.status(404).json({
        success: false,
        error: 'Media not found or not accessible'
      })
    }

    // Get processing status
    const status = await imageProcessingService.getProcessingStatus(mediaId)

    res.json({
      success: true,
      status,
      media: {
        id: media.id,
        imageProcessingStatus: media.imageProcessingStatus,
        imageVersions: media.imageVersions,
        imageMetadata: media.imageMetadata
      }
    })

  } catch (error) {
    logger.error('Error getting image processing status:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get processing status'
    })
  }
}))

// Cancel processing
router.post('/cancel/:mediaId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { mediaId } = req.params
  const userId = (req as any).user.id

  try {
    // Verify media exists and belongs to user
    const media = await prisma.media.findFirst({
      where: {
        id: mediaId,
        authorId: userId,
        mediaType: 'IMAGE'
      }
    })

    if (!media) {
      return res.status(404).json({
        success: false,
        error: 'Media not found or not accessible'
      })
    }

    // Cancel processing
    await imageProcessingService.cancelProcessing(mediaId)

    res.json({
      success: true,
      message: 'Image processing cancelled successfully'
    })

  } catch (error) {
    logger.error('Error cancelling image processing:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to cancel processing'
    })
  }
}))

// Get available image qualities for a media item
router.get('/qualities/:mediaId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { mediaId } = req.params
  const userId = (req as any).user.id

  try {
    // Verify media exists and user can access it
    const media = await prisma.media.findFirst({
      where: {
        id: mediaId,
        mediaType: 'IMAGE'
      }
    })

    if (!media) {
      return res.status(404).json({
        success: false,
        error: 'Media not found'
      })
    }

    // Check if user can view this media (public or owned by user)
    if (media.visibility !== 'PUBLIC' && media.authorId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      })
    }

    const qualities: Array<{
      quality: string
      width: number
      height: number
      url: string
      fileSize: number
    }> = []

    // Add original quality if available
    if (media.s3Key) {
      qualities.push({
        quality: 'original',
        width: media.width || 0,
        height: media.height || 0,
        url: `${req.protocol}://${req.get('host')}/api/media/serve/${media.id}`,
        fileSize: media.size || 0
      })
    }

    // Add processed qualities if available
    if (media.imageVersions && Array.isArray(media.imageVersions)) {
      for (const version of media.imageVersions as any[]) {
        const s3Key = version.s3Key || version.s3_key
        const quality = version.quality
        const width = version.width
        const height = version.height
        const fileSize = version.fileSize || version.file_size || 0
        
        if (s3Key && quality && width && height) {
          qualities.push({
            quality: quality,
            width: width,
            height: height,
            url: `${req.protocol}://${req.get('host')}/api/media/serve/${media.id}/quality/${encodeURIComponent(s3Key)}`,
            fileSize: fileSize
          })
        }
      }
    }

    // Sort qualities by resolution (highest first)
    qualities.sort((a, b) => (b.width * b.height) - (a.width * a.height))

    res.json({
      success: true,
      qualities
    })

  } catch (error) {
    console.error('Error getting image qualities:', error)
    res.status(500).json({
      success: false,
      error: 'Error getting image qualities'
    })
  }
}))

export default router 