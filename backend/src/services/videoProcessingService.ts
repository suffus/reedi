import { PrismaClient } from '@prisma/client'
import { RabbitMQService, ProcessingRequest, ProgressUpdate } from './rabbitmqService'
import { v4 as uuidv4 } from 'uuid'

const logger = {
  info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args)
}

export class VideoProcessingService {
  private prisma: PrismaClient
  private rabbitmqService: RabbitMQService

  constructor(prisma: PrismaClient, rabbitmqService: RabbitMQService) {
    this.prisma = prisma
    this.rabbitmqService = rabbitmqService
  }

  async start(): Promise<void> {
    await this.rabbitmqService.connect()
    await this.rabbitmqService.consumeProgressUpdates(
      (update) => this.handleProgressUpdate(update)
    )
    logger.info('Video processing service started')
  }

  async stop(): Promise<void> {
    await this.rabbitmqService.close()
    logger.info('Video processing service stopped')
  }

  async createProcessingJob(
    mediaId: string,
    userId: string,
    s3Key: string,
    originalFilename: string,
    requestProgressUpdates: boolean = true,
    progressInterval: number = 5
  ): Promise<string> {
    const jobId = uuidv4()

    try {
      // Create job record in database
      await this.prisma.videoProcessingJob.create({
        data: {
          id: jobId,
          mediaId: mediaId,
          userId: userId,
          s3Key: s3Key,
          originalFilename: originalFilename,
          status: 'PENDING',
          progress: 0,
          currentStep: 'job_created'
        }
      })

      // Update media record
      await this.prisma.media.update({
        where: { id: mediaId },
        data: {
          videoProcessingStatus: 'PENDING',
          processingStatus: 'PENDING' // Also update the main processingStatus field
        }
      })

      // Send processing request to RabbitMQ
      const request: ProcessingRequest = {
        type: 'video_processing_request',
        job_id: jobId,
        media_id: mediaId,
        user_id: userId,
        s3_key: s3Key,
        original_filename: originalFilename,
        request_thumbnails: true,
        request_progress_updates: requestProgressUpdates,
        progress_interval: progressInterval,
        timestamp: new Date().toISOString()
      }

      await this.rabbitmqService.publishProcessingRequest(request)

      logger.info(`Created video processing job ${jobId} for media ${mediaId}`)
      return jobId

    } catch (error) {
      logger.error(`Failed to create processing job for media ${mediaId}:`, error)
      throw error
    }
  }

  async getProcessingStatus(jobId: string): Promise<any> {
    try {
      const job = await this.prisma.videoProcessingJob.findUnique({
        where: { id: jobId },
        include: {
          media: true
        }
      })

      if (!job) {
        throw new Error(`Processing job ${jobId} not found`)
      }

      return {
        job_id: job.id,
        media_id: job.mediaId,
        status: job.status,
        progress: job.progress,
        current_step: job.currentStep,
        error_message: job.errorMessage,
        thumbnails: job.thumbnails,
        video_versions: job.videoVersions,
        metadata: job.metadata,
        created_at: job.createdAt,
        updated_at: job.updatedAt,
        completed_at: job.completedAt
      }
    } catch (error) {
      logger.error(`Failed to get processing status for job ${jobId}:`, error)
      throw error
    }
  }

  async getMediaProcessingStatus(mediaId: string): Promise<any> {
    try {
      const media = await this.prisma.media.findUnique({
        where: { id: mediaId },
        include: {
          videoProcessingJobs: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      })

      if (!media) {
        throw new Error(`Media ${mediaId} not found`)
      }

      const latestJob = media.videoProcessingJobs[0]

      return {
        media_id: mediaId,
        video_processing_status: media.videoProcessingStatus,
        video_thumbnails: media.videoThumbnails,
        video_versions: media.videoVersions,
        video_metadata: media.videoMetadata,
        latest_job: latestJob ? {
          job_id: latestJob.id,
          status: latestJob.status,
          progress: latestJob.progress,
          current_step: latestJob.currentStep,
          error_message: latestJob.errorMessage,
          created_at: latestJob.createdAt,
          updated_at: latestJob.updatedAt,
          completed_at: latestJob.completedAt
        } : null
      }
    } catch (error) {
      logger.error(`Failed to get media processing status for ${mediaId}:`, error)
      throw error
    }
  }

  private async handleProgressUpdate(update: ProgressUpdate): Promise<void> {
    try {
      const { job_id, media_id, status, progress, current_step, thumbnails, video_versions, metadata, error_message } = update

      // Add debugging
      logger.info(`Received progress update for job ${job_id}: ${status} (${progress}%)`)
      if (thumbnails) {
        logger.info(`Thumbnails count: ${thumbnails.length}`)
      }
      if (video_versions) {
        logger.info(`Video versions count: ${video_versions.length}`)
      }

      // Convert status string to enum value
      let enumStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'FAILED'
      switch (status) {
        case 'pending':
          enumStatus = 'PENDING'
          break
        case 'processing':
          enumStatus = 'PROCESSING'
          break
        case 'completed':
          enumStatus = 'COMPLETED'
          break
        case 'rejected':
          enumStatus = 'REJECTED'
          break
        case 'failed':
          enumStatus = 'FAILED'
          break
        default:
          enumStatus = 'PENDING'
      }

      // Update job record
      const updateData: any = {
        status: enumStatus,
        progress,
        currentStep: current_step,
        updatedAt: new Date()
      }

      if (thumbnails) {
        updateData.thumbnails = thumbnails
        logger.info(`Storing ${thumbnails.length} thumbnails in job record`)
      }

      if (video_versions) {
        updateData.videoVersions = video_versions
        logger.info(`Storing ${video_versions.length} video versions in job record`)
      }

      if (metadata) {
        updateData.metadata = metadata
      }

      if (error_message) {
        updateData.errorMessage = error_message
      }

      if (status === 'completed') {
        updateData.completedAt = new Date()
      }

      await this.prisma.videoProcessingJob.update({
        where: { id: job_id },
        data: updateData
      })

      // Update media record
      const mediaUpdateData: any = {
        videoProcessingStatus: enumStatus,
        processingStatus: enumStatus // Also update the main processingStatus field
      }

      if (thumbnails) {
        mediaUpdateData.videoThumbnails = thumbnails
        logger.info(`Storing ${thumbnails.length} thumbnails in media record`)
      }

      if (video_versions) {
        mediaUpdateData.videoVersions = video_versions
        logger.info(`Storing ${video_versions.length} video versions in media record`)
        
        // Set videoS3Key to the best quality video version
        if (video_versions.length > 0) {
          // Find the best quality video (prioritize original, then 720p, then 540p, then 360p)
          let bestVideo = video_versions[0]
          for (const version of video_versions) {
            if (version.quality === 'original') {
              bestVideo = version
              break
            } else if (version.quality === '720p' && bestVideo.quality !== 'original') {
              bestVideo = version
            } else if (version.quality === '540p' && bestVideo.quality !== 'original' && bestVideo.quality !== '720p') {
              bestVideo = version
            } else if (version.quality === '360p' && bestVideo.quality !== 'original' && bestVideo.quality !== '720p' && bestVideo.quality !== '540p') {
              bestVideo = version
            }
          }
          
          // Set the videoS3Key to the best quality video
          mediaUpdateData.videoS3Key = bestVideo.s3_key
          logger.info(`Set videoS3Key to ${bestVideo.s3_key} (quality: ${bestVideo.quality})`)
        }
      }

      if (metadata) {
        mediaUpdateData.videoMetadata = metadata
      }

      await this.prisma.media.update({
        where: { id: media_id },
        data: mediaUpdateData
      })

      logger.info(`Updated processing job ${job_id}: ${enumStatus} (${progress}%)`)

    } catch (error) {
      logger.error(`Failed to handle progress update for job ${update.job_id}:`, error)
    }
  }
} 