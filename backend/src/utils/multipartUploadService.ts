import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand } from '@aws-sdk/client-s3'
import { uploadConfig } from '@/config/upload'

// S3 Client configuration for IDrive
const s3Args = {
  region: process.env.IDRIVE_REGION || 'us-east-1',
  endpoint: process.env.IDRIVE_ENDPOINT,
  credentials: {
    accessKeyId: process.env.IDRIVE_ACCESS_KEY_ID!,
    secretAccessKey: process.env.IDRIVE_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true, // Required for S3-compatible services
}

const s3Client = new S3Client(s3Args)
const BUCKET_NAME = process.env.IDRIVE_BUCKET_NAME

// Configuration - use upload config
const CHUNK_SIZE = uploadConfig.chunkSize
const MAX_CONCURRENT_CHUNKS = uploadConfig.maxConcurrentChunks
const MAX_RETRIES = uploadConfig.maxRetries
const CHUNK_SIZE_THRESHOLD = uploadConfig.chunkSizeThreshold

export interface MultipartUploadConfig {
  chunkSize: number
  maxConcurrentChunks: number
  maxRetries: number
  chunkSizeThreshold: number
}

export interface ChunkInfo {
  partNumber: number
  start: number
  end: number
  size: number
}

export interface MultipartUploadState {
  uploadId: string
  key: string
  parts: Array<{
    PartNumber: number
    ETag: string
  }>
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'aborted'
  error?: string
}

export interface UploadProgress {
  uploadedBytes: number
  totalBytes: number
  percentage: number
  currentChunk: number
  totalChunks: number
  status: 'pending' | 'uploading' | 'completed' | 'failed'
}

export class MultipartUploadService {
  private config: MultipartUploadConfig

  constructor(config?: Partial<MultipartUploadConfig>) {
    this.config = {
      chunkSize: config?.chunkSize || CHUNK_SIZE,
      maxConcurrentChunks: config?.maxConcurrentChunks || MAX_CONCURRENT_CHUNKS,
      maxRetries: config?.maxRetries || MAX_RETRIES,
      chunkSizeThreshold: config?.chunkSizeThreshold || CHUNK_SIZE_THRESHOLD
    }
  }

  /**
   * Check if a file should use multipart upload
   */
  shouldUseMultipart(fileSize: number): boolean {
    return fileSize > this.config.chunkSizeThreshold
  }

  /**
   * Calculate chunks for a file
   */
  calculateChunks(fileSize: number): ChunkInfo[] {
    const chunks: ChunkInfo[] = []
    let partNumber = 1
    let start = 0

    while (start < fileSize) {
      const end = Math.min(start + this.config.chunkSize, fileSize)
      const size = end - start

      chunks.push({
        partNumber,
        start,
        end,
        size
      })

      start = end
      partNumber++
    }

    return chunks
  }

  /**
   * Initialize multipart upload
   */
  async initiateMultipartUpload(key: string, contentType: string, metadata?: Record<string, string>): Promise<string> {
    console.log('initiateMultipartUpload', key, contentType, metadata)
    if(metadata &&  metadata['tags']) {
      delete metadata['tags']
      
    }
    
    const command = new CreateMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      Metadata: metadata,
      ACL: 'public-read'
    })

    const response = await s3Client.send(command)
    return response.UploadId!
  }

  /**
   * Upload a single chunk
   */
  async uploadChunk(
    key: string,
    uploadId: string,
    partNumber: number,
    chunk: Buffer,
    retryCount = 0
  ): Promise<string> {
    try {
      const command = new UploadPartCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: chunk
      })

      const response = await s3Client.send(command)
      return response.ETag!
    } catch (error) {
      if (retryCount < this.config.maxRetries) {
        console.warn(`Chunk upload failed, retrying (${retryCount + 1}/${this.config.maxRetries}):`, error)
        await this.delay(1000 * (retryCount + 1)) // Exponential backoff
        return this.uploadChunk(key, uploadId, partNumber, chunk, retryCount + 1)
      }
      throw error
    }
  }

  /**
   * Complete multipart upload
   */
  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: Array<{ PartNumber: number; ETag: string }>
  ): Promise<string> {
    const command = new CompleteMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber)
      }
    })

    const response = await s3Client.send(command)
    // Return the key, not the full URL location
    return key
  }

  /**
   * Abort multipart upload
   */
  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    const command = new AbortMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      UploadId: uploadId
    })

    await s3Client.send(command)
  }

  /**
   * Upload file in chunks with progress tracking
   */
  async uploadFileInChunks(
    fileBuffer: Buffer,
    key: string,
    contentType: string,
    metadata?: Record<string, string>,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<string> {
    // Check if we should use multipart upload
    if (!this.shouldUseMultipart(fileBuffer.length)) {
      // For small files, use regular upload
      const { uploadToS3 } = await import('./s3Service')
      return uploadToS3(fileBuffer, key.split('/').pop() || 'file', contentType, key.split('/')[1] || 'unknown')
    }

    const chunks = this.calculateChunks(fileBuffer.length)
    const uploadId = await this.initiateMultipartUpload(key, contentType, metadata)
    
    try {
      const parts: Array<{ PartNumber: number; ETag: string }> = []
      let uploadedBytes = 0
      let currentChunk = 0

      // Process chunks with controlled concurrency
      for (let i = 0; i < chunks.length; i += this.config.maxConcurrentChunks) {
        const chunkBatch = chunks.slice(i, i + this.config.maxConcurrentChunks)
        const uploadPromises = chunkBatch.map(async (chunk) => {
          const chunkBuffer = fileBuffer.slice(chunk.start, chunk.end)
          const etag = await this.uploadChunk(key, uploadId, chunk.partNumber, chunkBuffer)
          
          parts.push({
            PartNumber: chunk.partNumber,
            ETag: etag
          })

          uploadedBytes += chunk.size
          currentChunk++

          // Report progress
          if (onProgress) {
            onProgress({
              uploadedBytes,
              totalBytes: fileBuffer.length,
              percentage: Math.round((uploadedBytes / fileBuffer.length) * 100),
              currentChunk,
              totalChunks: chunks.length,
              status: 'uploading'
            })
          }
        })

        // Wait for current batch to complete before starting next batch
        await Promise.all(uploadPromises)
      }

      // Complete the multipart upload
      const result = await this.completeMultipartUpload(key, uploadId, parts)
      
      if (onProgress) {
        onProgress({
          uploadedBytes: fileBuffer.length,
          totalBytes: fileBuffer.length,
          percentage: 100,
          currentChunk: chunks.length,
          totalChunks: chunks.length,
          status: 'completed'
        })
      }

      return result
    } catch (error) {
      // Abort upload on failure
      try {
        await this.abortMultipartUpload(key, uploadId)
      } catch (abortError) {
        console.error('Failed to abort multipart upload:', abortError)
      }
      throw error
    }
  }

  /**
   * Helper function to add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get configuration
   */
  getConfig(): MultipartUploadConfig {
    return { ...this.config }
  }
}

// Export singleton instance
export const multipartUploadService = new MultipartUploadService() 