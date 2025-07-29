import { StandaloneVideoProcessor } from '../standaloneVideoProcessor'
import { RabbitMQService, ProcessingRequest, ProgressUpdate } from './rabbitmqService'
import { S3ProcessorService } from './s3ProcessorService'
import logger from '../utils/logger'

interface VideoMetadata {
  duration: number
  codec: string
  bitrate: number
  framerate: number
  resolution: string
  width: number
  height: number
  fileSize: number
  mimeType: string
}

interface ProcessingOutput {
  type: 'thumbnail' | 'scaled'
  s3Key: string
  width: number
  height: number
  fileSize: number
  mimeType: string
  quality?: string
}

export class VideoProcessingService {
  private videoProcessor: StandaloneVideoProcessor
  private rabbitmqService: RabbitMQService
  private s3Service: S3ProcessorService
  constructor(
    rabbitmqService: RabbitMQService,
    s3Service: S3ProcessorService,
    tempDir: string = '/tmp',
    _progressInterval: number = 5
  ) {
    this.videoProcessor = new StandaloneVideoProcessor(tempDir, tempDir)
    this.rabbitmqService = rabbitmqService
    this.s3Service = s3Service
  }

  async start(): Promise<void> {
    await this.rabbitmqService.connect()
    await this.rabbitmqService.consumeProcessingRequests(
      (request) => this.processVideoRequest(request)
    )
    logger.info('Video processing service started')
  }

  async stop(): Promise<void> {
    await this.rabbitmqService.close()
    logger.info('Video processing service stopped')
  }

  private async processVideoRequest(request: ProcessingRequest): Promise<void> {
    const { job_id, media_id, s3_key } = request
    let localVideoPath: string | null = null
    let tempFiles: string[] = []

    try {
      // Send initial progress update
      await this.sendProgressUpdate(job_id, media_id, 'processing', 0, 'downloading_video')

      // Download video from S3
      localVideoPath = await this.s3Service.downloadVideo(s3_key)
      tempFiles.push(localVideoPath)

      await this.sendProgressUpdate(job_id, media_id, 'processing', 10, 'extracting_metadata')

      // Process video
      const result = await this.videoProcessor.processVideo(localVideoPath, media_id)

      if (!result.success) {
        throw new Error(result.error || 'Video processing failed')
      }

      // Collect temp files for cleanup
      tempFiles.push(...this.collectTempFiles(result.outputs))

      // Upload results to S3
      const { thumbnails, videoVersions } = await this.uploadResults(job_id, media_id, result, request)

      // Send completion update
      await this.sendProgressUpdate(
        job_id,
        media_id,
        'completed',
        100,
        'processing_complete',
        thumbnails,
        result.metadata,
        undefined,
        videoVersions
      )

      logger.info(`Video processing completed for job ${job_id}`)

    } catch (error) {
      logger.error(`Video processing failed for job ${job_id}:`, error)
      
      await this.sendProgressUpdate(
        job_id,
        media_id,
        'failed',
        0,
        'processing_failed',
        undefined,
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      )
    } finally {
      // Cleanup temp files
      if (tempFiles.length > 0) {
        await this.s3Service.cleanupTempFiles(tempFiles)
      }
    }
  }

  private async uploadResults(
    jobId: string,
    mediaId: string,
    result: any,
    request: ProcessingRequest
  ): Promise<{ thumbnails: any[], videoVersions: any[] }> {
    const thumbnails: any[] = []
    const videoVersions: any[] = []

    logger.info(`Processing ${result.outputs.length} outputs for media ${mediaId}`)

    for (const output of result.outputs) {
      logger.info(`Processing output: ${output.type} - ${output.s3Key}`)
      
      if (output.type === 'thumbnail') {
        // Find the corresponding temp file
        const tempFile = this.findTempFile(output.s3Key, 'thumbnails')
        if (tempFile) {
          logger.info(`Found thumbnail file: ${tempFile}`)
          const s3Key = await this.s3Service.uploadThumbnail(tempFile, mediaId, output.quality || '0')
          logger.info(`Uploaded thumbnail to S3: ${s3Key}`)
          thumbnails.push({
            s3_key: s3Key,
            timestamp: this.extractTimestamp(output.quality || '0'),
            width: output.width,
            height: output.height
          })
        } else {
          logger.warn(`Could not find thumbnail file for: ${output.s3Key}`)
        }
      } else if (output.type === 'scaled') {
        const tempFile = this.findTempFile(output.s3Key, 'videos')
        if (tempFile) {
          logger.info(`Found video file: ${tempFile}`)
          const s3Key = await this.s3Service.uploadVideoVersion(tempFile, mediaId, output.quality || 'original')
          logger.info(`Uploaded video to S3: ${s3Key}`)
          videoVersions.push({
            quality: output.quality || 'original',
            s3_key: s3Key,
            width: output.width,
            height: output.height,
            file_size: output.fileSize
          })
        } else {
          logger.warn(`Could not find video file for: ${output.s3Key}`)
        }
      }
    }

    logger.info(`Uploaded ${thumbnails.length} thumbnails and ${videoVersions.length} video versions`)

    // Don't send intermediate progress updates - just return the data for the final completion update

    return { thumbnails, videoVersions }
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
    const update: ProgressUpdate = {
      type: 'video_processing_update',
      job_id: jobId,
      media_id: mediaId,
      status,
      progress,
      current_step: currentStep,
      thumbnails,
      video_versions: videoVersions,
      metadata,
      error_message: errorMessage,
      timestamp: new Date().toISOString()
    }

    await this.rabbitmqService.publishProgressUpdate(update)
  }

  private findTempFile(s3Key: string, type: 'thumbnails' | 'videos'): string | null {
    // The StandaloneVideoProcessor saves files directly to the output directory
    const fileName = s3Key.split('/').pop()
    if (!fileName) return null

    const outputDir = this.videoProcessor['outputDir'] // Access private property
    const outputPath = `${outputDir}/${type}/${fileName}`
    
    try {
      const fs = require('fs')
      if (fs.existsSync(outputPath)) {
        return outputPath
      }
      logger.warn(`Could not find output file: ${outputPath}`)
    } catch (error) {
      logger.warn(`Error checking output file: ${outputPath}`, error)
    }
    
    return null
  }

  private collectTempFiles(outputs: ProcessingOutput[]): string[] {
    const tempFiles: string[] = []
    
    for (const output of outputs) {
      const tempFile = this.findTempFile(output.s3Key, output.type === 'thumbnail' ? 'thumbnails' : 'videos')
      if (tempFile) {
        tempFiles.push(tempFile)
      }
    }
    
    return tempFiles
  }

  private extractTimestamp(quality: string): string {
    // Extract timestamp from quality string (e.g., "1" -> "00:00:15")
    const index = parseInt(quality) - 1
    const seconds = (index + 1) * 15
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
} 