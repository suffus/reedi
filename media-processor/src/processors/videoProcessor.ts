import ffmpeg from 'fluent-ffmpeg'
import * as path from 'path'
import * as fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { 
  VideoProcessingJob, 
  ProcessingResult, 
  ProcessingOutput, 
  MediaMetadata,
  VideoQuality 
} from '../types'
import logger from '../utils/logger'
import { config } from '../utils/config'

export class VideoProcessor {
  private readonly tempDir: string
  private readonly videoQualities: VideoQuality[] = [
    { name: '360p', resolution: '640x360', bitrate: '800k', width: 640, height: 360 },
    { name: '540p', resolution: '960x540', bitrate: '1500k', width: 960, height: 540 },
    { name: '720p', resolution: '1280x720', bitrate: '2500k', width: 1280, height: 720 }
  ]

  constructor(tempDir: string = '/tmp') {
    this.tempDir = tempDir
    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true })
    }
  }

  async processVideo(job: VideoProcessingJob): Promise<ProcessingResult> {
    const startTime = Date.now()
    const outputs: ProcessingOutput[] = []
    let metadata: MediaMetadata | undefined

    try {
      logger.info(`Starting video processing for media ${job.mediaId}`)

      // Download video from S3 to temp directory
      const inputPath = await this.downloadVideo(job.s3Key)
      
      // Get video metadata
      metadata = await this.getVideoMetadata(inputPath)
      logger.info(`Video metadata: ${JSON.stringify(metadata)}`)

      // Generate thumbnails
      const thumbnails = await this.generateThumbnails(inputPath, job.mediaId)
      outputs.push(...thumbnails)

      // Generate different quality versions
      const qualityVersions = await this.generateQualityVersions(inputPath, job.mediaId, metadata)
      outputs.push(...qualityVersions)

      // Clean up temp files
      await this.cleanupTempFiles([inputPath])

      const processingTime = Date.now() - startTime
      logger.info(`Video processing completed for media ${job.mediaId} in ${processingTime}ms`)

      return {
        success: true,
        mediaId: job.mediaId,
        outputs,
        metadata,
        processingTime
      }

    } catch (error) {
      logger.error(`Video processing failed for media ${job.mediaId}:`, error)
      return {
        success: false,
        mediaId: job.mediaId,
        outputs: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
      }
    }
  }

  private async downloadVideo(s3Key: string): Promise<string> {
    // This would integrate with S3Service to download the video
    // For now, we'll assume the file is already available locally
    const tempPath = path.join(this.tempDir, `${uuidv4()}.mp4`)
    logger.info(`Downloading video from S3 key: ${s3Key} to ${tempPath}`)
    
    // TODO: Implement actual S3 download
    // For now, return a placeholder path
    return tempPath
  }

  private async getVideoMetadata(videoPath: string): Promise<MediaMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err)
          return
        }

        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video')
        if (!videoStream) {
          reject(new Error('No video stream found'))
          return
        }

        resolve({
          duration: metadata.format.duration,
          codec: videoStream.codec_name,
          bitrate: parseInt(metadata.format.bit_rate+"" || '0'),
          framerate: this.parseFramerate(videoStream.r_frame_rate || ''),
          resolution: `${videoStream.width || 0}x${videoStream.height || 0}`,
          width: videoStream.width || 0,
          height: videoStream.height || 0,
          fileSize: parseInt(metadata.format.size+"" || '0'),
          mimeType: 'video/mp4' // Default, could be determined from file extension
        })
      })
    })
  }

  private parseFramerate(framerate: string): number {
    if (!framerate || framerate === '0/0') return 0
    
    const parts = framerate.split('/')
    if (parts.length === 2) {
      const num = parseInt(parts[0] || '0')
      const den = parseInt(parts[1] || '0')
      return den > 0 ? num / den : 0
    }
    
    return parseFloat(framerate) || 0
  }

  private async generateThumbnails(videoPath: string, mediaId: string): Promise<ProcessingOutput[]> {
    const outputs: ProcessingOutput[] = []
    const thumbnailTimes = ['00:00:05', '00:00:10', '00:00:15'] // Generate 3 thumbnails at different times
    
    // Parse thumbnail size from config
    const [thumbnailWidth, thumbnailHeight] = config.processing.thumbnailSize.split('x').map(Number)
    if (!thumbnailWidth || !thumbnailHeight) {
      throw new Error(`Invalid thumbnail size format: ${config.processing.thumbnailSize}. Expected format: WIDTHxHEIGHT`)
    }

    for (let i = 0; i < thumbnailTimes.length; i++) {
      const time = thumbnailTimes[i] || '00:00:00'
      const outputPath = path.join(this.tempDir, `${mediaId}_thumb_${i}.jpg`)
      
      try {
        await this.generateThumbnail(videoPath, outputPath, time)
        
        // TODO: Upload thumbnail to S3
        const s3Key = `thumbnails/${mediaId}_${i}.jpg`
        
        outputs.push({
          type: 'thumbnail',
          s3Key,
          width: thumbnailWidth,
          height: thumbnailHeight,
          fileSize: fs.statSync(outputPath).size,
          mimeType: 'image/jpeg',
          quality: `${i + 1}`
        })

        // Clean up temp thumbnail
        fs.unlinkSync(outputPath)
        
      } catch (error) {
        logger.error(`Failed to generate thumbnail ${i} for media ${mediaId}:`, error)
      }
    }

    return outputs
  }

  private async generateThumbnail(videoPath: string, outputPath: string, time: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .seekInput(time)
        .frames(1)
        .size(config.processing.thumbnailSize)
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run()
    })
  }

  private async generateQualityVersions(
    videoPath: string, 
    mediaId: string, 
    metadata: MediaMetadata
  ): Promise<ProcessingOutput[]> {
    const outputs: ProcessingOutput[] = []
    const originalWidth = metadata.width || 0
    const originalHeight = metadata.height || 0

    for (const quality of this.videoQualities) {
      // Only create versions smaller than the original
      if (quality.width >= originalWidth && quality.height >= originalHeight) {
        logger.info(`Skipping ${quality.name} - original is smaller (${originalWidth}x${originalHeight})`)
        continue
      }

      const outputPath = path.join(this.tempDir, `${mediaId}_${quality.name}.mp4`)
      
      try {
        await this.generateQualityVersion(videoPath, outputPath, quality)
        
        // TODO: Upload video to S3
        const s3Key = `videos/${mediaId}_${quality.name}.mp4`
        
        outputs.push({
          type: 'scaled',
          s3Key,
          width: quality.width,
          height: quality.height,
          fileSize: fs.statSync(outputPath).size,
          mimeType: 'video/mp4',
          quality: quality.name
        })

        // Clean up temp video
        fs.unlinkSync(outputPath)
        
      } catch (error) {
        logger.error(`Failed to generate ${quality.name} version for media ${mediaId}:`, error)
      }
    }

    return outputs
  }

  private async generateQualityVersion(
    videoPath: string, 
    outputPath: string, 
    quality: VideoQuality
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .size(quality.resolution)
        .videoBitrate(quality.bitrate)
        .audioCodec('aac')
        .audioBitrate('128k')
        .outputOptions([
          '-preset', 'medium',
          '-crf', '23',
          '-movflags', '+faststart'
        ])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .on('progress', (progress) => {
          logger.debug(`Processing ${quality.name}: ${progress.percent}% done`)
        })
        .run()
    })
  }

  private async cleanupTempFiles(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
          logger.debug(`Cleaned up temp file: ${filePath}`)
        }
      } catch (error) {
        logger.warn(`Failed to clean up temp file ${filePath}:`, error)
      }
    }
  }
} 