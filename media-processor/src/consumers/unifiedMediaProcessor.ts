import { initRabbitMQ, consumeMessage, publishMessage } from '../utils/rabbitmq'
import { S3ProcessorService } from '../services/s3ProcessorService'
import { ZipExtractionService } from '../services/zipExtractionService'
import { FileValidationService } from '../services/fileValidationService'
import { StandaloneImageProcessor } from '../standaloneImageProcessor'
import { StandaloneVideoProcessor } from '../standaloneVideoProcessor'
import { createNamespacedMediaQueues } from '../utils/rabbitmqNamespace'
import { MediaProcessingMessage, MediaProcessingRequest, MediaProgressUpdate, MediaProcessingResult } from '../types/media-processing'
import logger from '../utils/logger'

export class UnifiedMediaProcessor {
  private s3Service: S3ProcessorService
  private zipExtractionService: ZipExtractionService
  private fileValidationService: FileValidationService
  private imageProcessor: StandaloneImageProcessor
  private videoProcessor: StandaloneVideoProcessor
  private standaloneImageProcessor: StandaloneImageProcessor
  private standaloneVideoProcessor: StandaloneVideoProcessor
  private tempDir: string
  private isRunning: boolean = false

  constructor(
    s3Service: S3ProcessorService,
    zipExtractionService: ZipExtractionService,
    fileValidationService: FileValidationService,
    tempDir: string
  ) {
    this.s3Service = s3Service
    this.zipExtractionService = zipExtractionService
    this.fileValidationService = fileValidationService
    this.imageProcessor = new StandaloneImageProcessor(tempDir, tempDir)
    this.videoProcessor = new StandaloneVideoProcessor(tempDir, tempDir)
    this.standaloneImageProcessor = new StandaloneImageProcessor(tempDir, tempDir)
    this.standaloneVideoProcessor = new StandaloneVideoProcessor(tempDir, tempDir)
    this.tempDir = tempDir
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Unified media processor is already running')
      return
    }

    try {
      // Initialize RabbitMQ
      await initRabbitMQ()
      
      // Get queue names
      const queues = createNamespacedMediaQueues()
      
      // Start consuming from the unified request queue
      await consumeMessage(queues.requests, async (message: string) => {
        await this.processMessage(message)
      })

      this.isRunning = true
      logger.info('Unified media processor started successfully')
    } catch (error) {
      logger.error('Failed to start unified media processor:', error)
      throw error
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false
    logger.info('Unified media processor stopped')
  }

  private async processMessage(message: string): Promise<void> {
    try {
      const request = JSON.parse(message) as MediaProcessingRequest
      
      console.log(`🔄 [UNIFIED-PROCESSOR] Processing ${request.mediaType} request for media ${request.mediaId}`)
      console.log(`🔄 [UNIFIED-PROCESSOR] Full request:`, JSON.stringify(request, null, 2))
      
      logger.info(`Processing ${request.mediaType} request for media ${request.mediaId}`)

      // Route to appropriate processor based on media type
      switch (request.mediaType) {
        case 'image':
          console.log(`🔄 [UNIFIED-PROCESSOR] Routing to image processor`)
          await this.processImage(request)
          break
        case 'video':
          console.log(`🔄 [UNIFIED-PROCESSOR] Routing to video processor`)
          await this.processVideo(request)
          break
        case 'zip':
          console.log(`🔄 [UNIFIED-PROCESSOR] Routing to zip processor`)
          await this.processZip(request)
          break
        default:
          console.error(`❌ [UNIFIED-PROCESSOR] Unknown media type: ${request.mediaType}`)
          logger.error(`Unknown media type: ${request.mediaType}`)
          await this.publishError(request, `Unknown media type: ${request.mediaType}`)
      }
    } catch (error) {
      console.error(`❌ [UNIFIED-PROCESSOR] Error processing message:`, error)
      logger.error('Error processing message:', error)
      // Try to parse the message to get mediaId for error reporting
      try {
        const request = JSON.parse(message) as MediaProcessingRequest
        await this.publishError(request, error instanceof Error ? error.message : 'Unknown error')
      } catch (parseError) {
        console.error(`❌ [UNIFIED-PROCESSOR] Failed to parse message for error reporting:`, parseError)
        logger.error('Failed to parse message for error reporting:', parseError)
      }
    }
  }

  private async processImage(request: MediaProcessingRequest): Promise<void> {
    try {
      console.log(`🖼️ [IMAGE-PROCESSOR] Starting image processing for media ${request.mediaId}`)
      console.log(`🖼️ [IMAGE-PROCESSOR] S3 Key: ${request.s3Key}`)
      console.log(`🖼️ [IMAGE-PROCESSOR] Original filename: ${request.originalFilename}`)
      
      // Publish progress update
      console.log(`🖼️ [IMAGE-PROCESSOR] Publishing progress update: 10% - Starting image processing`)
      await this.publishProgress(request, 'PROCESSING', 10, 'Starting image processing')

      // Download image from S3
      console.log(`🖼️ [IMAGE-PROCESSOR] Downloading image from S3...`)
      const localImagePath = await this.s3Service.downloadImage(request.s3Key)
      console.log(`🖼️ [IMAGE-PROCESSOR] Image downloaded successfully to: ${localImagePath}`)
      await this.publishProgress(request, 'PROCESSING', 30, 'Downloaded image from S3')

      // Process image with multiple versions
      console.log(`🖼️ [IMAGE-PROCESSOR] Processing image with multiple versions...`)
      await this.publishProgress(request, 'PROCESSING', 50, 'Processing image versions')
      
      const processingResult = await this.imageProcessor.processImage(localImagePath, request.mediaId)
      console.log(`🖼️ [IMAGE-PROCESSOR] Image processing completed:`, JSON.stringify(processingResult, null, 2))
      
      await this.publishProgress(request, 'PROCESSING', 80, 'Uploading processed versions to S3')

      // Upload processed versions to S3
      const uploadedVersions = []
      for (const output of processingResult.outputs) {
        if (output.localPath) {
          console.log(`🖼️ [IMAGE-PROCESSOR] Uploading ${output.type} version: ${output.localPath}`)
          const s3Key = await this.s3Service.uploadImageVersion(output.localPath, request.mediaId, output.quality || 'original')
          uploadedVersions.push({
            quality: output.quality,
            s3Key: s3Key,
            width: output.width,
            height: output.height,
            fileSize: output.fileSize
          })
        }
      }

      console.log(`🖼️ [IMAGE-PROCESSOR] All versions uploaded successfully`)
      await this.publishProgress(request, 'PROCESSING', 90, 'Uploaded all versions to S3')

      // Find the original/highest quality version for the main URL
      const originalVersion = uploadedVersions.find(v => v.quality === 'original') || uploadedVersions[0]
      const thumbnailVersion = uploadedVersions.find(v => v.quality === 'thumbnail') || originalVersion
      
      if (!originalVersion || !thumbnailVersion) {
        throw new Error('Failed to find required image versions')
      }

      // Publish completion result
      console.log(`🖼️ [IMAGE-PROCESSOR] Publishing completion result`)
      await this.publishResult(request, 'COMPLETED', {
        s3Key: originalVersion.s3Key,
        thumbnailS3Key: thumbnailVersion.s3Key,
        width: processingResult.metadata.width,
        height: processingResult.metadata.height,
        metadata: {
          imageVersions: uploadedVersions,
          processingTime: processingResult.processingTime,
          originalMetadata: processingResult.metadata
        }
      })

      console.log(`✅ [IMAGE-PROCESSOR] Image processing completed for media ${request.mediaId}`)
      logger.info(`Image processing completed for media ${request.mediaId}`)
    } catch (error) {
      console.error(`❌ [IMAGE-PROCESSOR] Image processing failed for media ${request.mediaId}:`, error)
      logger.error(`Image processing failed for media ${request.mediaId}:`, error)
      await this.publishError(request, error instanceof Error ? error.message : 'Image processing failed')
    }
  }

  private async processVideo(request: MediaProcessingRequest): Promise<void> {
    try {
      console.log(`🎬 [VIDEO-PROCESSOR] Starting video processing for media ${request.mediaId}`)
      console.log(`🎬 [VIDEO-PROCESSOR] S3 Key: ${request.s3Key}`)
      console.log(`🎬 [VIDEO-PROCESSOR] Original filename: ${request.originalFilename}`)

      // Publish progress update
      await this.publishProgress(request, 'PROCESSING', 10, 'Starting video processing')

      // Download video from S3
      const localVideoPath = await this.s3Service.downloadFile(request.s3Key)
      await this.publishProgress(request, 'PROCESSING', 30, 'Downloaded video from S3')

      console.log(`🎬 [VIDEO-PROCESSOR] Video downloaded to: ${localVideoPath}`)

      // Process video with StandaloneVideoProcessor
      const result = await this.videoProcessor.processVideo(localVideoPath, request.mediaId)
      
      if (!result.success) {
        throw new Error(result.error || 'Video processing failed')
      }

      console.log(`🎬 [VIDEO-PROCESSOR] Video processing completed, generated ${result.outputs?.length || 0} outputs`)

      // Upload processed files to S3
      const videoVersions: any[] = []
      const thumbnails: any[] = []
      let thumbnailS3Key = ''
      let mainVideoS3Key = ''
      let width = 0
      let height = 0
      let duration = 0

      if (result.outputs) {
        for (const output of result.outputs) {
          if (output.localPath) {
            // Upload to S3
            const s3Key = await this.s3Service.uploadVideoVersion(
              output.localPath,
              request.mediaId,
              output.quality || 'original'
            )

            const versionData = {
              quality: output.quality || 'original',
              s3Key: s3Key,
              width: output.width,
              height: output.height,
              fileSize: output.fileSize,
              mimeType: output.mimeType
            }

            // Separate thumbnails from video versions
            if (output.type === 'thumbnail') {
              thumbnails.push(versionData)
              thumbnailS3Key = s3Key
            } else {
              videoVersions.push(versionData)
            }

            // Set main video
            if (output.quality === 'original') {
              mainVideoS3Key = s3Key
              width = output.width
              height = output.height
            }
          }
        }
      }

      // Set duration from metadata
      if (result.metadata) {
        duration = result.metadata.duration || 0
      }

      await this.publishProgress(request, 'PROCESSING', 90, 'Uploaded processed video to S3')

      // Publish completion result
      await this.publishResult(request, 'COMPLETED', {
        s3Key: mainVideoS3Key,
        thumbnailS3Key: thumbnailS3Key,
        width: width,
        height: height,
        duration: duration,
        metadata: {
          videoVersions: videoVersions,
          thumbnails: thumbnails,
          processingTime: result.processingTime,
          originalMetadata: result.metadata
        }
      })

      console.log(`✅ [VIDEO-PROCESSOR] Video processing completed for media ${request.mediaId}`)
      logger.info(`Video processing completed for media ${request.mediaId}`)
    } catch (error) {
      console.error(`❌ [VIDEO-PROCESSOR] Video processing failed for media ${request.mediaId}:`, error)
      logger.error(`Video processing failed for media ${request.mediaId}:`, error)
      await this.publishError(request, error instanceof Error ? error.message : 'Video processing failed')
    }
  }

  private async processZip(request: MediaProcessingRequest): Promise<void> {
    try {
      // Publish progress update
      await this.publishProgress(request, 'PROCESSING', 10, 'Starting zip processing')

      // Download zip from S3
      const localPath = await this.s3Service.downloadFile(request.s3Key)
      await this.publishProgress(request, 'PROCESSING', 20, 'Downloaded zip from S3')

      // Extract zip file
      const extractedFiles = await this.zipExtractionService.extractZipFile(localPath, this.tempDir)
      await this.publishProgress(request, 'PROCESSING', 40, `Extracted ${extractedFiles.length} files from zip`)

      // Process extracted files
      const processedMedia: any[] = []
      let processedCount = 0

      console.log(`📦 [ZIP-PROCESSOR] Processing ${extractedFiles.length} extracted files`)

      // Parse allowed types from request metadata
      let allowedTypes: string[] = ['IMAGE', 'VIDEO'] // Default
      if (request.metadata && 'options' in request.metadata) {
        try {
          const options = JSON.parse(request.metadata['options'] as string)
          if (options.allowedTypes) {
            allowedTypes = options.allowedTypes
          }
        } catch (error) {
          console.warn(`📦 [ZIP-PROCESSOR] Failed to parse options:`, error)
        }
      }
      console.log(`📦 [ZIP-PROCESSOR] Allowed types: ${allowedTypes.join(', ')}`)

      for (const file of extractedFiles) {
        try {
          console.log(`📦 [ZIP-PROCESSOR] Processing file: ${file.originalPath}`)
          
          // Validate file
          const validationResult = await this.fileValidationService.validateMediaFile(file.filepath, file.originalPath)
          if (!validationResult.isValid) {
            console.log(`📦 [ZIP-PROCESSOR] Skipping invalid file: ${file.originalPath} - ${validationResult.error}`)
            continue
          }

          // Determine media type
          const mimeType = validationResult.mimeType || 'application/octet-stream'
          const isImage = mimeType.startsWith('image/')
          const isVideo = mimeType.startsWith('video/')
          
          // Check if this file type is allowed
          const fileType = isImage ? 'IMAGE' : isVideo ? 'VIDEO' : 'OTHER'
          const isAllowed = allowedTypes.includes(fileType)

          if (isAllowed && (isImage || isVideo)) {
            console.log(`📦 [ZIP-PROCESSOR] Valid media file: ${file.originalPath} (${mimeType})`)
            
            // Create S3 key: <zip_s3key>.<sanitized_file_path>
            const sanitizedPath = file.originalPath.replace(/[^a-zA-Z0-9._-]/g, '_')
            const s3Key = `${request.s3Key}.${sanitizedPath}`
            
            // Upload original file to S3 first
            console.log(`📦 [ZIP-PROCESSOR] Uploading original to S3: ${s3Key}`)
            await this.s3Service.uploadFile(file.filepath, s3Key, mimeType)
            
            let processedResult: any = null
            let thumbnailS3Key = s3Key
            let width = 0
            let height = 0
            let duration = 0
            let versions: any[] = []

            if (isImage) {
              console.log(`📦 [ZIP-PROCESSOR] Processing image through StandaloneImageProcessor: ${file.originalPath}`)
              try {
                // Process image through StandaloneImageProcessor
                processedResult = await this.standaloneImageProcessor.processImage(
                  file.filepath,
                  request.mediaId
                )

                if (processedResult && processedResult.outputs) {
                  // Upload all image versions to S3 with unique keys
                  for (const output of processedResult.outputs) {
                    if (output.localPath) {
                      // Create unique S3 key using sanitized original path
                      const sanitizedPath = file.originalPath.replace(/[^a-zA-Z0-9._-]/g, '_')
                      const uniqueS3Key = `${s3Key}.${sanitizedPath}_${output.quality || 'original'}.jpg`
                      
                      // Upload to S3 with custom key
                      await this.s3Service.uploadFile(output.localPath, uniqueS3Key, output.mimeType || 'image/jpeg')
                      
                      versions.push({
                        quality: output.quality || 'original',
                        s3Key: uniqueS3Key,
                        width: output.width,
                        height: output.height,
                        fileSize: output.fileSize,
                        mimeType: output.mimeType
                      })

                      // Set thumbnail and main image
                      if (output.quality === 'thumbnail') {
                        thumbnailS3Key = uniqueS3Key
                      }
                      if (output.quality === 'original' || !versions.find(v => v.quality === 'original')) {
                        width = output.width
                        height = output.height
                      }
                    }
                  }
                }
              } catch (error) {
                console.error(`📦 [ZIP-PROCESSOR] Image processing failed for ${file.originalPath}:`, error)
                // Fallback to basic processing
                const sharp = require('sharp')
                const metadata = await sharp(file.filepath).metadata()
                width = metadata.width || 0
                height = metadata.height || 0
              }
            } else if (isVideo) {
              console.log(`📦 [ZIP-PROCESSOR] Processing video through StandaloneVideoProcessor: ${file.originalPath}`)
              try {
                // Process video through StandaloneVideoProcessor
                processedResult = await this.standaloneVideoProcessor.processVideo(
                  file.filepath,
                  request.mediaId
                )

                if (processedResult && processedResult.outputs) {
                  // Upload all video versions to S3 with unique keys
                  for (const output of processedResult.outputs) {
                    if (output.localPath) {
                      // Create unique S3 key using sanitized original path
                      const sanitizedPath = file.originalPath.replace(/[^a-zA-Z0-9._-]/g, '_')
                      const uniqueS3Key = `${s3Key}.${sanitizedPath}_${output.quality || 'original'}.mp4`
                      
                      // Upload to S3 with custom key
                      await this.s3Service.uploadFile(output.localPath, uniqueS3Key, output.mimeType || 'video/mp4')
                      
                      versions.push({
                        quality: output.quality || 'original',
                        s3Key: uniqueS3Key,
                        width: output.width,
                        height: output.height,
                        fileSize: output.fileSize,
                        mimeType: output.mimeType
                      })

                      // Set thumbnail and main video
                      if (output.type === 'thumbnail') {
                        thumbnailS3Key = uniqueS3Key
                      }
                      if (output.quality === 'original' || !versions.find(v => v.quality === 'original')) {
                        width = output.width
                        height = output.height
                        duration = output.duration || 0
                      }
                    }
                  }
                }
              } catch (error) {
                console.error(`📦 [ZIP-PROCESSOR] Video processing failed for ${file.originalPath}:`, error)
                // Fallback to basic processing
                duration = 60 // Placeholder
              }
            }

            processedMedia.push({
              s3Key: s3Key,
              thumbnailS3Key: thumbnailS3Key,
              originalFilename: file.filename,
              mimeType: mimeType,
              width: width,
              height: height,
              duration: duration,
              versions: versions,
              metadata: {
                originalPath: file.originalPath,
                fileSize: file.size,
                processingTime: processedResult?.processingTime || 0,
                originalMetadata: processedResult?.metadata || {}
              }
            })
            
            console.log(`📦 [ZIP-PROCESSOR] Successfully processed: ${file.originalPath} -> ${s3Key} (${versions.length} versions)`)
          } else if (!isAllowed) {
            console.log(`📦 [ZIP-PROCESSOR] Skipping file (not in allowed types): ${file.originalPath} (${fileType})`)
          } else {
            console.log(`📦 [ZIP-PROCESSOR] Skipping non-media file: ${file.originalPath} (${mimeType})`)
          }

          processedCount++
          const progress = 40 + (processedCount / extractedFiles.length) * 50
          await this.publishProgress(request, 'PROCESSING', Math.round(progress), `Processed ${processedCount}/${extractedFiles.length} files`)
        } catch (error) {
          console.error(`📦 [ZIP-PROCESSOR] Failed to process file ${file.originalPath}:`, error)
          // Continue processing other files
        }
      }

      // Publish completion result
      await this.publishResult(request, 'COMPLETED', {
        extractedMedia: processedMedia,
        metadata: {
          extractedCount: processedMedia.length,
          totalFiles: extractedFiles.length,
          userId: request.userId
        }
      })

      logger.info(`Zip processing completed for media ${request.mediaId}: ${processedMedia.length} files processed`)
    } catch (error) {
      logger.error(`Zip processing failed for media ${request.mediaId}:`, error)
      await this.publishError(request, error instanceof Error ? error.message : 'Zip processing failed')
    }
  }

  private async publishProgress(
    request: MediaProcessingRequest,
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED',
    progress: number,
    message?: string
  ): Promise<void> {
    const update: MediaProgressUpdate = {
      messageType: 'progress',
      mediaType: request.mediaType,
      mediaId: request.mediaId,
      userId: request.userId,
      timestamp: new Date().toISOString(),
      status,
      progress,
      message,
      stage: 'processing',
      details: {
        jobId: request.metadata?.['jobId']
      }
    }

    const queues = createNamespacedMediaQueues()
    await publishMessage(queues.updates, update)
  }

  private async publishResult(
    request: MediaProcessingRequest,
    status: 'COMPLETED' | 'FAILED',
    result?: any
  ): Promise<void> {
    const update: MediaProcessingResult = {
      messageType: 'result',
      mediaType: request.mediaType,
      mediaId: request.mediaId,
      userId: request.userId,
      timestamp: new Date().toISOString(),
      status,
      result,
      details: {
        jobId: request.metadata?.['jobId']
      }
    }

    const queues = createNamespacedMediaQueues()
    await publishMessage(queues.updates, update)
  }

  private async publishError(
    request: MediaProcessingRequest,
    error: string
  ): Promise<void> {
    const update: MediaProcessingMessage = {
      messageType: 'error',
      mediaType: request.mediaType,
      mediaId: request.mediaId,
      userId: request.userId,
      timestamp: new Date().toISOString(),
      error,
      details: {
        jobId: request.metadata?.['jobId']
      }
    } as MediaProcessingMessage

    const queues = createNamespacedMediaQueues()
    await publishMessage(queues.updates, update)
  }
}
