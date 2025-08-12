import sharp from 'sharp'
import * as path from 'path'
import * as fs from 'fs'

// Duplicate the types needed for standalone processing
export interface ImageMetadata {
  width: number
  height: number
  fileSize: number
  mimeType: string
  format: string
  colorSpace?: string
  hasAlpha?: boolean
}

export interface ProcessingOutput {
  type: 'thumbnail' | 'scaled' | 'image_scaled'
  s3Key: string
  width: number
  height: number
  fileSize: number
  mimeType: string
  quality?: string
  localPath?: string
}

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
    { name: '180p', width: 180, height: 180, quality: 80 },
    { name: '360p', width: 360, height: 360, quality: 80 },
    { name: '720p', width: 720, height: 720, quality: 85 },
    { name: '1080p', width: 1080, height: 1080, quality: 90 }
  ]

  constructor(tempDir: string = '/tmp', outputDir: string = '/tmp/output') {
    this.tempDir = tempDir
    this.outputDir = outputDir
    
    console.log(`Initializing StandaloneImageProcessor`)
    console.log(`Temp directory: ${this.tempDir}`)
    console.log(`Output directory: ${this.outputDir}`)
    
    try {
      // Ensure directories exist
      if (!fs.existsSync(this.tempDir)) {
        console.log(`Creating temp directory: ${this.tempDir}`)
        fs.mkdirSync(this.tempDir, { recursive: true })
      }
      
      if (!fs.existsSync(this.outputDir)) {
        console.log(`Creating output directory: ${this.outputDir}`)
        fs.mkdirSync(this.outputDir, { recursive: true })
      }
      
      const imagesDir = path.join(this.outputDir, 'images')
      if (!fs.existsSync(imagesDir)) {
        console.log(`Creating images subdirectory: ${imagesDir}`)
        fs.mkdirSync(imagesDir, { recursive: true })
      }
      
      // Verify directories are writable
      try {
        const testFile = path.join(this.tempDir, 'test_write.tmp')
        fs.writeFileSync(testFile, 'test')
        fs.unlinkSync(testFile)
        console.log(`Temp directory is writable: ${this.tempDir}`)
      } catch (error) {
        throw new Error(`Temp directory is not writable: ${this.tempDir}`)
      }
      
      try {
        const testFile = path.join(imagesDir, 'test_write.tmp')
        fs.writeFileSync(testFile, 'test')
        fs.unlinkSync(testFile)
        console.log(`Images directory is writable: ${imagesDir}`)
      } catch (error) {
        throw new Error(`Images directory is not writable: ${imagesDir}`)
      }
      
      console.log(`StandaloneImageProcessor initialized successfully`)
    } catch (error) {
      console.error(`Failed to initialize StandaloneImageProcessor:`, error)
      throw new Error(`Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async processImage(imagePath: string, mediaId: string): Promise<StandaloneProcessingResult> {
    const startTime = Date.now()
    const outputs: Array<ProcessingOutput> = []

    try {
      console.log(`Starting image processing for media ${mediaId}`)
      console.log(`Input image path: ${imagePath}`)
      console.log(`Output directory: ${this.outputDir}`)

      // Check if input file exists
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Input image file does not exist: ${imagePath}`)
      }

      // Get image metadata
      const metadata = await this.getImageMetadata(imagePath)
      console.log(`Image metadata: ${JSON.stringify(metadata)}`)

      // Validate metadata
      if (metadata.width === 0 || metadata.height === 0) {
        throw new Error(`Invalid image dimensions: ${metadata.width}x${metadata.height}`)
      }

      // Generate thumbnail
      console.log(`Generating thumbnail for ${mediaId}...`)
      const thumbnail = await this.generateThumbnail(imagePath, mediaId)
      outputs.push(thumbnail)
      console.log(`Thumbnail generated successfully: ${thumbnail.localPath}`)

      // Generate different quality versions
      console.log(`Generating quality versions for ${mediaId}...`)
      const qualityVersions = await this.generateQualityVersions(imagePath, mediaId, metadata)
      outputs.push(...qualityVersions)
      console.log(`Quality versions generated: ${qualityVersions.length}`)

      // Validate outputs
      if (outputs.length === 0) {
        throw new Error('No outputs generated during processing')
      }

      const processingTime = Date.now() - startTime
      console.log(`Image processing completed for media ${mediaId} in ${processingTime}ms`)
      console.log(`Total outputs generated: ${outputs.length}`)
      outputs.forEach((output, index) => {
        console.log(`  Output ${index + 1}: ${output.type} - ${output.width}x${output.height} - ${output.localPath}`)
      })

      return {
        success: true,
        mediaId,
        outputs,
        metadata,
        processingTime
      }

    } catch (error) {
      console.error(`Image processing failed for media ${mediaId}:`, error)
      console.error(`Error details:`, error instanceof Error ? error.stack : 'Unknown error')
      
      // Clean up any partial outputs
      outputs.forEach(output => {
        if (output.localPath && fs.existsSync(output.localPath)) {
          try {
            fs.unlinkSync(output.localPath)
            console.log(`Cleaned up partial output: ${output.localPath}`)
          } catch (cleanupError) {
            console.error(`Failed to clean up partial output ${output.localPath}:`, cleanupError)
          }
        }
      })

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
    // Get metadata with EXIF orientation applied
    const metadata = await sharp(imagePath).rotate().metadata()
    
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

    console.log(`Generating quality versions for image ${mediaId}: ${originalWidth}x${originalHeight} (aspect ratio: ${aspectRatio.toFixed(2)})`)

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

        console.log(`Target for ${quality.name}: ${targetWidth}x${targetHeight}`)

        // Always process at least one version, even if it's the same size as original
        // This ensures we have outputs for the upload stage
        const shouldProcess = targetWidth <= originalWidth && targetHeight <= originalHeight
        
        if (shouldProcess) {
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

          console.log(`Generated ${quality.name} version: ${targetWidth}x${targetHeight} (${fileSize} bytes)`)
        } else {
          // For images smaller than target, create a version that's the same size as original
          // but with optimized quality
          const outputPath = path.join(this.outputDir, 'images', `${mediaId}_${quality.name}_optimized.jpg`)
          
          await this.generateQualityVersion(imagePath, outputPath, {
            width: originalWidth,
            height: originalHeight,
            quality: quality.quality
          })

          const fileSize = fs.statSync(outputPath).size

          outputs.push({
            type: 'image_scaled',
            localPath: outputPath,
            s3Key: `processed/images/${mediaId}/${quality.name}_optimized.jpg`,
            width: originalWidth,
            height: originalHeight,
            fileSize,
            mimeType: 'image/jpeg',
            quality: `${quality.name}_optimized`
          })

          console.log(`Generated optimized ${quality.name} version: ${originalWidth}x${originalHeight} (${fileSize} bytes)`)
        }

      } catch (error) {
        console.error(`Failed to generate ${quality.name} version:`, error)
        // Continue with other qualities instead of failing completely
      }
    }

    console.log(`Generated ${outputs.length} quality versions for image ${mediaId}`)
    return outputs
  }

  private async generateThumbnail(
    imagePath: string, 
    mediaId: string
  ): Promise<ProcessingOutput> {
    const outputPath = path.join(this.outputDir, 'images', `${mediaId}_thumbnail.jpg`)
    
    console.log(`Generating thumbnail at: ${outputPath}`)
    
    try {
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

      // Verify the file was created
      if (!fs.existsSync(outputPath)) {
        throw new Error(`Thumbnail file was not created: ${outputPath}`)
      }

      const fileSize = fs.statSync(outputPath).size
      console.log(`Generated thumbnail: 300x300 (${fileSize} bytes) at ${outputPath}`)

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
    } catch (error) {
      console.error(`Failed to generate thumbnail for ${mediaId}:`, error)
      throw new Error(`Thumbnail generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async generateQualityVersion(
    inputPath: string, 
    outputPath: string, 
    options: { width: number; height: number; quality: number }
  ): Promise<void> {
    console.log(`Generating quality version: ${options.width}x${options.height} at quality ${options.quality}`)
    console.log(`Input: ${inputPath}`)
    console.log(`Output: ${outputPath}`)
    
    try {
      await sharp(inputPath)
        .rotate() // Automatically rotate based on EXIF orientation
        .resize(options.width, options.height, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: options.quality })
        .toFile(outputPath)

      // Verify the file was created
      if (!fs.existsSync(outputPath)) {
        throw new Error(`Quality version file was not created: ${outputPath}`)
      }

      const fileSize = fs.statSync(outputPath).size
      console.log(`Quality version generated successfully: ${options.width}x${options.height} (${fileSize} bytes)`)
    } catch (error) {
      console.error(`Failed to generate quality version ${options.width}x${options.height}:`, error)
      throw new Error(`Quality version generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
} 