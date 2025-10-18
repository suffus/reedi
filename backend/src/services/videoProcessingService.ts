import { PrismaClient } from '@prisma/client'
import { BaseMediaProcessingService } from './baseMediaProcessingService'
import { MediaProcessingMessage, MediaProcessingRequest, MediaProgressUpdate, MediaProcessingResult } from '../types/media-processing'
import { v4 as uuidv4 } from 'uuid'
import logger from '../utils/logger'

export class VideoProcessingService extends BaseMediaProcessingService {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient, skipQueueConsumption: boolean = false) {
    super('video', skipQueueConsumption)
    this.prisma = prisma
  }

  async start(): Promise<void> {
    await super.start()
    
    // Set up update callback
    this.setUpdateCallback((update: MediaProcessingMessage) => this.handleProgressUpdate(update))

    logger.info('Video processing service started')
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
      await this.prisma.mediaProcessingJob.create({
        data: {
          id: jobId,
          mediaId: mediaId,
          userId: userId,
          mediaType: 'VIDEO',
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

      // Send processing request using unified message format
      await this.publishProcessingRequest({
        mediaId,
        userId,
        s3Key,
        originalFilename,
        mimeType,
        fileSize,
        metadata: {
          jobId,
          requestProgressUpdates,
          progressInterval
        }
      })

      logger.info(`Created video processing job ${jobId} for media ${mediaId}`)
      return jobId

    } catch (error) {
      logger.error(`Failed to create video processing job for media ${mediaId}:`, error)
      throw error
    }
  }

  async getProcessingStatus(jobId: string): Promise<any> {
    try {
      const job = await this.prisma.mediaProcessingJob.findUnique({
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
          mediaProcessingJobs: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      })

      if (!media) {
        throw new Error(`Media ${mediaId} not found`)
      }

      const latestJob = media.mediaProcessingJobs[0]

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

  async handleProgressUpdate(update: MediaProcessingMessage): Promise<void> {
    try {
      if (update.messageType === 'progress') {
        const progressUpdate = update as MediaProgressUpdate
        const { mediaId, status, progress, stage, details } = progressUpdate
        
        // Extract job ID from metadata if available
        const jobId = details?.jobId || `video_${mediaId}`
        
        logger.info(`Video processing update for job ${jobId}: ${status} (${progress}%)`)
        
        // Update processing job
        await this.prisma.mediaProcessingJob.updateMany({
          where: { 
            mediaId,
            mediaType: 'VIDEO',
            status: { in: ['PENDING', 'PROCESSING'] }
          },
          data: {
            status: this.mapStatus(status),
            progress,
            currentStep: stage,
            errorMessage: details?.errorMessage,
            metadata: details ? JSON.stringify(details) : undefined,
            completedAt: status === 'COMPLETED' || status === 'FAILED' ? new Date() : undefined
          }
        })

        // Update media record
        await this.prisma.media.update({
          where: { id: mediaId },
          data: {
            processingStatus: this.mapStatus(status),
            videoProcessingStatus: this.mapStatus(status)
          }
        })

      } else if (update.messageType === 'result') {
        const resultUpdate = update as MediaProcessingResult
        const { mediaId, status, result, error } = resultUpdate
        
        // Extract job ID from metadata if available
        const jobId = result?.metadata?.jobId || `video_${mediaId}`
        
        logger.info(`Video processing result for job ${jobId}: ${status}`)
        
        // Update processing job
        await this.prisma.mediaProcessingJob.updateMany({
          where: { 
            mediaId,
            mediaType: 'VIDEO',
            status: { in: ['PENDING', 'PROCESSING'] }
          },
          data: {
            status: this.mapStatus(status),
            progress: status === 'COMPLETED' ? 100 : 0,
            currentStep: status === 'COMPLETED' ? 'completed' : 'failed',
            errorMessage: error,
            metadata: result?.metadata ? JSON.stringify(result.metadata) : undefined,
            completedAt: new Date()
          }
        })

        // Update media record with processing results
        if (status === 'COMPLETED' && result) {
          const mediaUpdateData: any = {
            processingStatus: 'COMPLETED',
            videoProcessingStatus: 'COMPLETED'
          }

          // Extract video-specific metadata
          if (result.metadata) {
            mediaUpdateData.videoThumbnails = result.metadata.thumbnails || []
            mediaUpdateData.videoVersions = result.metadata.videoVersions || []
            mediaUpdateData.videoMetadata = result.metadata
            mediaUpdateData.duration = result.metadata.duration
            mediaUpdateData.codec = result.metadata.codec
            mediaUpdateData.bitrate = result.metadata.bitrate
            mediaUpdateData.framerate = result.metadata.framerate
          }

          // Update S3 keys if available
          if (result.s3Key) {
            mediaUpdateData.videoS3Key = result.s3Key
          }
          if (result.thumbnailS3Key) {
            mediaUpdateData.thumbnailS3Key = result.thumbnailS3Key
          }

          // Update dimensions if available
          if (result.width && result.height) {
            mediaUpdateData.width = result.width
            mediaUpdateData.height = result.height
          }

          await this.prisma.media.update({
            where: { id: mediaId },
            data: mediaUpdateData
          })

          logger.info(`Video processing completed for media ${mediaId}`)
        } else if (status === 'FAILED') {
          await this.prisma.media.update({
            where: { id: mediaId },
            data: {
              processingStatus: 'FAILED',
              videoProcessingStatus: 'FAILED'
            }
          })
          logger.error(`Video processing failed for media ${mediaId}: ${error}`)
        }
      }

    } catch (error) {
      logger.error(`Error handling video processing update for media ${update.mediaId}:`, error)
    }
  }

  private mapStatus(status: string): 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' {
    switch (status) {
      case 'PROCESSING':
        return 'PROCESSING'
      case 'COMPLETED':
        return 'COMPLETED'
      case 'FAILED':
        return 'FAILED'
      default:
        return 'PENDING'
    }
  }
} 