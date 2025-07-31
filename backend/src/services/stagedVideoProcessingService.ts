import { PrismaClient } from '@prisma/client'
import { RabbitMQService } from './rabbitmqService'
import { v4 as uuidv4 } from 'uuid'

const logger = {
  info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args)
}

export interface StagedProcessingRequest {
  id: string
  mediaId: string
  userId: string
  mediaType: 'VIDEO'
  s3Key: string
  originalFilename: string
  mimeType: string
  fileSize: number
  createdAt: Date
  stage: 'DOWNLOADING'
}

export class StagedVideoProcessingService {
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
    logger.info('Staged video processing service started')
  }

  async stop(): Promise<void> {
    await this.rabbitmqService.close()
    logger.info('Staged video processing service stopped')
  }

  async createProcessingJob(
    mediaId: string,
    userId: string,
    s3Key: string,
    originalFilename: string,
    mimeType: string,
    fileSize: number,
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
          processingStatus: 'PENDING'
        }
      })

      // Send to download queue (first stage)
      const request: StagedProcessingRequest = {
        id: jobId,
        mediaId: mediaId,
        userId: userId,
        mediaType: 'VIDEO',
        s3Key: s3Key,
        originalFilename: originalFilename,
        mimeType: mimeType,
        fileSize: fileSize,
        createdAt: new Date(),
        stage: 'DOWNLOADING'
      }

      // Send to download queue
      await this.rabbitmqService.sendMessage('video.processing.download', request)

      logger.info(`Created staged video processing job ${jobId} for media ${mediaId}`)
      return jobId

    } catch (error) {
      logger.error(`Failed to create staged processing job for media ${mediaId}:`, error)
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
        jobId: job.id,
        mediaId: job.mediaId,
        status: job.status,
        progress: job.progress,
        currentStep: job.currentStep,
        error: job.errorMessage,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        media: job.media
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
        mediaId: media.id,
        processingStatus: media.processingStatus,
        videoProcessingStatus: media.videoProcessingStatus,
        latestJob: latestJob ? {
          jobId: latestJob.id,
          status: latestJob.status,
          progress: latestJob.progress,
          currentStep: latestJob.currentStep,
          error: latestJob.errorMessage,
          createdAt: latestJob.createdAt,
          updatedAt: latestJob.updatedAt
        } : null
      }

    } catch (error) {
      logger.error(`Failed to get media processing status for ${mediaId}:`, error)
      throw error
    }
  }

  private async handleProgressUpdate(update: any): Promise<void> {
    try {
      const { job_id, media_id, status, progress, current_step, error_message, thumbnails, video_versions, metadata } = update

      // Update job record
      await this.prisma.videoProcessingJob.update({
        where: { id: job_id },
        data: {
          status: status.toUpperCase(),
          progress: progress,
          currentStep: current_step,
          errorMessage: error_message,
          updatedAt: new Date()
        }
      })

      // Update media record based on status
      if (status === 'completed') {
        await this.prisma.media.update({
          where: { id: media_id },
          data: {
            processingStatus: 'COMPLETED',
            videoProcessingStatus: 'COMPLETED',
            videoThumbnails: thumbnails || [],
            videoVersions: video_versions || [],
            videoMetadata: metadata || {},
            duration: metadata?.duration,
            codec: metadata?.codec,
            bitrate: metadata?.bitrate,
            framerate: metadata?.framerate
          }
        })
      } else if (status === 'failed') {
        await this.prisma.media.update({
          where: { id: media_id },
          data: {
            processingStatus: 'FAILED',
            videoProcessingStatus: 'FAILED'
          }
        })
      } else {
        // Update processing status for ongoing jobs
        await this.prisma.media.update({
          where: { id: media_id },
          data: {
            processingStatus: 'PROCESSING',
            videoProcessingStatus: 'PROCESSING'
          }
        })
      }

      logger.info(`Updated processing status for job ${job_id}: ${status} (${progress}%)`)

    } catch (error) {
      logger.error('Failed to handle progress update:', error)
    }
  }
} 