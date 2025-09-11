import ffmpeg from 'fluent-ffmpeg'
import * as path from 'path'
import * as fs from 'fs'

import logger from './utils/logger'
import { config } from './utils/config'

interface SimpleVideoMetadata {
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

interface SimpleProcessingOutput {
  type: 'thumbnail' | 'scaled'
  s3Key: string
  width: number
  height: number
  fileSize: number
  mimeType: string
  quality?: string
}

interface SimpleProcessingResult {
  success: boolean
  mediaId: string
  outputs: SimpleProcessingOutput[]
  metadata?: SimpleVideoMetadata
  error?: string
  processingTime: number
}

export class SimpleVideoProcessor {
  private readonly tempDir: string
  private readonly videoQualities = [
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

  async processVideo(videoPath: string, mediaId: string): Promise<SimpleProcessingResult> {
    const startTime = Date.now()
    const outputs: SimpleProcessingOutput[] = []

    try {
      logger.info(`Starting video processing for media ${mediaId}`)

      // Get video metadata
      const metadata = await this.getVideoMetadata(videoPath)
      logger.info(`Video metadata: ${JSON.stringify(metadata)}`)

      // Generate thumbnails
      const thumbnails = await this.generateThumbnails(videoPath, mediaId)
      outputs.push(...thumbnails)

      // Generate different quality versions
      const qualityVersions = await this.generateQualityVersions(videoPath, mediaId, metadata)
      outputs.push(...qualityVersions)

      const processingTime = Date.now() - startTime
      logger.info(`Video processing completed for media ${mediaId} in ${processingTime}ms`)

      return {
        success: true,
        mediaId,
        outputs,
        metadata,
        processingTime
      }

    } catch (error) {
      logger.error(`Video processing failed for media ${mediaId}:`, error)
      return {
        success: false,
        mediaId,
        outputs: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
      }
    }
  }

  private async getVideoMetadata(videoPath: string): Promise<SimpleVideoMetadata> {
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

        const bitrate = metadata.format.bit_rate ? parseInt(String(metadata.format.bit_rate)) : 0
        const fileSize = metadata.format.size ? parseInt(String(metadata.format.size)) : 0
        const framerate = this.parseFramerate(videoStream.r_frame_rate || '')
        const width = videoStream.width || 0
        const height = videoStream.height || 0

        resolve({
          duration: metadata.format.duration || 0,
          codec: videoStream.codec_name || 'unknown',
          bitrate,
          framerate,
          resolution: `${width}x${height}`,
          width,
          height,
          fileSize,
          mimeType: 'video/mp4'
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

  private async generateThumbnails(videoPath: string, mediaId: string): Promise<SimpleProcessingOutput[]> {
    const outputs: SimpleProcessingOutput[] = []
    const thumbnailTimes = ['00:00:05', '00:00:10', '00:00:15']
    
    // Parse thumbnail size from config
    const [thumbnailWidth, thumbnailHeight] = config.processing.thumbnailSize.split('x').map(Number)
    if (!thumbnailWidth || !thumbnailHeight) {
      throw new Error(`Invalid thumbnail size format: ${config.processing.thumbnailSize}. Expected format: WIDTHxHEIGHT`)
    }

    for (let i = 0; i < thumbnailTimes.length; i++) {
      const time = thumbnailTimes[i]
      const outputPath = path.join(this.tempDir, `${mediaId}_thumb_${i}.jpg`)
      
      try {
        await this.generateThumbnail(videoPath, outputPath, time || '00:00:05')
        
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
    metadata: SimpleVideoMetadata
  ): Promise<SimpleProcessingOutput[]> {
    const outputs: SimpleProcessingOutput[] = []
    const originalWidth = metadata.width
    const originalHeight = metadata.height

    for (const quality of this.videoQualities) {
      // Only create versions smaller than the original
      if (quality.width >= originalWidth && quality.height >= originalHeight) {
        logger.info(`Skipping ${quality.name} - original is smaller (${originalWidth}x${originalHeight})`)
        continue
      }

      const outputPath = path.join(this.tempDir, `${mediaId}_${quality.name}.mp4`)
      
      try {
        await this.generateQualityVersion(videoPath, outputPath, quality)
        
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
    quality: { name: string; resolution: string; bitrate: string; width: number; height: number }
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
} 