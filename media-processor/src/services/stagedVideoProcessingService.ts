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
import * as fs from 'fs'
import * as path from 'path'

export class StagedVideoProcessingService {
  private rabbitmqService: EnhancedRabbitMQService
  private s3Service: S3ProcessorService
  private videoProcessor: StandaloneVideoProcessor
  private tempDir: string
  private queueConfig: QueueConfig

  constructor(
    rabbitmqService: EnhancedRabbitMQService,
    s3Service: S3ProcessorService,
    tempDir: string = '/tmp'
  ) {
    this.rabbitmqService = rabbitmqService
    this.s3Service = s3Service
    this.videoProcessor = new StandaloneVideoProcessor(tempDir, tempDir)
    this.tempDir = tempDir
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

    logger.info('Staged video processing service started')
  }

  async stop(): Promise<void> {
    await this.rabbitmqService.close()
    logger.info('Staged video processing service stopped')
  }

  private async handleDownloadStage(job: StagedProcessingJob): Promise<void> {
    const { id: jobId, mediaId, s3Key } = job
    
    try {
      logger.info(`Starting download stage for job ${jobId}, media ${mediaId}`)
      
      // Update status to downloading
      await this.sendProgressUpdate(jobId, mediaId, 'processing', 0, 'downloading_video')
      
      // Download video from S3
      const localVideoPath = await this.s3Service.downloadVideo(s3Key)
      
      // Extract basic metadata
      const metadata = await this.extractBasicMetadata(localVideoPath)
      
      // Create result for next stage
      const result: StageResult = {
        success: true,
        stage: 'DOWNLOADED',
        mediaId,
        jobId,
        localVideoPath,
        metadata
      }
      
      // Send progress update
      await this.sendProgressUpdate(jobId, mediaId, 'processing', 20, 'download_complete')
      
      // Send to next stage (processing)
      await this.sendToNextStage(result, 'PROCESSING')
      
      logger.info(`Download stage completed for job ${jobId}`)
      
    } catch (error) {
      logger.error(`Download stage failed for job ${jobId}:`, error)
      
      const result: StageResult = {
        success: false,
        stage: 'FAILED',
        mediaId,
        jobId,
        error: error instanceof Error ? error.message : 'Download failed'
      }
      
      await this.sendProgressUpdate(jobId, mediaId, 'failed', 0, 'download_failed', undefined, undefined, result.error)
      await this.sendToNextStage(result, 'FAILED')
    }
  }

  private async handleProcessingStage(job: StagedProcessingJob): Promise<void> {
    const { id: jobId, mediaId, localVideoPath } = job
    
    if (!localVideoPath) {
      logger.error(`No local video path for job ${jobId}`)
      return
    }
    
    try {
      logger.info(`Starting processing stage for job ${jobId}, media ${mediaId}`)
      
      // Update status to processing
      await this.sendProgressUpdate(jobId, mediaId, 'processing', 30, 'processing_video')
      
      // Process video with FFmpeg
      const result = await this.videoProcessor.processVideo(localVideoPath, mediaId)
      
      if (!result.success) {
        throw new Error(result.error || 'Video processing failed')
      }
      
      // Create result for next stage
      const stageResult: StageResult = {
        success: true,
        stage: 'PROCESSED',
        mediaId,
        jobId,
        localVideoPath,
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
      
      const result: StageResult = {
        success: false,
        stage: 'FAILED',
        mediaId,
        jobId,
        error: error instanceof Error ? error.message : 'Processing failed'
      }
      
      await this.sendProgressUpdate(jobId, mediaId, 'failed', 0, 'processing_failed', undefined, undefined, result.error)
      await this.sendToNextStage(result, 'FAILED')
    }
  }

  private async handleUploadStage(job: StagedProcessingJob): Promise<void> {
    const { id: jobId, mediaId, outputs } = job
    
    if (!outputs || outputs.length === 0) {
      logger.error(`No outputs for job ${jobId}`)
      return
    }
    
    try {
      logger.info(`Starting upload stage for job ${jobId}, media ${mediaId}`)
      
      // Update status to uploading
      await this.sendProgressUpdate(jobId, mediaId, 'processing', 80, 'uploading_results')
      
      // Upload processed files to S3
      const { thumbnails, videoVersions } = await this.uploadResults(jobId, mediaId, outputs)
      
      // Create result for completion
      const result: StageResult = {
        success: true,
        stage: 'COMPLETED',
        mediaId,
        jobId
      }
      
      // Send completion update
      await this.sendProgressUpdate(
        jobId,
        mediaId,
        'completed',
        100,
        'upload_complete',
        thumbnails,
        job.metadata,
        undefined,
        videoVersions
      )
      
      // Send to completion stage
      await this.sendToNextStage(result, 'COMPLETED')
      
      logger.info(`Upload stage completed for job ${jobId}`)
      
    } catch (error) {
      logger.error(`Upload stage failed for job ${jobId}:`, error)
      
      const result: StageResult = {
        success: false,
        stage: 'FAILED',
        mediaId,
        jobId,
        error: error instanceof Error ? error.message : 'Upload failed'
      }
      
      await this.sendProgressUpdate(jobId, mediaId, 'failed', 0, 'upload_failed', undefined, undefined, result.error)
      await this.sendToNextStage(result, 'FAILED')
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

    for (const output of outputs) {
      const localPath = this.findTempFile(output.s3Key, output.type === 'thumbnail' ? 'thumbnails' : 'videos')
      
      if (localPath && fs.existsSync(localPath)) {
        await this.s3Service.uploadFile(localPath, output.s3Key)
        
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
      localVideoPath: result.localVideoPath,
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