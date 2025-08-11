import { PrismaClient } from '@prisma/client'
import { RabbitMQService, ImageProcessingRequest, ImageProgressUpdate } from './rabbitmqService'
import logger from '../utils/logger'

export class ImageProcessingService {
  private prisma: PrismaClient
  private rabbitmqService: RabbitMQService

  constructor(prisma: PrismaClient, rabbitmqService: RabbitMQService) {
    this.prisma = prisma
    this.rabbitmqService = rabbitmqService
  }

  async start(): Promise<void> {
    await this.rabbitmqService.connect()
    
    // Start listening for progress updates
    await this.rabbitmqService.consumeProgressUpdates(
      (update: any) => this.handleProgressUpdate(update)
    )

    logger.info('Image processing service started 1')
  }

  async stop(): Promise<void> {
    await this.rabbitmqService.close()
    logger.info('Image processing service stopped')
  }

  async requestImageProcessing(
    mediaId: string,
    userId: string,
    s3Key: string,
    originalFilename: string
  ): Promise<string> {
    const jobId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Create processing job in database
    await this.prisma.mediaProcessingJob.create({
      data: {
        id: jobId,
        mediaId,
        userId,
        mediaType: 'IMAGE',
        s3Key,
        originalFilename,
        status: 'PENDING',
        progress: 0,
        currentStep: 'queued'
      }
    })

    // Update media status
    await this.prisma.media.update({
      where: { id: mediaId },
      data: {
        imageProcessingStatus: 'PENDING'
      }
    })

    // Send processing request to media processor
    const request: ImageProcessingRequest = {
      type: 'image_processing_request',
      job_id: jobId,
      media_id: mediaId,
      user_id: userId,
      s3_key: s3Key,
      original_filename: originalFilename,
      request_progress_updates: true,
      progress_interval: 10,
      timestamp: new Date().toISOString()
    }

    await this.rabbitmqService.sendMessage('media.images.processing.download', request)
    
    logger.info(`Image processing requested for media ${mediaId}, job ${jobId}`)
    return jobId
  }

  private async handleProgressUpdate(update: ImageProgressUpdate): Promise<void> {
    const { job_id, media_id, status, progress, current_step, image_versions, metadata, error_message } = update
    logger.info(`Image processing update for job ${job_id}: ${status} (${progress}%)`)
    logger.info(`Received image_versions: ${JSON.stringify(image_versions)}`)
    try {
      // Update processing job
      await this.prisma.mediaProcessingJob.update({
        where: { id: job_id },
        data: {
          status: this.mapStatus(status),
          progress,
          currentStep: current_step,
          errorMessage: error_message,
          imageVersions: image_versions ? JSON.stringify(image_versions) : undefined,
          metadata: metadata ? JSON.stringify(metadata) : undefined,
          completedAt: status === 'completed' || status === 'failed' ? new Date() : undefined
        }
      })

      // Update media record
      const mediaUpdateData: any = {
        imageProcessingStatus: this.mapStatus(status)
      }

      if (status === 'completed' && image_versions) {
        mediaUpdateData.imageVersions = JSON.stringify(image_versions)
        
        // Extract specific fields from image_versions array
        const thumbnailVersion = image_versions.find((version: any) => version.quality === 'thumbnail')
        const highQualityVersion = image_versions.find((version: any) => version.quality === '1080p')
        const mediumQualityVersion = image_versions.find((version: any) => version.quality === '720p')
        
        // Update thumbnail fields
        if (thumbnailVersion) {
          mediaUpdateData.thumbnail = thumbnailVersion.s3Key
          mediaUpdateData.thumbnailS3Key = thumbnailVersion.s3Key
        }
        
        // Update main image fields - use highest quality available for URL and size
        if (highQualityVersion) {
          mediaUpdateData.url = highQualityVersion.s3Key
          mediaUpdateData.size = highQualityVersion.fileSize
        } else if (mediumQualityVersion) {
          mediaUpdateData.url = mediumQualityVersion.s3Key
          mediaUpdateData.size = mediumQualityVersion.fileSize
        } else if (image_versions.length > 0) {
          // Fallback to first available version
          const firstVersion = image_versions[0]
          mediaUpdateData.url = firstVersion.s3Key
          mediaUpdateData.size = firstVersion.fileSize
        }
        
        // Use original corrected dimensions from metadata (with EXIF orientation applied)
        if (metadata && metadata.width && metadata.height) {
          mediaUpdateData.width = metadata.width
          mediaUpdateData.height = metadata.height
        } else if (highQualityVersion) {
          // Fallback to processed version dimensions if metadata not available
          mediaUpdateData.width = highQualityVersion.width
          mediaUpdateData.height = highQualityVersion.height
        } else if (mediumQualityVersion) {
          mediaUpdateData.width = mediumQualityVersion.width
          mediaUpdateData.height = mediumQualityVersion.height
        } else if (image_versions.length > 0) {
          const firstVersion = image_versions[0]
          mediaUpdateData.width = firstVersion.width
          mediaUpdateData.height = firstVersion.height
        }
      }

      if (metadata) {
        mediaUpdateData.imageMetadata = JSON.stringify(metadata)
      }

      await this.prisma.media.update({
        where: { id: media_id },
        data: mediaUpdateData
      })

      logger.info(`Image processing update for media ${media_id}: ${status} (${progress}%)`)
      
      if (status === 'completed') {
        logger.info(`Image processing completed for media ${media_id}`)
        if (image_versions) {
          logger.info(`Updated media with ${image_versions.length} versions`)
        }
      } else if (status === 'failed') {
        logger.error(`Image processing failed for media ${media_id}: ${error_message}`)
      }

    } catch (error) {
      logger.error(`Error handling image processing update for job ${job_id}:`, error)
    }
  }

  private mapStatus(status: string): 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' {
    switch (status) {
      case 'processing':
        return 'PROCESSING'
      case 'completed':
        return 'COMPLETED'
      case 'failed':
        return 'FAILED'
      default:
        return 'PENDING'
    }
  }

  async getProcessingStatus(mediaId: string): Promise<{
    status: string
    progress: number
    currentStep?: string
    errorMessage?: string
    imageVersions?: any[]
    metadata?: any
  } | null> {
    const job = await this.prisma.mediaProcessingJob.findFirst({
      where: { mediaId, mediaType: 'IMAGE' },
      orderBy: { createdAt: 'desc' }
    })

    if (!job) {
      return null
    }

    return {
      status: job.status,
      progress: job.progress,
      currentStep: job.currentStep || undefined,
      errorMessage: job.errorMessage || undefined,
      imageVersions: job.imageVersions ? JSON.parse(job.imageVersions as string) : undefined,
      metadata: job.metadata ? JSON.parse(job.metadata as string) : undefined
    }
  }

  async cancelProcessing(mediaId: string): Promise<void> {
    // Update job status to failed
    await this.prisma.mediaProcessingJob.updateMany({
      where: { 
        mediaId, 
        mediaType: 'IMAGE',
        status: { in: ['PENDING', 'PROCESSING'] }
      },
      data: {
        status: 'FAILED',
        errorMessage: 'Processing cancelled by user',
        completedAt: new Date()
      }
    })

    // Update media status
    await this.prisma.media.update({
      where: { id: mediaId },
      data: {
        imageProcessingStatus: 'FAILED'
      }
    })

    logger.info(`Image processing cancelled for media ${mediaId}`)
  }
} 