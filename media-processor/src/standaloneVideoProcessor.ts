import ffmpeg from 'fluent-ffmpeg'
import * as path from 'path'
import * as fs from 'fs'
import sharp from 'sharp'

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
      const thumbnails = await this.generateThumbnails(videoPath, mediaId, metadata.duration, metadata)
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

  private getVideoOrientation(width: number, height: number): 'landscape' | 'portrait' | 'square' {
    const aspectRatio = width / height
    if (aspectRatio > 1.1) return 'landscape'
    if (aspectRatio < 0.9) return 'portrait'
    return 'square'
  }

  private getTargetResolutions(orientation: 'landscape' | 'portrait' | 'square') {
    const resolutions = {
      landscape: [
        { name: '360p', width: 640, height: 360, bitrate: '800k' },
        { name: '540p', width: 960, height: 540, bitrate: '1500k' },
        { name: '720p', width: 1280, height: 720, bitrate: '2500k' }
      ],
      portrait: [
        { name: '360p', width: 360, height: 640, bitrate: '800k' },
        { name: '540p', width: 540, height: 960, bitrate: '1500k' },
        { name: '720p', width: 720, height: 1280, bitrate: '2500k' }
      ],
      square: [
        { name: '360p', width: 360, height: 360, bitrate: '800k' },
        { name: '540p', width: 540, height: 540, bitrate: '1500k' },
        { name: '720p', width: 720, height: 720, bitrate: '2500k' }
      ]
    }
    return resolutions[orientation]
  }

  private getThumbnailSize(orientation: 'landscape' | 'portrait' | 'square') {
    // All thumbnails will be scaled to fit within 720x720 using Sharp
    // This method is kept for compatibility but the actual scaling is done by Sharp
    return { width: 720, height: 720 }
  }

  private formatTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  private async probeVideoFile(videoPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          console.error(`FFprobe error for ${videoPath}:`, err.message)
          reject(err)
          return
        }
        
        console.log(`Video metadata:`, {
          duration: metadata.format.duration,
          bitrate: metadata.format.bit_rate,
          codec: metadata.streams[0]?.codec_name,
          width: metadata.streams[0]?.width,
          height: metadata.streams[0]?.height,
          fps: metadata.streams[0]?.r_frame_rate,
          pixelFormat: metadata.streams[0]?.pix_fmt
        })
        
        resolve()
      })
    })
  }

  private async generateThumbnails(videoPath: string, mediaId: string, duration: number, metadata: VideoMetadata): Promise<ProcessingOutput[]> {
    const outputs: ProcessingOutput[] = []
    
    // First, check if the video file exists and is readable
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`)
    }
    
    // Check video file properties
    try {
      const stats = fs.statSync(videoPath)
      console.log(`Video file stats: size=${stats.size} bytes, modified=${stats.mtime}`)
      
      // Probe video file with ffprobe to get detailed information
      await this.probeVideoFile(videoPath)
    } catch (error) {
      console.error(`Error reading video file stats:`, error)
    }
    
    // Determine video orientation and get appropriate thumbnail size
    const orientation = this.getVideoOrientation(metadata.width, metadata.height)
    const thumbnailSize = this.getThumbnailSize(orientation)
    
    console.log(`Generating thumbnails for ${orientation} video (${metadata.width}x${metadata.height}) - will scale to fit within 720x720`)
    
    // Generate one thumbnail for every 15 seconds of video
    const thumbnailInterval = 15 // seconds
    const numThumbnails = Math.max(1, Math.ceil(duration / thumbnailInterval))
    
    console.log(`Generating ${numThumbnails} thumbnails for ${duration}s video (one every ${thumbnailInterval}s)`)

    for (let i = 0; i < numThumbnails; i++) {
      // Calculate timestamp: start at 15s, then 30s, 45s, etc.
      // But don't exceed video duration
      const timestamp = Math.min((i + 1) * thumbnailInterval, duration)
      const time = this.formatTimestamp(timestamp)
      const outputPath = path.join(this.tempDir, `${mediaId}_thumb_${i}.jpg`)
      
      try {
        // Try to generate thumbnail at the calculated time
        await this.generateThumbnail(videoPath, outputPath, time || '00:00:05', thumbnailSize)
        
        // Verify the thumbnail was created successfully
        if (!fs.existsSync(outputPath)) {
          throw new Error(`Thumbnail file was not created: ${outputPath}`)
        }
        
        // Get the actual dimensions of the scaled thumbnail
        const { width: actualWidth, height: actualHeight } = await sharp(outputPath).metadata()
        
        // Save thumbnail to output directory
        const thumbnailOutputPath = path.join(this.outputDir, 'thumbnails', `${mediaId}_${i}.jpg`)
        fs.copyFileSync(outputPath, thumbnailOutputPath)
        
        const s3Key = `thumbnails/${mediaId}_${i}.jpg`
        
        outputs.push({
          type: 'thumbnail',
          s3Key,
          width: actualWidth || 720,
          height: actualHeight || 720,
          fileSize: fs.statSync(thumbnailOutputPath).size,
          mimeType: 'image/jpeg',
          quality: `${i + 1}`,
          localPath: thumbnailOutputPath
        })

        // Clean up temp thumbnail
        fs.unlinkSync(outputPath)
        
      } catch (error) {
        console.error(`Failed to generate thumbnail ${i} for media ${mediaId} at time ${time}:`, error)
        
        // Try fallback: generate thumbnail at a different time with simple method
        if (i === 0) {
          console.log(`Trying fallback thumbnail generation at 00:00:01 for media ${mediaId}`)
          try {
            await this.generateThumbnailSimple(videoPath, outputPath, '00:00:01', thumbnailSize)
            
            if (fs.existsSync(outputPath)) {
              // Get the actual dimensions of the scaled thumbnail
              const { width: actualWidth, height: actualHeight } = await sharp(outputPath).metadata()
              
              const thumbnailOutputPath = path.join(this.outputDir, 'thumbnails', `${mediaId}_${i}.jpg`)
              fs.copyFileSync(outputPath, thumbnailOutputPath)
              
              const s3Key = `thumbnails/${mediaId}_${i}.jpg`
              
              outputs.push({
                type: 'thumbnail',
                s3Key,
                width: actualWidth || 720,
                height: actualHeight || 720,
                fileSize: fs.statSync(thumbnailOutputPath).size,
                mimeType: 'image/jpeg',
                quality: `${i + 1}`,
                localPath: thumbnailOutputPath
              })
              
              fs.unlinkSync(outputPath)
              console.log(`Fallback thumbnail generation successful for media ${mediaId}`)
            }
          } catch (fallbackError) {
            console.error(`Fallback thumbnail generation also failed for media ${mediaId}:`, fallbackError)
          }
        }
      }
    }

    return outputs
  }

  private async generateThumbnail(videoPath: string, outputPath: string, time: string, thumbnailSize: { width: number; height: number }): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        // First, extract a frame from the video at the specified time
        const tempFramePath = path.join(this.tempDir, `temp_frame_${Date.now()}.jpg`)
        
        console.log(`Extracting frame at time ${time} from video`)
        
        // Extract frame using FFmpeg without any scaling
        await new Promise<void>((ffmpegResolve, ffmpegReject) => {
          ffmpeg(videoPath)
            .seekInput(time)
            .frames(1)
            .outputOptions(['-q:v', '2']) // High quality JPEG
            .output(tempFramePath)
            .on('start', (commandLine) => {
              console.log(`FFmpeg command: ${commandLine}`)
            })
            .on('end', () => {
              console.log(`Frame extracted successfully: ${tempFramePath}`)
              ffmpegResolve()
            })
            .on('error', (err) => {
              console.error(`FFmpeg error for frame extraction at ${time}:`, err.message)
              ffmpegReject(err)
            })
            .run()
        })
        
        // Now use Sharp to scale the frame to fit within 720x720 while maintaining aspect ratio
        console.log(`Scaling frame to fit within 720x720 using Sharp`)
        
        const sharpInstance = sharp(tempFramePath)
        const { width: originalWidth, height: originalHeight } = await sharpInstance.metadata()
        console.log(`Original frame dimensions: ${originalWidth}x${originalHeight}`)
        
        await sharpInstance
          .resize(720, 720, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({
            quality: 85,
            progressive: true,
            mozjpeg: true
          })
          .toFile(outputPath)
        
        // Get the actual dimensions of the scaled thumbnail
        const { width: scaledWidth, height: scaledHeight } = await sharp(outputPath).metadata()
        console.log(`Thumbnail scaled and saved: ${outputPath} (${scaledWidth}x${scaledHeight})`)
        
        // Clean up temp frame
        if (fs.existsSync(tempFramePath)) {
          fs.unlinkSync(tempFramePath)
        }
        
        resolve()
      } catch (error) {
        console.error(`Error generating thumbnail:`, error)
        reject(error)
      }
    })
  }

  private async generateThumbnailSimple(videoPath: string, outputPath: string, time: string, thumbnailSize: { width: number; height: number }): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        // First, extract a frame from the video at the specified time
        const tempFramePath = path.join(this.tempDir, `temp_frame_simple_${Date.now()}.jpg`)
        
        console.log(`Extracting frame at time ${time} from video (simple method)`)
        
        // Extract frame using FFmpeg without any scaling
        await new Promise<void>((ffmpegResolve, ffmpegReject) => {
          ffmpeg(videoPath)
            .seekInput(time)
            .frames(1)
            .outputOptions(['-q:v', '2']) // High quality JPEG
            .output(tempFramePath)
            .on('start', (commandLine) => {
              console.log(`Simple FFmpeg command: ${commandLine}`)
            })
            .on('end', () => {
              console.log(`Frame extracted successfully: ${tempFramePath}`)
              ffmpegResolve()
            })
            .on('error', (err) => {
              console.error(`Simple FFmpeg error for frame extraction at ${time}:`, err.message)
              ffmpegReject(err)
            })
            .run()
        })
        
        // Now use Sharp to scale the frame to fit within 720x720 while maintaining aspect ratio
        console.log(`Scaling frame to fit within 720x720 using Sharp (simple method)`)
        
        await sharp(tempFramePath)
          .resize(720, 720, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({
            quality: 85,
            progressive: true,
            mozjpeg: true
          })
          .toFile(outputPath)
        
        console.log(`Simple thumbnail scaled and saved: ${outputPath}`)
        
        // Clean up temp frame
        if (fs.existsSync(tempFramePath)) {
          fs.unlinkSync(tempFramePath)
        }
        
        resolve()
      } catch (error) {
        console.error(`Error generating simple thumbnail:`, error)
        reject(error)
      }
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
    
    // Determine video orientation and get appropriate target resolutions
    const orientation = this.getVideoOrientation(originalWidth, originalHeight)
    const targetResolutions = this.getTargetResolutions(orientation)
    
    console.log(`Video orientation: ${orientation} (${originalWidth}x${originalHeight})`)
    console.log(`Target resolutions: ${targetResolutions.map(r => `${r.name}: ${r.width}x${r.height}`).join(', ')}`)

    for (const quality of targetResolutions) {
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
    quality: { name: string; bitrate: string; width: number; height: number }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Create FFmpeg filter for letterboxing
      // This scales the video to fit within the target resolution while maintaining aspect ratio,
      // then pads it to the exact target resolution with black borders
      const filter = `scale=${quality.width}:${quality.height}:force_original_aspect_ratio=decrease,pad=${quality.width}:${quality.height}:(ow-iw)/2:(oh-ih)/2:black`
      
      ffmpeg(videoPath)
        .videoFilters(filter)
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