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
import * as fs from 'fs'

export class StagedImageProcessingService {
  private rabbitmqService: EnhancedRabbitMQService
  private s3Service: S3ProcessorService
  private imageProcessor: StandaloneImageProcessor
  private queueConfig: QueueConfig

  constructor(
    rabbitmqService: EnhancedRabbitMQService,
    s3Service: S3ProcessorService
  ) {
    this.rabbitmqService = rabbitmqService
    this.s3Service = s3Service
    this.imageProcessor = new StandaloneImageProcessor()
    this.queueConfig = rabbitmqService.getQueueConfig()
  }

  async start(): Promise<void> {
    await this.rabbitmqService.connect()
    
    // Start consumers for each stage
    await this.rabbitmqService.consumeQueue(
      this.queueConfig.download,
      (job) => this.handleDownloadStage(job)
    )
    
    await this.rabbitmqService.consumeQueue(
      this.queueConfig.processing,
      (job) => this.handleProcessingStage(job)
    )
    
    await this.rabbitmqService.consumeQueue(
      this.queueConfig.upload,
      (job) => this.handleUploadStage(job)
    )

    logger.info('Staged image processing service started')
  }

  async stop(): Promise<void> {
    await this.rabbitmqService.close()
    logger.info('Staged image processing service stopped')
  }

  private async handleDownloadStage(job: any): Promise<void> {
    // Handle both StagedProcessingJob and ImageProcessingRequest formats
    const jobId = job.id || job.job_id
    const mediaId = job.mediaId || job.media_id
    const s3Key = job.s3Key || job.s3_key
    
    // Debug logging to see what we received
    logger.info(`Received job data: ${JSON.stringify(job)}`)
    logger.info(`Extracted jobId: ${jobId}, mediaId: ${mediaId}, s3Key: ${s3Key}`)
    
    try {
      logger.info(`Starting download stage for job ${jobId}, media ${mediaId}`)
      
      // Update status to downloading
      await this.sendProgressUpdate(jobId, mediaId, 'processing', 0, 'downloading_image')
      
      // Download image from S3
      const localImagePath = await this.s3Service.downloadImage(s3Key)
      
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
      
      logger.info(`Download stage completed for job ${jobId} to ${localImagePath}`)
      
    } catch (error) {
      logger.error(`Download stage failed for job ${jobId}:`, error)
      
      const result: StageResult = {
        success: false,
        stage: 'FAILED',
        mediaId,
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      
      await this.sendProgressUpdate(jobId, mediaId, 'failed', 0, 'download_failed', undefined, undefined, error instanceof Error ? error.message : 'Unknown error')
      await this.sendToNextStage(result, 'FAILED')
    }
  }

  private async handleProcessingStage(job: any): Promise<void> {
    // Handle both StagedProcessingJob and ImageProcessingRequest formats
    const jobId = job.jobId
    const mediaId = job.mediaId
    const localMediaPath = job.localMediaPath
    //const metadata = job.metadata
    
    try {
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
      
      const result: StageResult = {
        success: false,
        stage: 'FAILED',
        mediaId,
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      
      await this.sendProgressUpdate(jobId, mediaId, 'failed', 0, 'processing_failed', undefined, undefined, error instanceof Error ? error.message : 'Unknown error')
      await this.sendToNextStage(result, 'FAILED')
    }
  }

  private async handleUploadStage(job: any): Promise<void> {
    // Handle both StagedProcessingJob and ImageProcessingRequest formats
    const jobId = job.jobId || job.id || job.job_id
    const mediaId = job.mediaId || job.media_id
    const outputs = job.outputs
    
    try {
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
      
      // Clean up temp files
      const localMediaPath = job.localMediaPath
      if (localMediaPath && fs.existsSync(localMediaPath)) {
        fs.unlinkSync(localMediaPath)
      }
      
      logger.info(`Upload stage completed for job ${jobId}`)
      
    } catch (error) {
      logger.error(`Upload stage failed for job ${jobId}:`, error)
      
      await this.sendProgressUpdate(jobId, mediaId, 'failed', 0, 'upload_failed', undefined, undefined, error instanceof Error ? error.message : 'Unknown error')
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
          
          // Clean up local file
          fs.unlinkSync(localPath)
          logger.info(`Successfully uploaded and cleaned up: ${output.s3Key}`)
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


} 