import { EnhancedRabbitMQService, QueueConfig } from './enhancedRabbitMQService'
import { S3ProcessorService } from './s3ProcessorService'
import { StandaloneVideoProcessor } from '../standaloneVideoProcessor'
import { 
  StagedProcessingJob, 
  ProcessingStage, 
  StageResult, 
  VideoMetadata, 
  ProcessingOutput
} from '../types/stagedProcessing'
import logger from '../utils/logger'
import { TempFileTracker } from '../utils/tempFileTracker'
import * as fs from 'fs'
import * as path from 'path'

export class StagedVideoProcessingService {
  private rabbitmqService: EnhancedRabbitMQService
  private s3Service: S3ProcessorService
  private videoProcessor: StandaloneVideoProcessor
  private tempDir: string
  private queueConfig: QueueConfig
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
    this.videoProcessor = new StandaloneVideoProcessor(tempDir, tempDir)
    this.tempDir = tempDir
    this.queueConfig = rabbitmqService.getQueueConfig()
    this.maxConcurrentJobs = maxConcurrentJobs
    this.tempFileTracker = new TempFileTracker(tempDir)
  }

  async start(): Promise<void> {
    await this.rabbitmqService.connect()
    
    // Store callbacks for later resubscription
    this.jobCallbacks.set(this.queueConfig.download, (job) => this.handleDownloadStage(job))
    this.jobCallbacks.set(this.queueConfig.processing, (job) => this.handleProcessingStage(job))
    this.jobCallbacks.set(this.queueConfig.upload, (job) => this.handleUploadStage(job))
    this.jobCallbacks.set(this.queueConfig.cleanup, (job) => this.handleCleanupStage(job))
    
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
    
    await this.rabbitmqService.consumeQueue(
      this.queueConfig.cleanup,
      this.jobCallbacks.get(this.queueConfig.cleanup)!
    )

    logger.info('Staged video processing service started')
  }

  async stop(): Promise<void> {
    await this.rabbitmqService.close()
    logger.info('Staged video processing service stopped')
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
    const queues = [this.queueConfig.download, this.queueConfig.processing, this.queueConfig.upload, this.queueConfig.cleanup]
    
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
    const queues = [this.queueConfig.download, this.queueConfig.processing, this.queueConfig.upload, this.queueConfig.cleanup]
    
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

  private async handleDownloadStage(job: StagedProcessingJob): Promise<void> {
    const { id: jobId, mediaId, s3Key } = job
    
    try {
      await this.startJob(jobId)
      logger.info(`Starting download stage for job ${jobId}, media ${mediaId}`)
      
      // Update status to downloading
      await this.sendProgressUpdate(jobId, mediaId, 'processing', 0, 'downloading_video')
      
      // Download video from S3
      const localVideoPath = await this.s3Service.downloadVideo(s3Key)
      
      // Track the downloaded file
      this.tempFileTracker.trackFile(jobId, localVideoPath, 'DOWNLOADED', 'input', 'Original video downloaded from S3')
      
      // Extract basic metadata
      const metadata = await this.extractBasicMetadata(localVideoPath)
      
      // Create result for next stage
      const result: StageResult = {
        success: true,
        stage: 'DOWNLOADED',
        mediaId,
        jobId,
        localMediaPath: localVideoPath,
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
      await this.cleanupJobTempFiles(jobId, mediaId)
      
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

  private async handleProcessingStage(job: StagedProcessingJob): Promise<void> {
    const { id: jobId, mediaId, localMediaPath } = job
    const localVideoPath = localMediaPath as string
    
    if (!localVideoPath) {
      logger.error(`No local video path for job ${jobId}`)
      await this.finishJob(jobId)
      return
    }
    
    try {
      await this.startJob(jobId)
      logger.info(`Starting processing stage for job ${jobId}, media ${mediaId}`)
      
      // Update status to processing
      await this.sendProgressUpdate(jobId, mediaId, 'processing', 30, 'processing_video')
      
      // Process video with FFmpeg
      const result = await this.videoProcessor.processVideo(localVideoPath, mediaId)
      
      if (!result.success) {
        throw new Error(result.error || 'Video processing failed')
      }
      
      // Track all generated output files
      if (result.outputs) {
        for (const output of result.outputs) {
          if (output.localPath) {
            this.tempFileTracker.trackFile(
              jobId, 
              output.localPath, 
              'PROCESSED', 
              'output', 
              `Generated ${output.type} file: ${output.quality || 'default'}`
            )
          }
        }
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
      await this.sendProgressUpdate(jobId, mediaId, 'processing', 70, 'processing_complete')
      
      // Send to next stage (upload)
      await this.sendToNextStage(stageResult, 'UPLOADING')
      
      logger.info(`Processing stage completed for job ${jobId}`)
      
    } catch (error) {
      logger.error(`Processing stage failed for job ${jobId}:`, error)
      
      // Clean up temp files on processing failure
      await this.cleanupJobTempFiles(jobId, mediaId, localVideoPath)
      
      const result: StageResult = {
        success: false,
        stage: 'FAILED',
        mediaId,
        jobId,
        error: error instanceof Error ? error.message : 'Processing failed'
      }
      
      await this.sendProgressUpdate(jobId, mediaId, 'failed', 0, 'processing_failed', undefined, undefined, result.error)
      await this.sendToNextStage(result, 'FAILED')
    } finally {
      await this.finishJob(jobId)
    }
  }

  private async handleUploadStage(job: StagedProcessingJob): Promise<void> {
    const { id: jobId, mediaId, outputs, localMediaPath } = job
    
    if (!outputs || outputs.length === 0) {
      logger.error(`No outputs for job ${jobId}`)
      await this.finishJob(jobId)
      return
    }
    
    try {
      await this.startJob(jobId)
      logger.info(`Starting upload stage for job ${jobId}, media ${mediaId}`)
      
      // Update status to uploading
      await this.sendProgressUpdate(jobId, mediaId, 'processing', 80, 'uploading_results')
      
      // Upload processed files to S3
      const { thumbnails, videoVersions } = await this.uploadResults(jobId, mediaId, outputs)
      
      // Create result for cleanup stage
      const result: StageResult = {
        success: true,
        stage: 'UPLOADED',
        mediaId,
        jobId,
        tempFiles: this.tempFileTracker.getJobTempFiles(jobId)
      }
      
      // Send completion update
      await this.sendProgressUpdate(
        jobId,
        mediaId,
        'completed',
        100,
        'upload_complete',
        thumbnails,
        undefined, // metadata
        undefined, // errorMessage
        videoVersions
      )
      
      // Send to cleanup stage
      await this.sendToNextStage(result, 'CLEANUP')
      
      logger.info(`Upload stage completed for job ${jobId}`)
      
    } catch (error) {
      logger.error(`Upload stage failed for job ${jobId}:`, error)
      
      // Clean up temp files on upload failure
      await this.cleanupJobTempFiles(jobId, mediaId, localMediaPath)
      
      const result: StageResult = {
        success: false,
        stage: 'FAILED',
        mediaId,
        jobId,
        error: error instanceof Error ? error.message : 'Upload failed'
      }
      
      await this.sendProgressUpdate(jobId, mediaId, 'failed', 0, 'upload_failed', undefined, undefined, result.error)
      await this.sendToNextStage(result, 'FAILED')
    } finally {
      await this.finishJob(jobId)
    }
  }

  private async handleCleanupStage(job: StagedProcessingJob): Promise<void> {
    const { id: jobId, mediaId } = job
    
    try {
      await this.startJob(jobId)
      logger.info(`Starting cleanup stage for job ${jobId}, media ${mediaId}`)
      
      // Clean up all temp files for this job
      const { cleaned, totalSize } = await this.tempFileTracker.cleanupJobTempFiles(jobId)
      
      logger.info(`Cleanup stage completed for job ${jobId}: cleaned ${cleaned} files, freed ${Math.round(totalSize / 1024 / 1024)} MB`)
      
      // Create final completion result
      const result: StageResult = {
        success: true,
        stage: 'COMPLETED',
        mediaId,
        jobId
      }
      
      // Send to final completion stage
      await this.sendToNextStage(result, 'COMPLETED')
      
    } catch (error) {
      logger.error(`Cleanup stage failed for job ${jobId}:`, error)
      
      // Even if cleanup fails, try to clean up temp files manually
      try {
        await this.cleanupJobTempFiles(jobId, mediaId)
      } catch (cleanupError) {
        logger.error(`Manual cleanup also failed for job ${jobId}:`, cleanupError)
      }
      
      const result: StageResult = {
        success: false,
        stage: 'FAILED',
        mediaId,
        jobId,
        error: error instanceof Error ? error.message : 'Cleanup failed'
      }
      
      await this.sendToNextStage(result, 'FAILED')
    } finally {
      await this.finishJob(jobId)
    }
  }

  /**
   * Comprehensive cleanup of all temporary files for a job
   */
  private async cleanupJobTempFiles(
    jobId: string, 
    mediaId: string, 
    originalVideoPath?: string, 
    outputs?: ProcessingOutput[]
  ): Promise<void> {
    try {
      const filesToCleanup: string[] = []
      
      // Add original video file if it exists
      if (originalVideoPath && fs.existsSync(originalVideoPath)) {
        filesToCleanup.push(originalVideoPath)
      }
      
      // Add all output files that were created during processing
      if (outputs) {
        for (const output of outputs) {
          const localPath = this.findTempFile(output.s3Key, output.type === 'thumbnail' ? 'thumbnails' : 'videos')
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
      
      // Also clean up any files in the temp directory that match the media ID pattern
      await this.cleanupMediaIdFiles(mediaId)
      
      logger.info(`Cleaned up ${filesToCleanup.length} temp files for job ${jobId}`)
      
    } catch (error) {
      logger.warn(`Error during cleanup for job ${jobId}:`, error)
    }
  }

  /**
   * Clean up any remaining files that match the media ID pattern
   */
  private async cleanupMediaIdFiles(mediaId: string): Promise<void> {
    try {
      if (!fs.existsSync(this.tempDir)) {
        return
      }
      
      const files = fs.readdirSync(this.tempDir)
      for (const file of files) {
        if (file.includes(mediaId)) {
          const filePath = path.join(this.tempDir, file)
          try {
            if (fs.existsSync(filePath)) {
              const stat = fs.statSync(filePath)
              if (stat.isFile()) {
                fs.unlinkSync(filePath)
                logger.debug(`Cleaned up orphaned temp file: ${filePath}`)
              }
            }
          } catch (error) {
            logger.warn(`Failed to clean up orphaned file ${filePath}:`, error)
          }
        }
      }
    } catch (error) {
      logger.warn(`Error cleaning up media ID files for ${mediaId}:`, error)
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

  private async extractBasicMetadata(videoPath: string): Promise<VideoMetadata> {
    // Extract basic metadata using FFprobe
    // This is a simplified version - you might want to use the full metadata extraction
    const stats = fs.statSync(videoPath)
    
    return {
      duration: 0, // Will be filled by full processing
      codec: 'unknown',
      bitrate: 0,
      framerate: 0,
      resolution: 'unknown',
      width: 0,
      height: 0,
      fileSize: stats.size,
      mimeType: 'video/mp4'
    }
  }

  private async uploadResults(
    jobId: string,
    mediaId: string,
    outputs: ProcessingOutput[]
  ): Promise<{ thumbnails: any[], videoVersions: any[] }> {
    const thumbnails: any[] = []
    const videoVersions: any[] = []
    const uploadedFiles: string[] = []

    for (const output of outputs) {
      const localPath = this.findTempFile(output.s3Key, output.type === 'thumbnail' ? 'thumbnails' : 'videos')
      
      if (localPath && fs.existsSync(localPath)) {
        try {
          await this.s3Service.uploadFile(localPath, output.s3Key)
          
          // Track successfully uploaded files for cleanup
          uploadedFiles.push(localPath)
          
          // Mark the file for cleanup in the tracker
          this.tempFileTracker.markFileForCleanup(jobId, localPath)
          
          if (output.type === 'thumbnail') {
            thumbnails.push({
              s3Key: output.s3Key,
              width: output.width,
              height: output.height,
              fileSize: output.fileSize
            })
          } else {
            videoVersions.push({
              s3Key: output.s3Key,
              quality: output.quality,
              width: output.width,
              height: output.height,
              fileSize: output.fileSize
            })
          }
          
          // Clean up the file immediately after successful upload
          try {
            fs.unlinkSync(localPath)
            logger.debug(`Cleaned up uploaded file: ${localPath}`)
          } catch (cleanupError) {
            logger.warn(`Failed to clean up uploaded file ${localPath}:`, cleanupError)
          }
          
        } catch (uploadError) {
          logger.error(`Failed to upload ${output.type} for media ${mediaId}:`, uploadError)
          // Don't throw here, continue with other uploads
        }
      }
    }

    return { thumbnails, videoVersions }
  }

  private async sendToNextStage(result: StageResult, nextStage: ProcessingStage): Promise<void> {
    const job: StagedProcessingJob = {
      id: result.jobId,
      mediaId: result.mediaId,
      userId: '', // Will be filled from original job
      mediaType: 'VIDEO',
      s3Key: '', // Will be filled from original job
      originalFilename: '', // Will be filled from original job
      mimeType: '', // Will be filled from original job
      fileSize: 0, // Will be filled from original job
      createdAt: new Date(),
      stage: nextStage,
      previousStage: result.stage,
      localMediaPath: result.localMediaPath,
      metadata: result.metadata,
      outputs: result.outputs
    }

    const queueName = this.getQueueForStage(nextStage)
    await this.rabbitmqService.sendMessage(queueName, job)
  }

  private getQueueForStage(stage: ProcessingStage): string {
    switch (stage) {
      case 'PROCESSING':
        return this.queueConfig.processing
      case 'UPLOADING':
        return this.queueConfig.upload
      case 'UPLOADED':
        return this.queueConfig.cleanup
      case 'CLEANUP':
        return this.queueConfig.updates
      case 'COMPLETED':
      case 'FAILED':
        return this.queueConfig.updates
      default:
        return this.queueConfig.processing
    }
  }

  private async sendProgressUpdate(
    jobId: string,
    mediaId: string,
    status: 'processing' | 'completed' | 'failed',
    progress: number,
    currentStep?: string,
    thumbnails?: any[],
    metadata?: VideoMetadata,
    errorMessage?: string,
    videoVersions?: any[]
  ): Promise<void> {
    const update = {
      type: 'video_processing_update' as const,
      job_id: jobId,
      media_id: mediaId,
      status,
      progress,
      current_step: currentStep,
      thumbnails,
      metadata,
      error_message: errorMessage,
      video_versions: videoVersions,
      timestamp: new Date().toISOString()
    }

    await this.rabbitmqService.publishProgressUpdate(update)
  }

  private findTempFile(s3Key: string, type: 'thumbnails' | 'videos'): string | null {
    const filename = path.basename(s3Key)
    const localPath = path.join(this.tempDir, type, filename)
    
    return fs.existsSync(localPath) ? localPath : null
  }
} 