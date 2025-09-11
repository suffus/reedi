import ffmpeg from 'fluent-ffmpeg'
import * as path from 'path'
import * as fs from 'fs'
import { config } from './utils/config'

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
  localPath?: string
}

interface ProcessingResult {
  success: boolean
  mediaId: string
  outputs: ProcessingOutput[]
  metadata?: VideoMetadata
  error?: string
  processingTime: number
}

export class StandaloneVideoProcessor {
  private readonly tempDir: string
  private readonly outputDir: string
  private readonly videoQualities = [
    { name: '360p', resolution: '640x360', bitrate: '800k', width: 640, height: 360 },
    { name: '540p', resolution: '960x540', bitrate: '1500k', width: 960, height: 540 },
    { name: '720p', resolution: '1280x720', bitrate: '2500k', width: 1280, height: 720 }
  ]

  constructor(tempDir: string = '/tmp', outputDir: string = './output') {
    this.tempDir = tempDir
    this.outputDir = outputDir
    // Ensure directories exist
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true })
    }
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true })
    }
    if (!fs.existsSync(path.join(this.outputDir, 'thumbnails'))) {
      fs.mkdirSync(path.join(this.outputDir, 'thumbnails'), { recursive: true })
    }
    if (!fs.existsSync(path.join(this.outputDir, 'videos'))) {
      fs.mkdirSync(path.join(this.outputDir, 'videos'), { recursive: true })
    }
  }

  async processVideo(videoPath: string, mediaId: string): Promise<ProcessingResult> {
    const startTime = Date.now()
    const outputs: ProcessingOutput[] = []

    try {
      console.log(`Starting video processing for media ${mediaId}`)

      // Get video metadata
      const metadata = await this.getVideoMetadata(videoPath)
      console.log(`Video metadata: ${JSON.stringify(metadata)}`)

      // Generate thumbnails
      const thumbnails = await this.generateThumbnails(videoPath, mediaId, metadata.duration)
      outputs.push(...thumbnails)

      // Convert and save original video to MP4 format
      const originalOutputPath = path.join(this.outputDir, 'videos', `${mediaId}_original.mp4`)
      
      // Convert to MP4 if it's not already MP4 (e.g., MPEG-1, AVI, etc.)
      if (path.extname(videoPath).toLowerCase() !== '.mp4') {
        await this.convertToMp4(videoPath, originalOutputPath, metadata)
      } else {
        fs.copyFileSync(videoPath, originalOutputPath)
      }
      
      outputs.push({
        type: 'scaled',
        s3Key: `videos/${mediaId}_original.mp4`,
        width: metadata.width,
        height: metadata.height,
        fileSize: fs.statSync(originalOutputPath).size,
        mimeType: 'video/mp4',
        quality: 'original',
        localPath: originalOutputPath
      })

      // Generate different quality versions
      const qualityVersions = await this.generateQualityVersions(videoPath, mediaId, metadata)
      outputs.push(...qualityVersions)

      const processingTime = Date.now() - startTime
      console.log(`Video processing completed for media ${mediaId} in ${processingTime}ms`)

      return {
        success: true,
        mediaId,
        outputs,
        metadata,
        processingTime
      }

    } catch (error) {
      console.error(`Video processing failed for media ${mediaId}:`, error)
      return {
        success: false,
        mediaId,
        outputs: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
      }
    }
  }

  private async getVideoMetadata(videoPath: string): Promise<VideoMetadata> {
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

  private formatTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  private async generateThumbnails(videoPath: string, mediaId: string, duration: number): Promise<ProcessingOutput[]> {
    const outputs: ProcessingOutput[] = []
    
    // Parse thumbnail size from config
    const [thumbnailWidth, thumbnailHeight] = config.processing.thumbnailSize.split('x').map(Number)
    if (!thumbnailWidth || !thumbnailHeight) {
      throw new Error(`Invalid thumbnail size format: ${config.processing.thumbnailSize}. Expected format: WIDTHxHEIGHT`)
    }
    
    // Generate one thumbnail for every 15 seconds of video
    const thumbnailInterval = 15 // seconds
    const numThumbnails = Math.max(1, Math.ceil(duration / thumbnailInterval))
    
    console.log(`Generating ${numThumbnails} thumbnails for ${duration}s video (one every ${thumbnailInterval}s) at ${config.processing.thumbnailSize}`)

    for (let i = 0; i < numThumbnails; i++) {
      // Calculate timestamp: start at 15s, then 30s, 45s, etc.
      // But don't exceed video duration
      const timestamp = Math.min((i + 1) * thumbnailInterval, duration)
      const time = this.formatTimestamp(timestamp)
      const outputPath = path.join(this.tempDir, `${mediaId}_thumb_${i}.jpg`)
      
      try {
        await this.generateThumbnail(videoPath, outputPath, time || '00:00:05')
        
        // Save thumbnail to output directory
        const thumbnailOutputPath = path.join(this.outputDir, 'thumbnails', `${mediaId}_${i}.jpg`)
        fs.copyFileSync(outputPath, thumbnailOutputPath)
        
        const s3Key = `thumbnails/${mediaId}_${i}.jpg`
        
        outputs.push({
          type: 'thumbnail',
          s3Key,
          width: thumbnailWidth,
          height: thumbnailHeight,
          fileSize: fs.statSync(thumbnailOutputPath).size,
          mimeType: 'image/jpeg',
          quality: `${i + 1}`,
          localPath: thumbnailOutputPath
        })

        // Clean up temp thumbnail
        fs.unlinkSync(outputPath)
        
      } catch (error) {
        console.error(`Failed to generate thumbnail ${i} for media ${mediaId}:`, error)
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
    metadata: VideoMetadata
  ): Promise<ProcessingOutput[]> {
    const outputs: ProcessingOutput[] = []
    const originalWidth = metadata.width
    const originalHeight = metadata.height

    for (const quality of this.videoQualities) {
      // Only create versions smaller than the original
      if (quality.width >= originalWidth && quality.height >= originalHeight) {
        console.log(`Skipping ${quality.name} - original is smaller (${originalWidth}x${originalHeight})`)
        continue
      }

      const outputPath = path.join(this.tempDir, `${mediaId}_${quality.name}.mp4`)
      
      try {
        await this.generateQualityVersion(videoPath, outputPath, quality)
        
        // Save video to output directory
        const videoOutputPath = path.join(this.outputDir, 'videos', `${mediaId}_${quality.name}.mp4`)
        fs.copyFileSync(outputPath, videoOutputPath)
        
        const s3Key = `videos/${mediaId}_${quality.name}.mp4`
        
        outputs.push({
          type: 'scaled',
          s3Key,
          width: quality.width,
          height: quality.height,
          fileSize: fs.statSync(videoOutputPath).size,
          mimeType: 'video/mp4',
          quality: quality.name,
          localPath: videoOutputPath
        })

        // Clean up temp video
        fs.unlinkSync(outputPath)
        
      } catch (error) {
        console.error(`Failed to generate ${quality.name} version for media ${mediaId}:`, error)
      }
    }

    return outputs
  }

  private async convertToMp4(
    inputPath: string, 
    outputPath: string, 
    metadata: VideoMetadata
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .audioBitrate('128k')
        .outputOptions([
          '-preset', 'medium',
          '-crf', '23',
          '-movflags', '+faststart',
          '-fflags', '+genpts',  // Generate presentation timestamps for better compatibility
          '-avoid_negative_ts', 'make_zero'  // Handle negative timestamps in MPEG-1
        ])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .on('progress', (progress) => {
          console.log(`Converting to MP4: ${progress.percent}% done`)
        })
        .run()
    })
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
          '-movflags', '+faststart',
          '-fflags', '+genpts',  // Generate presentation timestamps for better compatibility
          '-avoid_negative_ts', 'make_zero'  // Handle negative timestamps in MPEG-1
        ])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .on('progress', (progress) => {
          console.log(`Processing ${quality.name}: ${progress.percent}% done`)
        })
        .run()
    })
  }
} 