import { PrismaClient } from '@prisma/client'
import { BaseMediaProcessingService } from './baseMediaProcessingService'
import { MediaProcessingMessage, MediaProcessingRequest, MediaProgressUpdate, MediaProcessingResult } from '../types/media-processing'
import logger from '../utils/logger'

export class ImageProcessingService extends BaseMediaProcessingService {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient, skipQueueConsumption: boolean = false) {
    super('image', skipQueueConsumption)
    this.prisma = prisma
  }

  async start(): Promise<void> {
    await super.start()
    
    // Set up update callback
    this.setUpdateCallback((update: MediaProcessingMessage) => this.handleProgressUpdate(update))

    logger.info('Image processing service started')
  }

  async requestImageProcessing(
    mediaId: string,
    userId: string,
    s3Key: string,
    originalFilename: string,
    mimeType?: string,
    fileSize?: number
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

    // Send processing request using unified message format
    await this.publishProcessingRequest({
      mediaId,
      userId,
      s3Key,
      originalFilename,
      mimeType: mimeType || 'image/jpeg',
      fileSize: fileSize || 0,
      metadata: {
        jobId,
        requestProgressUpdates: true,
        progressInterval: 10
      }
    })
    
    logger.info(`Image processing requested for media ${mediaId}, job ${jobId}`)
    return jobId
  }

  async handleProgressUpdate(update: MediaProcessingMessage): Promise<void> {
    try {
      console.log(`🖼️ [IMAGE-SERVICE] Handling update:`, JSON.stringify(update, null, 2))
      
      if (update.messageType === 'progress') {
        const progressUpdate = update as MediaProgressUpdate
        const { mediaId, status, progress, stage, details } = progressUpdate
        
        // Extract job ID from metadata if available
        const jobId = details?.jobId || `img_${mediaId}`
        
        console.log(`🖼️ [IMAGE-SERVICE] Progress update for job ${jobId}: ${status} (${progress}%)`)
        logger.info(`Image processing update for job ${jobId}: ${status} (${progress}%)`)
        
        // Update processing job
        const jobUpdate = await this.prisma.mediaProcessingJob.updateMany({
          where: { 
            mediaId,
            mediaType: 'IMAGE',
            status: { in: ['PENDING', 'PROCESSING'] }
          },
          data: {
            status: this.mapStatus(status),
            progress,
            currentStep: stage,
            errorMessage: details?.errorMessage,
            imageVersions: details?.imageVersions ? JSON.stringify(details.imageVersions) : undefined,
            metadata: details ? JSON.stringify(details) : undefined,
            completedAt: status === 'COMPLETED' || status === 'FAILED' ? new Date() : undefined
          }
        })
        
        console.log(`🖼️ [IMAGE-SERVICE] Updated ${jobUpdate.count} processing jobs`)

        // Update media record
        const mediaUpdate = await this.prisma.media.update({
          where: { id: mediaId },
          data: {
            imageProcessingStatus: this.mapStatus(status)
          }
        })
        
        console.log(`🖼️ [IMAGE-SERVICE] Updated media record for progress:`, JSON.stringify(mediaUpdate, null, 2))

      } else if (update.messageType === 'result') {
        const resultUpdate = update as MediaProcessingResult
        const { mediaId, status, result, error } = resultUpdate
        
        // Extract job ID from metadata if available
        const jobId = result?.metadata?.jobId || `img_${mediaId}`
        
        console.log(`🖼️ [IMAGE-SERVICE] Result update for job ${jobId}: ${status}`)
        console.log(`🖼️ [IMAGE-SERVICE] Result data:`, JSON.stringify(result, null, 2))
        logger.info(`Image processing result for job ${jobId}: ${status}`)
        
        // Update processing job
        const jobUpdate = await this.prisma.mediaProcessingJob.updateMany({
          where: { 
            mediaId,
            mediaType: 'IMAGE',
            status: { in: ['PENDING', 'PROCESSING'] }
          },
          data: {
            status: this.mapStatus(status),
            progress: status === 'COMPLETED' ? 100 : 0,
            currentStep: status === 'COMPLETED' ? 'completed' : 'failed',
            errorMessage: error,
            imageVersions: result?.metadata?.imageVersions ? JSON.stringify(result.metadata.imageVersions) : undefined,
            metadata: result?.metadata ? JSON.stringify(result.metadata) : undefined,
            completedAt: new Date()
          }
        })
        
        console.log(`🖼️ [IMAGE-SERVICE] Updated ${jobUpdate.count} processing jobs for result`)

        // Update media record with processing results
        if (status === 'COMPLETED' && result) {
          console.log(`🖼️ [IMAGE-SERVICE] Updating media record for completed processing`)
          console.log(`🖼️ [IMAGE-SERVICE] Result data:`, JSON.stringify(result, null, 2))
          
          const mediaUpdateData: any = {
            imageProcessingStatus: 'COMPLETED'
          }

          // Handle the new result format from unified processor
          if (result.s3Key) {
            // Use the result data directly
            mediaUpdateData.url = result.s3Key
            mediaUpdateData.thumbnail = result.thumbnailS3Key || result.s3Key
            mediaUpdateData.thumbnailS3Key = result.thumbnailS3Key || result.s3Key
            
            if (result.width && result.height) {
              mediaUpdateData.width = result.width
              mediaUpdateData.height = result.height
            }
            
            if (result.metadata) {
              mediaUpdateData.imageMetadata = JSON.stringify(result.metadata)
            }
            
            console.log(`🖼️ [IMAGE-SERVICE] Media update data:`, JSON.stringify(mediaUpdateData, null, 2))
          } else if (result.metadata?.imageVersions) {
            // Handle legacy format with imageVersions array
            const imageVersions = result.metadata.imageVersions
            mediaUpdateData.imageVersions = JSON.stringify(imageVersions)
            
            const thumbnailVersion = imageVersions.find((version: any) => version.quality === 'thumbnail')
            const highQualityVersion = imageVersions.find((version: any) => version.quality === '1080p')
            const mediumQualityVersion = imageVersions.find((version: any) => version.quality === '720p')
            
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
            } else if (imageVersions.length > 0) {
              // Fallback to first available version
              const firstVersion = imageVersions[0]
              mediaUpdateData.url = firstVersion.s3Key
              mediaUpdateData.size = firstVersion.fileSize
            }
            
            // Use original corrected dimensions from metadata (with EXIF orientation applied)
            if (result.metadata?.width && result.metadata?.height) {
              mediaUpdateData.width = result.metadata.width
              mediaUpdateData.height = result.metadata.height
            } else if (highQualityVersion) {
              // Fallback to processed version dimensions if metadata not available
              mediaUpdateData.width = highQualityVersion.width
              mediaUpdateData.height = highQualityVersion.height
            } else if (mediumQualityVersion) {
              mediaUpdateData.width = mediumQualityVersion.width
              mediaUpdateData.height = mediumQualityVersion.height
            } else if (imageVersions.length > 0) {
              const firstVersion = imageVersions[0]
              mediaUpdateData.width = firstVersion.width
              mediaUpdateData.height = firstVersion.height
            }
          }

          // Update the media record
          const updatedMedia = await this.prisma.media.update({
            where: { id: mediaId },
            data: mediaUpdateData
          })
          
          console.log(`🖼️ [IMAGE-SERVICE] Updated media record:`, JSON.stringify(updatedMedia, null, 2))
          logger.info(`Image processing completed for media ${mediaId}`)
        } else if (status === 'FAILED') {
          await this.prisma.media.update({
            where: { id: mediaId },
            data: {
              imageProcessingStatus: 'FAILED'
            }
          })
          logger.error(`Image processing failed for media ${mediaId}: ${error}`)
        }
      }

    } catch (error) {
      logger.error(`Error handling image processing update for media ${update.mediaId}:`, error)
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