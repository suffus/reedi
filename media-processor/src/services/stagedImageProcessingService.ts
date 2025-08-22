import { EnhancedRabbitMQService, QueueConfig, ProgressUpdate } from './enhancedRabbitMQService'
import { S3ProcessorService } from './s3ProcessorService'
import { StandaloneImageProcessor } from '../standaloneImageProcessor'
import { 
  ProcessingStage, 
  StageResult, 
  ImageMetadata, 
  ProcessingOutput
} from '../types/stagedProcessing'
import logger from '../utils/logger'
import { TempFileTracker } from '../utils/tempFileTracker'
import * as fs from 'fs'
import * as path from 'path'

export class StagedImageProcessingService {
  private rabbitmqService: EnhancedRabbitMQService
  private s3Service: S3ProcessorService
  private imageProcessor: StandaloneImageProcessor
  private queueConfig: QueueConfig
  private tempDir: string
  private tempFileTracker: TempFileTracker
  
  // Concurrency control
  private maxConcurrentJobs: number
  private activeJobs: Set<string> = new Set()
  private jobCallbacks: Map<string, (message: any) => Promise<void>> = new Map()

  constructor(
    rabbitmqService: EnhancedRabbitMQService,
    s3Service: S3ProcessorService,
    tempDir: string = '/tmp',
    maxConcurrentJobs: number = 3
  ) {
    this.rabbitmqService = rabbitmqService
    this.s3Service = s3Service
    this.imageProcessor = new StandaloneImageProcessor(tempDir, tempDir)
    this.queueConfig = rabbitmqService.getQueueConfig()
    this.tempDir = tempDir
    this.maxConcurrentJobs = maxConcurrentJobs
    this.tempFileTracker = new TempFileTracker(tempDir)
  }

  async start(): Promise<void> {
    await this.rabbitmqService.connect()
    
    // Store callbacks for later resubscription
    this.jobCallbacks.set(this.queueConfig.download, async (job) => {
      await this.handleDownloadStage(job)
    })
    this.jobCallbacks.set(this.queueConfig.processing, async (job) => {
      await this.handleProcessingStage(job)
    })
    this.jobCallbacks.set(this.queueConfig.upload, async (job) => {
      await this.handleUploadStage(job)
    })
    
    // Start consumers for each stage
    await this.rabbitmqService.consumeQueue(
      this.queueConfig.download,
      this.jobCallbacks.get(this.queueConfig.download)!
    )
    
    await this.rabbitmqService.consumeQueue(
      this.queueConfig.processing,
      this.jobCallbacks.get(this.queueConfig.processing)!
    )
    
    await this.rabbitmqService.consumeQueue(
      this.queueConfig.upload,
      this.jobCallbacks.get(this.queueConfig.upload)!
    )

    logger.info('Staged image processing service started')
  }

  async stop(): Promise<void> {
    await this.rabbitmqService.close()
    logger.info('Staged image processing service stopped')
  }

  private async checkConcurrencyAndManageSubscriptions(): Promise<void> {
    const currentActiveJobs = this.activeJobs.size
    const isAtCapacity = currentActiveJobs >= this.maxConcurrentJobs
    
    logger.info(`Concurrency check: ${currentActiveJobs}/${this.maxConcurrentJobs} active jobs, at capacity: ${isAtCapacity}`)
    
    if (isAtCapacity) {
      // Unsubscribe from all queues when at capacity
      await this.unsubscribeFromAllQueues()
    } else {
      // Resubscribe to all queues when below capacity
      await this.resubscribeToAllQueues()
    }
  }

  private async unsubscribeFromAllQueues(): Promise<void> {
    const queues = [this.queueConfig.download, this.queueConfig.processing, this.queueConfig.upload]
    
    for (const queueName of queues) {
      if (this.rabbitmqService.isSubscribedToQueue(queueName)) {
        try {
          await this.rabbitmqService.unsubscribeFromQueue(queueName)
          logger.info(`Unsubscribed from queue ${queueName} due to capacity limit`)
        } catch (error) {
          logger.error(`Failed to unsubscribe from queue ${queueName}:`, error)
        }
      }
    }
  }

  private async resubscribeToAllQueues(): Promise<void> {
    const queues = [this.queueConfig.download, this.queueConfig.processing, this.queueConfig.upload]
    
    for (const queueName of queues) {
      if (!this.rabbitmqService.isSubscribedToQueue(queueName)) {
        try {
          const callback = this.jobCallbacks.get(queueName)
          if (callback) {
            await this.rabbitmqService.resubscribeToQueue(queueName, callback)
            logger.info(`Resubscribed to queue ${queueName} - capacity available`)
          }
        } catch (error) {
          logger.error(`Failed to resubscribe to queue ${queueName}:`, error)
        }
      }
    }
  }

  private async startJob(jobId: string): Promise<void> {
    this.activeJobs.add(jobId)
    logger.info(`Started job ${jobId}, active jobs: ${this.activeJobs.size}`)
    
    // Check if we need to manage subscriptions
    await this.checkConcurrencyAndManageSubscriptions()
  }

  private async finishJob(jobId: string): Promise<void> {
    this.activeJobs.delete(jobId)
    logger.info(`Finished job ${jobId}, active jobs: ${this.activeJobs.size}`)
    
    // Check if we can resubscribe to queues
    await this.checkConcurrencyAndManageSubscriptions()
  }

  getActiveJobCount(): number {
    return this.activeJobs.size
  }

  /**
   * Get temp file statistics for monitoring
   */
  getTempFileStats() {
    return this.tempFileTracker.getSummary()
  }

  /**
   * Clean up orphaned temp files
   */
  async cleanupOrphanedTempFiles() {
    return await this.tempFileTracker.cleanupOrphanedFiles()
  }

  private async handleDownloadStage(job: any): Promise<void> {
    // Handle both StagedProcessingJob and ImageProcessingRequest formats
    const jobId = job.id || job.job_id
    const mediaId = job.mediaId || job.media_id
    const s3Key = job.s3Key || job.s3_key
    
    // Debug logging to see what we received
    logger.info(`Received job data: ${JSON.stringify(job)}`)
    logger.info(`Extracted jobId: ${jobId}, mediaId: ${mediaId}, s3Key: ${s3Key}`)
    
    let localImagePath: string | undefined
    
    try {
      await this.startJob(jobId)
      logger.info(`Starting download stage for job ${jobId}, media ${mediaId}`)
      
      // Update status to downloading
      await this.sendProgressUpdate(jobId, mediaId, 'processing', 0, 'downloading_image')
      
      // Download image from S3
      localImagePath = await this.s3Service.downloadImage(s3Key)
      
      // Extract basic metadata
      const metadata = await this.extractBasicMetadata(localImagePath)
      
      // Create result for next stage
      const result: StageResult = {
        success: true,
        stage: 'DOWNLOADED',
        mediaId,
        jobId,
        localMediaPath: localImagePath,
        metadata
      }
      
      // Send progress update
      await this.sendProgressUpdate(jobId, mediaId, 'processing', 20, 'download_complete')
      
      // Send to next stage (processing)
      await this.sendToNextStage(result, 'PROCESSING')
      
      logger.info(`Download stage completed for job ${jobId}`)
      
    } catch (error) {
      logger.error(`Download stage failed for job ${jobId}:`, error)
      
      // Clean up any temp files that might have been created during download
      await this.cleanupJobTempFiles(jobId, mediaId, localImagePath)
      
      const result: StageResult = {
        success: false,
        stage: 'FAILED',
        mediaId,
        jobId,
        error: error instanceof Error ? error.message : 'Download failed'
      }
      
      await this.sendProgressUpdate(jobId, mediaId, 'failed', 0, 'download_failed', undefined, undefined, result.error)
      await this.sendToNextStage(result, 'FAILED')
    } finally {
      await this.finishJob(jobId)
    }
  }

  private async handleProcessingStage(job: any): Promise<void> {
    // Handle both StagedProcessingJob and ImageProcessingRequest formats
    const jobId = job.jobId
    const mediaId = job.mediaId
    const localMediaPath = job.localMediaPath
    //const metadata = job.metadata
    
    try {
      await this.startJob(jobId)
      logger.info(`Starting processing stage for job ${jobId}, media ${mediaId}`)
      
      // Update status to processing
      await this.sendProgressUpdate(jobId, mediaId, 'processing', 20, 'processing_image')
      
      if (!localMediaPath) {
        throw new Error('No local image path provided')
      }
      
      // Process image
      const result = await this.imageProcessor.processImage(localMediaPath, mediaId)
      
      if (!result.success) {
        throw new Error(result.error || 'Image processing failed')
      }
      
      // Create result for next stage
      const stageResult: StageResult = {
        success: true,
        stage: 'PROCESSED',
        mediaId,
        jobId,
        localMediaPath,
        metadata: result.metadata,
        outputs: result.outputs
      }
      
      // Send progress update
      await this.sendProgressUpdate(jobId, mediaId, 'processing', 80, 'processing_complete')
      
      // Send to next stage (upload)
      await this.sendToNextStage(stageResult, 'UPLOADING')
      
      logger.info(`Processing stage completed for job ${jobId}`)
      
    } catch (error) {
      logger.error(`Processing stage failed for job ${jobId}:`, error)
      
      // Clean up any files on failure
      await this.cleanupJobTempFiles(jobId, mediaId, localMediaPath)
      
      const result: StageResult = {
        success: false,
        stage: 'FAILED',
        mediaId,
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      
      await this.sendProgressUpdate(jobId, mediaId, 'failed', 0, 'processing_failed', undefined, undefined, error instanceof Error ? error.message : 'Unknown error')
      await this.sendToNextStage(result, 'FAILED')
    } finally {
      await this.finishJob(jobId)
    }
  }

  private async handleUploadStage(job: any): Promise<void> {
    // Handle both StagedProcessingJob and ImageProcessingRequest formats
    const jobId = job.jobId || job.id || job.job_id
    const mediaId = job.mediaId || job.media_id
    const outputs = job.outputs
    
    try {
      await this.startJob(jobId)
      logger.info(`Starting upload stage for job ${jobId}, media ${mediaId}`)
      
      // Update status to uploading
      await this.sendProgressUpdate(jobId, mediaId, 'processing', 80, 'uploading_results')
      
      if (!outputs || outputs.length === 0) {
        throw new Error('No outputs to upload')
      }
      
      // Upload results to S3
      const uploadResults = await this.uploadResults(jobId, mediaId, outputs)
      
      // Send final progress update
      await this.sendProgressUpdate(
        jobId, 
        mediaId, 
        'completed', 
        100, 
        'upload_complete',
        uploadResults.imageVersions,
        job.metadata as ImageMetadata
      )
      
      // Clean up temp files using the comprehensive cleanup method
      await this.cleanupJobTempFiles(jobId, mediaId, job.localMediaPath, outputs)
      
      logger.info(`Upload stage completed for job ${jobId}`)
      
    } catch (error) {
      logger.error(`Upload stage failed for job ${jobId}:`, error)
      
      // Clean up any files on failure
      await this.cleanupJobTempFiles(jobId, mediaId, job.localMediaPath, outputs)
      
      await this.sendProgressUpdate(jobId, mediaId, 'failed', 0, 'upload_failed', undefined, undefined, error instanceof Error ? error.message : 'Unknown error')
    } finally {
      await this.finishJob(jobId)
    }
  }

  private async extractBasicMetadata(imagePath: string): Promise<ImageMetadata> {
    const sharp = require('sharp')
    const metadata = await sharp(imagePath).metadata()
    
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      fileSize: fs.statSync(imagePath).size,
      mimeType: metadata.format ? `image/${metadata.format}` : 'image/jpeg',
      format: metadata.format || 'jpeg',
      colorSpace: metadata.space,
      hasAlpha: metadata.hasAlpha || false
    }
  }

  private async uploadResults(
    jobId: string,
    mediaId: string,
    outputs: ProcessingOutput[]
  ): Promise<{ imageVersions: any[] }> {
    const imageVersions: any[] = []
    
    logger.info(`Uploading ${outputs.length} outputs for job ${jobId}`)
    
    for (const output of outputs) {
      logger.info(`Processing output: ${output.type} - ${output.s3Key}`)
      
      if (output.type === 'image_scaled' || output.type === 'thumbnail') {
        // Use the localPath property directly from the output
        const localPath = (output as any).localPath
        if (localPath && fs.existsSync(localPath)) {
          logger.info(`Found local file: ${localPath}, uploading to S3: ${output.s3Key}`)
          
          // Upload to S3
          await this.s3Service.uploadImage(localPath, output.s3Key)
          
          imageVersions.push({
            s3Key: output.s3Key,
            quality: output.quality,
            width: output.width,
            height: output.height,
            fileSize: output.fileSize,
            mimeType: output.mimeType
          })
          
          // Note: Cleanup is now handled by cleanupJobTempFiles in the stage handlers
          logger.info(`Successfully uploaded: ${output.s3Key}`)
        } else {
          logger.warn(`Local file not found for: ${output.s3Key} at path: ${localPath}`)
        }
      }
    }
    
    logger.info(`Uploaded ${imageVersions.length} versions for job ${jobId}`)
    return { imageVersions }
  }

  private async sendToNextStage(result: StageResult, nextStage: ProcessingStage): Promise<void> {
    const queue = this.getQueueForStage(nextStage)
    const jobId = result.jobId || (result as any).id || (result as any).job_id
    const mediaId = result.mediaId || (result as any).media_id
    
    const job = {
      ...result,
      job_id: jobId,
      media_id: mediaId,
      stage: nextStage,
      previousStage: result.stage
    }
    
    await this.rabbitmqService.sendMessage(queue, job)
  }

  private getQueueForStage(stage: ProcessingStage): string {
    switch (stage) {
      case 'DOWNLOADING':
      case 'DOWNLOADED':
        return this.queueConfig.download
      case 'PROCESSING':
      case 'PROCESSED':
        return this.queueConfig.processing
      case 'UPLOADING':
      case 'COMPLETED':
        return this.queueConfig.upload
      case 'FAILED':
        return this.queueConfig.updates
      default:
        return this.queueConfig.updates
    }
  }

  private async sendProgressUpdate(
    jobId: string,
    mediaId: string,
    status: 'processing' | 'completed' | 'failed',
    progress: number,
    currentStep?: string,
    imageVersions?: any[],
    metadata?: ImageMetadata,
    errorMessage?: string
  ): Promise<void> {
    const update: ProgressUpdate = {
      type: 'image_processing_update',
      job_id: jobId || "unknown",
      media_id: mediaId || "unknown",
      status,
      progress,
      current_step: currentStep,
      image_versions: imageVersions,
      metadata,
      error_message: errorMessage,
      timestamp: new Date().toISOString()
    }
    
    await this.rabbitmqService.publishProgressUpdate( update )
  }

  /**
   * Comprehensive cleanup of all temporary files for a job
   */
  private async cleanupJobTempFiles(
    jobId: string, 
    mediaId: string, 
    originalImagePath?: string, 
    outputs?: ProcessingOutput[]
  ): Promise<void> {
    try {
      const filesToCleanup: string[] = []
      
      // Add original image file if it exists
      if (originalImagePath && fs.existsSync(originalImagePath)) {
        filesToCleanup.push(originalImagePath)
      }
      
      // Add all output files that were created during processing
      if (outputs) {
        for (const output of outputs) {
          const localPath = (output as any).localPath
          if (localPath && fs.existsSync(localPath)) {
            filesToCleanup.push(localPath)
          }
        }
      }
      
      // Clean up all files
      for (const filePath of filesToCleanup) {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
            logger.debug(`Cleaned up temp file: ${filePath}`)
          }
        } catch (error) {
          logger.warn(`Failed to clean up temp file ${filePath}:`, error)
        }
      }
      
      logger.info(`Cleaned up ${filesToCleanup.length} temp files for job ${jobId}`)
      
    } catch (error) {
      logger.warn(`Error during cleanup for job ${jobId}:`, error)
    }
  }

  /**
   * Periodic cleanup of old temporary files
   * This can be called periodically to clean up any files that might have been left behind
   */
  async cleanupOldTempFiles(maxAgeHours: number = 24): Promise<void> {
    try {
      if (!fs.existsSync(this.tempDir)) {
        return
      }
      
      const now = Date.now()
      const maxAgeMs = maxAgeHours * 60 * 60 * 1000
      let cleanedCount = 0
      
      const files = fs.readdirSync(this.tempDir)
      for (const file of files) {
        const filePath = path.join(this.tempDir, file)
        try {
          if (fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath)
            if (stat.isFile()) {
              const fileAge = now - stat.mtime.getTime()
              if (fileAge > maxAgeMs) {
                fs.unlinkSync(filePath)
                cleanedCount++
                logger.debug(`Cleaned up old temp file: ${filePath} (age: ${Math.round(fileAge / 1000 / 60)} minutes)`)
              }
            }
          }
        } catch (error) {
          logger.warn(`Failed to clean up old file ${filePath}:`, error)
        }
      }
      
      if (cleanedCount > 0) {
        logger.info(`Periodic cleanup completed: removed ${cleanedCount} old temp files`)
      }
      
    } catch (error) {
      logger.warn(`Error during periodic cleanup:`, error)
    }
  }

  /**
   * Emergency cleanup - remove all temporary files
   * Use this only when you need to clear all temp files
   */
  async emergencyCleanup(): Promise<void> {
    try {
      if (!fs.existsSync(this.tempDir)) {
        return
      }
      
      const files = fs.readdirSync(this.tempDir)
      let cleanedCount = 0
      
      for (const file of files) {
        const filePath = path.join(this.tempDir, file)
        try {
          if (fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath)
            if (stat.isFile()) {
              fs.unlinkSync(filePath)
              cleanedCount++
            }
          }
        } catch (error) {
          logger.warn(`Failed to clean up file ${filePath}:`, error)
        }
      }
      
      logger.info(`Emergency cleanup completed: removed ${cleanedCount} temp files`)
      
    } catch (error) {
      logger.error(`Error during emergency cleanup:`, error)
    }
  }


} 