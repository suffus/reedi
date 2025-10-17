import { PrismaClient } from '@prisma/client'
import { BaseMediaProcessingService } from './baseMediaProcessingService'
import { MediaProcessingMessage, MediaProcessingRequest, MediaProgressUpdate, MediaProcessingResult } from '../types/media-processing'
import { v4 as uuidv4 } from 'uuid'
import logger from '../utils/logger'

export class ZipProcessingService extends BaseMediaProcessingService {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient, skipQueueConsumption: boolean = false) {
    super('zip', skipQueueConsumption)
    this.prisma = prisma
  }

  async start(): Promise<void> {
    await super.start()
    
    // Set up update callback
    this.setUpdateCallback((update: MediaProcessingMessage) => this.handleProgressUpdate(update))

    logger.info('Zip processing service started')
  }

  async requestZipProcessing(
    mediaId: string,
    userId: string,
    s3Key: string,
    originalFilename: string,
    mimeType: string,
    fileSize: number,
    options?: {
      preserveStructure?: boolean
      maxFileSize?: number
      allowedTypes?: string[]
    }
  ): Promise<string> {
    const jobId = uuidv4()

    try {
      // Create job record in database
      await this.prisma.mediaProcessingJob.create({
        data: {
          id: jobId,
          mediaId: mediaId,
          userId: userId,
          mediaType: 'IMAGE', // Use IMAGE as fallback since ZIP is not in enum yet
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
          options: options || {}
        }
      })

      logger.info(`Created zip processing job ${jobId} for media ${mediaId}`)
      return jobId

    } catch (error) {
      logger.error(`Failed to create zip processing job for media ${mediaId}:`, error)
      throw error
    }
  }

  async handleProgressUpdate(update: MediaProcessingMessage): Promise<void> {
    try {
      if (update.messageType === 'progress') {
        const progressUpdate = update as MediaProgressUpdate
        const { mediaId, status, progress, stage, details } = progressUpdate
        
        // Extract job ID from metadata if available
        const jobId = details?.jobId || `zip_${mediaId}`
        
        logger.info(`Zip processing update for job ${jobId}: ${status} (${progress}%)`)
        
        // Update processing job
        await this.prisma.mediaProcessingJob.updateMany({
          where: { 
            mediaId,
            mediaType: 'IMAGE', // Use IMAGE as fallback since ZIP is not in enum yet
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
            processingStatus: this.mapStatus(status)
          }
        })

      } else if (update.messageType === 'result') {
        const resultUpdate = update as MediaProcessingResult
        const { mediaId, status, result, error } = resultUpdate
        
        // Extract job ID from metadata if available
        const jobId = result?.metadata?.jobId || `zip_${mediaId}`
        
        console.log(`📦 [ZIP-SERVICE] Processing result message for media ${mediaId}`)
        console.log(`📦 [ZIP-SERVICE] Status: ${status}`)
        console.log(`📦 [ZIP-SERVICE] Result:`, JSON.stringify(result, null, 2))
        
        logger.info(`Zip processing result for job ${jobId}: ${status}`)
        
        // Update processing job
        await this.prisma.mediaProcessingJob.updateMany({
          where: { 
            mediaId,
            mediaType: 'IMAGE', // Use IMAGE as fallback since ZIP is not in enum yet
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
            processingStatus: 'COMPLETED'
          }

          // Store zip processing metadata
          if (result.metadata) {
            mediaUpdateData.zipMetadata = JSON.stringify(result.metadata)
          }

          // Store extracted media count
          if (result.metadata?.extractedCount) {
            mediaUpdateData.extractedMediaCount = result.metadata.extractedCount
          }

          await this.prisma.media.update({
            where: { id: mediaId },
            data: mediaUpdateData
          })

          // Create individual media records for extracted files
          if (result.extractedMedia && result.extractedMedia.length > 0) {
            const extractedUserId = result.metadata?.userId || resultUpdate.userId
            console.log(`📦 [ZIP-SERVICE] Creating ${result.extractedMedia.length} extracted media records`)
            console.log(`📦 [ZIP-SERVICE] User ID: ${extractedUserId}`)
            console.log(`📦 [ZIP-SERVICE] Extracted media:`, JSON.stringify(result.extractedMedia, null, 2))
            await this.createExtractedMediaRecords(mediaId, extractedUserId, result.extractedMedia)
          } else {
            console.log(`📦 [ZIP-SERVICE] No extracted media to create records for`)
          }

          logger.info(`Zip processing completed for media ${mediaId}`)
          if (result.extractedMedia) {
            logger.info(`Created ${result.extractedMedia.length} extracted media records`)
          }
        } else if (status === 'FAILED') {
          await this.prisma.media.update({
            where: { id: mediaId },
            data: {
              processingStatus: 'FAILED'
            }
          })
          logger.error(`Zip processing failed for media ${mediaId}: ${error}`)
        }
      }

    } catch (error) {
      logger.error(`Error handling zip processing update for media ${update.mediaId}:`, error)
    }
  }

  private async createExtractedMediaRecords(
    zipMediaId: string,
    userId: string,
    extractedMedia: Array<{
      s3Key: string
      thumbnailS3Key?: string
      originalFilename: string
      mimeType: string
      width?: number
      height?: number
      duration?: number
      versions?: Array<{
        quality: string
        s3Key: string
        width: number
        height: number
        fileSize: number
        mimeType: string
      }>
      metadata?: Record<string, any>
    }>
  ): Promise<void> {
    try {
      console.log(`📦 [ZIP-SERVICE] Creating media records for ${extractedMedia.length} extracted files`)
      console.log(`📦 [ZIP-SERVICE] Zip Media ID: ${zipMediaId}`)
      console.log(`📦 [ZIP-SERVICE] User ID: ${userId}`)
      
      const mediaRecords = extractedMedia.map((media, index) => {
        console.log(`📦 [ZIP-SERVICE] Processing media ${index + 1}: ${media.originalFilename}`)
        const isVideo = media.mimeType.startsWith('video/')
        const mediaType = isVideo ? 'VIDEO' : 'IMAGE'
        
        // Store versions in appropriate metadata field
        const versionMetadata = media.versions ? {
          [isVideo ? 'videoVersions' : 'imageVersions']: media.versions
        } : {}

        return {
          url: media.s3Key,
          s3Key: media.s3Key,
          thumbnailS3Key: media.thumbnailS3Key,
          originalFilename: media.originalFilename,
          altText: `Extracted from zip: ${media.originalFilename}`,
          caption: '',
          tags: ['extracted-from-zip'],
          size: Math.ceil((media.metadata?.fileSize || 0) / 1024), // Convert bytes to kilobytes
          mimeType: media.mimeType,
          mediaType: mediaType as 'VIDEO' | 'IMAGE',
          processingStatus: 'COMPLETED' as 'COMPLETED',
          width: media.width,
          height: media.height,
          duration: media.duration,
          authorId: userId,
          zipMediaId: zipMediaId, // Link to the original zip file
          visibility: 'PRIVATE' as 'PRIVATE', // Default to private for extracted files
          // Store versions in appropriate metadata field
          ...(isVideo ? { videoVersions: versionMetadata.videoVersions } : { imageVersions: versionMetadata.imageVersions }),
          // Store processing metadata
          ...(isVideo ? { videoMetadata: media.metadata } : { imageMetadata: media.metadata })
        }
      })

      console.log(`📦 [ZIP-SERVICE] About to create ${mediaRecords.length} media records`)
      console.log(`📦 [ZIP-SERVICE] Sample record:`, JSON.stringify(mediaRecords[0], null, 2))
      
      const result = await this.prisma.media.createMany({
        data: mediaRecords
      })

      console.log(`📦 [ZIP-SERVICE] Database createMany result:`, result)
      logger.info(`Created ${mediaRecords.length} extracted media records for zip ${zipMediaId}`)
    } catch (error) {
      console.error(`📦 [ZIP-SERVICE] Error creating extracted media records:`, error)
      logger.error(`Failed to create extracted media records for zip ${zipMediaId}:`, error)
      throw error
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

  async getProcessingStatus(mediaId: string): Promise<any> {
    try {
      const job = await this.prisma.mediaProcessingJob.findFirst({
        where: { 
          mediaId,
          mediaType: 'IMAGE' // Use IMAGE as fallback since ZIP is not in enum yet
        },
        orderBy: { createdAt: 'desc' }
      })

      if (!job) {
        return null
      }

      return {
        jobId: job.id,
        mediaId: job.mediaId,
        status: job.status,
        progress: job.progress,
        currentStep: job.currentStep,
        error: job.errorMessage,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      }

    } catch (error) {
      logger.error(`Failed to get processing status for media ${mediaId}:`, error)
      throw error
    }
  }

  async cancelProcessing(mediaId: string): Promise<void> {
    // Update job status to failed
    await this.prisma.mediaProcessingJob.updateMany({
      where: { 
        mediaId, 
        mediaType: 'IMAGE', // Use IMAGE as fallback since ZIP is not in enum yet
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
        processingStatus: 'FAILED'
      }
    })

    logger.info(`Zip processing cancelled for media ${mediaId}`)
  }
}