import sharp from 'sharp'
import * as path from 'path'
import * as fs from 'fs'
import { ProcessingOutput, ImageMetadata } from '@/types/stagedProcessing'

interface StandaloneProcessingResult {
  success: boolean
  mediaId: string
  outputs: Array<ProcessingOutput>
  metadata: ImageMetadata
  error?: string
  processingTime: number
}

export class StandaloneImageProcessor {
  private readonly tempDir: string
  private readonly outputDir: string
  private readonly imageQualities = [
    { name: '180p', width: 180, height: 180, quality: 85 },
    { name: '360p', width: 360, height: 360, quality: 85 },
    { name: '720p', width: 720, height: 720, quality: 90 },
    { name: '1080p', width: 1080, height: 1080, quality: 95 }
  ]

  constructor(tempDir: string = '/tmp', outputDir: string = '/tmp/output') {
    this.tempDir = tempDir
    this.outputDir = outputDir
    // Ensure directories exist
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true })
    }
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true })
    }
    if (!fs.existsSync(path.join(this.outputDir, 'images'))) {
      fs.mkdirSync(path.join(this.outputDir, 'images'), { recursive: true })
    }
  }

  async processImage(imagePath: string, mediaId: string): Promise<StandaloneProcessingResult> {
    const startTime = Date.now()
    const outputs: Array<ProcessingOutput> = []

    try {
      console.log(`Starting image processing for media ${mediaId}`)

      // Get image metadata
      const metadata = await this.getImageMetadata(imagePath)
      console.log(`Image metadata: ${JSON.stringify(metadata)}`)

      // Generate thumbnail
      const thumbnail = await this.generateThumbnail(imagePath, mediaId)
      outputs.push(thumbnail)

      // Generate different quality versions
      const qualityVersions = await this.generateQualityVersions(imagePath, mediaId, metadata)
      outputs.push(...qualityVersions)

      const processingTime = Date.now() - startTime
      console.log(`Image processing completed for media ${mediaId} in ${processingTime}ms`)

      return {
        success: true,
        mediaId,
        outputs,
        metadata,
        processingTime
      }

    } catch (error) {
      console.error(`Image processing failed for media ${mediaId}:`, error)
      return {
        success: false,
        mediaId,
        outputs: [],
        metadata: {
          width: 0,
          height: 0,
          fileSize: 0,
          mimeType: 'image/jpeg',
          format: 'jpeg'
        },
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
      }
    }
  }

  private async getImageMetadata(imagePath: string): Promise<{
    width: number
    height: number
    fileSize: number
    mimeType: string
    format: string
    colorSpace?: string
    hasAlpha?: boolean
  }> {
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

  private async generateQualityVersions(
    imagePath: string, 
    mediaId: string, 
    metadata: { width: number; height: number }
  ): Promise<Array<ProcessingOutput>> {
    const outputs: Array<ProcessingOutput> = []
    
    const originalWidth = metadata.width
    const originalHeight = metadata.height
    const aspectRatio = originalWidth / originalHeight

    for (const quality of this.imageQualities) {
      try {
        // Calculate dimensions maintaining aspect ratio
        let targetWidth = quality.width
        let targetHeight = quality.height

        if (originalWidth > originalHeight) {
          // Landscape image
          targetHeight = Math.round(targetWidth / aspectRatio)
          if (targetHeight < quality.height) {
            targetHeight = quality.height
            targetWidth = Math.round(targetHeight * aspectRatio)
          }
        } else {
          // Portrait or square image
          targetWidth = Math.round(targetHeight * aspectRatio)
          if (targetWidth < quality.width) {
            targetWidth = quality.width
            targetHeight = Math.round(targetWidth / aspectRatio)
          }
        }

        // Only process if the target size is smaller than original
        if (targetWidth < originalWidth || targetHeight < originalHeight) {
          const outputPath = path.join(this.outputDir, 'images', `${mediaId}_${quality.name}.jpg`)
          
          await this.generateQualityVersion(imagePath, outputPath, {
            width: targetWidth,
            height: targetHeight,
            quality: quality.quality
          })

          const fileSize = fs.statSync(outputPath).size

          outputs.push({
            type: 'image_scaled',
            localPath: outputPath,
            s3Key: `processed/images/${mediaId}/${quality.name}.jpg`,
            width: targetWidth,
            height: targetHeight,
            fileSize,
            mimeType: 'image/jpeg',
            quality: quality.name
          })

          console.log(`Generated ${quality.name} version: ${targetWidth}x${targetHeight}`)
        } else {
          console.log(`Skipping ${quality.name} - original is smaller than target`)
        }

      } catch (error) {
        console.error(`Failed to generate ${quality.name} version:`, error)
      }
    }

    return outputs
  }

  private async generateThumbnail(
    imagePath: string, 
    mediaId: string
  ): Promise<ProcessingOutput> {
    const outputPath = path.join(this.outputDir, 'images', `${mediaId}_thumbnail.jpg`)
    
    // Generate 300x300 thumbnail with cover fit
    await sharp(imagePath)
      .rotate() // Automatically rotate based on EXIF orientation
      .resize(300, 300, { 
        fit: 'cover',
        withoutEnlargement: true 
      })
      .jpeg({ 
        quality: 80,
        progressive: true,
        mozjpeg: true
      })
      .toFile(outputPath)

    const fileSize = fs.statSync(outputPath).size

    console.log(`Generated thumbnail: 300x300`)

    return {
      type: 'thumbnail',
      localPath: outputPath,
      s3Key: `processed/images/${mediaId}/thumbnail.jpg`,
      width: 300,
      height: 300,
      fileSize,
      mimeType: 'image/jpeg',
      quality: 'thumbnail'
    }
  }

  private async generateQualityVersion(
    inputPath: string, 
    outputPath: string, 
    options: { width: number; height: number; quality: number }
  ): Promise<void> {
    await sharp(inputPath)
      .resize(options.width, options.height, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: options.quality })
      .toFile(outputPath)
  }
} 