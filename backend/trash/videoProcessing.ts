import { Router } from 'express'
import { VideoProcessingService } from '../services/videoProcessingService'
import { RabbitMQService } from '../services/rabbitmqService'
import { PrismaClient } from '@prisma/client'
import { authMiddleware } from '../middleware/auth'
import { AuthenticatedRequest } from '../types'

const router = Router()
const prisma = new PrismaClient()

// Initialize services
const rabbitmqService = new RabbitMQService()
const videoProcessingService = new VideoProcessingService(prisma, rabbitmqService)

// Start the video processing service when the server starts
videoProcessingService.start().catch(console.error)

// Process video endpoint
router.post('/media/:id/process-video', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id: mediaId } = req.params
    const userId = req.user!.id
    const { requestProgressUpdates = true, progressInterval = 5 } = req.body

    // Get media details
    const media = await prisma.media.findUnique({
      where: { id: mediaId }
    })

    if (!media) {
      return res.status(404).json({ error: 'Media not found' })
    }

    if (media.authorId !== userId) {
      return res.status(403).json({ error: 'Not authorized to process this media' })
    }

    if (media.mediaType !== 'VIDEO') {
      return res.status(400).json({ error: 'Only video media can be processed' })
    }

    if (!media.s3Key) {
      return res.status(400).json({ error: 'Media must be uploaded to S3 first' })
    }

    // Create processing job
    const jobId = await videoProcessingService.createProcessingJob(
      mediaId,
      userId,
      media.s3Key,
      media.originalFilename || 'unknown',
      requestProgressUpdates,
      progressInterval
    )

    return res.json({
      success: true,
      job_id: jobId,
      message: 'Video processing job created successfully'
    })

  } catch (error) {
    console.error('Error creating video processing job:', error)
    return res.status(500).json({ error: 'Failed to create video processing job' })
  }
})

// Get processing status endpoint
router.get('/media/:id/processing-status', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id: mediaId } = req.params
    const userId = req.user!.id

    // Get media details
    const media = await prisma.media.findUnique({
      where: { id: mediaId }
    })

    if (!media) {
      return res.status(404).json({ error: 'Media not found' })
    }

    if (media.authorId !== userId) {
      return res.status(403).json({ error: 'Not authorized to view this media' })
    }

    // Get processing status
    const status = await videoProcessingService.getMediaProcessingStatus(mediaId)

    return res.json({
      success: true,
      status
    })

  } catch (error) {
    console.error('Error getting processing status:', error)
    return res.status(500).json({ error: 'Failed to get processing status' })
  }
})

// Get video versions endpoint
router.get('/media/:id/video-versions', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id: mediaId } = req.params
    const userId = req.user!.id

    // Get media details
    const media = await prisma.media.findUnique({
      where: { id: mediaId }
    })

    if (!media) {
      return res.status(404).json({ error: 'Media not found' })
    }

    if (media.authorId !== userId) {
      return res.status(403).json({ error: 'Not authorized to view this media' })
    }

    if (media.mediaType !== 'VIDEO') {
      return res.status(400).json({ error: 'Only video media has versions' })
    }

    return res.json({
      success: true,
      video_versions: media.videoVersions || [],
      video_thumbnails: media.videoThumbnails || [],
      video_metadata: media.videoMetadata || null
    })

  } catch (error) {
    console.error('Error getting video versions:', error)
    return res.status(500).json({ error: 'Failed to get video versions' })
  }
})

// Get job status endpoint
router.get('/jobs/:jobId', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { jobId } = req.params
    const userId = req.user!.id

    // Get job details
    const job = await prisma.mediaProcessingJob.findUnique({
      where: { id: jobId },
      include: { media: true }
    })

    if (!job) {
      return res.status(404).json({ error: 'Job not found' })
    }

    if (job.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to view this job' })
    }

    // Get processing status
    const status = await videoProcessingService.getProcessingStatus(jobId)

    return res.json({
      success: true,
      status
    })

  } catch (error) {
    console.error('Error getting job status:', error)
    return res.status(500).json({ error: 'Failed to get job status' })
  }
})

export default router 