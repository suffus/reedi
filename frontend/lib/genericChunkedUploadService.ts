import { API_BASE_URL, getAuthHeaders } from './api'

export interface ChunkedUploadConfig {
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
  data: Blob
}

export interface UploadProgress {
  uploadedBytes: number
  totalBytes: number
  percentage: number
  currentChunk: number
  totalChunks: number
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'aborted'
  error?: string
}

export interface MultipartUploadState {
  uploadId: string
  key: string
  parts: Array<{
    PartNumber: number
    ETag: string
  }>
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'aborted'
}

export interface ChunkedUploadEndpoints {
  initiate: string
  chunk: string
  complete: string
}

export interface ChunkedUploadResult {
  success: boolean
  uploadId?: string
  key?: string
  parts?: Array<{ PartNumber: number; ETag: string }>
  error?: string
}

export class GenericChunkedUploadService {
  private config: ChunkedUploadConfig

  constructor(config?: Partial<ChunkedUploadConfig>) {
    this.config = {
      chunkSize: config?.chunkSize || 5 * 1024 * 1024, // 5MB default
      maxConcurrentChunks: config?.maxConcurrentChunks || 3,
      maxRetries: config?.maxRetries || 3,
      chunkSizeThreshold: config?.chunkSizeThreshold || 5 * 1024 * 1024 // 5MB threshold
    }
  }

  /**
   * Check if a file should use chunked upload
   */
  shouldUseChunkedUpload(fileSize: number): boolean {
    return fileSize > this.config.chunkSizeThreshold
  }

  /**
   * Calculate chunks for a file
   */
  calculateChunks(file: File): ChunkInfo[] {
    const chunks: ChunkInfo[] = []
    let partNumber = 1
    let start = 0

    while (start < file.size) {
      const end = Math.min(start + this.config.chunkSize, file.size)
      const size = end - start
      const data = file.slice(start, end)

      chunks.push({
        partNumber,
        start,
        end,
        size,
        data
      })

      start = end
      partNumber++
    }

    return chunks
  }

  /**
   * Initiate multipart upload
   */
  async initiateUpload(
    endpoints: ChunkedUploadEndpoints,
    filename: string,
    fileSize: number,
    metadata?: Record<string, any>
  ): Promise<{ uploadId: string; key: string; chunkSize: number; maxConcurrentChunks: number }> {
    const token = localStorage.getItem('token')
    if (!token) throw new Error('No token found')

    const response = await fetch(endpoints.initiate, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename,
        fileSize,
        contentType: metadata?.contentType || 'application/zip', // Use provided contentType or default to zip
        ...metadata
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to initiate upload')
    }

    const data = await response.json()
    return {
      uploadId: data.uploadId,
      key: data.key,
      chunkSize: data.chunkSize || this.config.chunkSize,
      maxConcurrentChunks: data.maxConcurrentChunks || this.config.maxConcurrentChunks
    }
  }

  /**
   * Upload file in chunks
   */
  async uploadChunks(
    file: File,
    endpoints: ChunkedUploadEndpoints,
    uploadId: string,
    key: string,
    chunkSize: number,
    maxConcurrentChunks: number,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<{ success: boolean; parts?: Array<{ PartNumber: number; ETag: string }>; error?: string }> {
    try {
      const chunks = this.calculateChunks(file)
      const parts: Array<{ PartNumber: number; ETag: string }> = []
      let uploadedBytes = 0

      // Upload chunks with concurrency control
      const semaphore = new Semaphore(maxConcurrentChunks)
      const uploadPromises = chunks.map(async (chunk, index) => {
        await semaphore.acquire()
        try {
          const formData = new FormData()
          formData.append('chunk', chunk.data)
          formData.append('uploadId', uploadId)
          formData.append('key', key)
          formData.append('partNumber', chunk.partNumber.toString())

          const token = localStorage.getItem('token')
          const response = await fetch(endpoints.chunk, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            body: formData,
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Failed to upload chunk')
          }

          const result = await response.json()
          parts.push({
            PartNumber: chunk.partNumber,
            ETag: result.etag
          })

          uploadedBytes += chunk.size
          if (onProgress) {
            onProgress({
              uploadedBytes,
              totalBytes: file.size,
              percentage: (uploadedBytes / file.size) * 100,
              currentChunk: index + 1,
              totalChunks: chunks.length,
              status: 'uploading'
            })
          }

          return result
        } finally {
          semaphore.release()
        }
      })

      await Promise.all(uploadPromises)

      return {
        success: true,
        parts: parts.sort((a, b) => a.PartNumber - b.PartNumber)
      }
    } catch (error) {
      console.error('Chunk upload error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Chunk upload failed'
      }
    }
  }

  /**
   * Complete multipart upload
   */
  async completeUpload(
    endpoints: ChunkedUploadEndpoints,
    uploadId: string,
    key: string,
    parts: Array<{ PartNumber: number; ETag: string }>,
    metadata?: Record<string, any>
  ): Promise<any> {
    const token = localStorage.getItem('token')
    if (!token) throw new Error('No token found')

    const response = await fetch(endpoints.complete, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uploadId,
        key,
        parts,
        ...metadata
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to complete upload')
    }

    return await response.json()
  }

  /**
   * Upload a file using chunked upload
   */
  async uploadFile(
    file: File,
    endpoints: ChunkedUploadEndpoints,
    metadata?: Record<string, any>,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<ChunkedUploadResult> {
    try {
      // Check if we should use chunked upload
      if (!this.shouldUseChunkedUpload(file.size)) {
        throw new Error('File too small for chunked upload')
      }

      // Step 1: Initiate multipart upload
      const { uploadId, key, chunkSize, maxConcurrentChunks } = await this.initiateUpload(
        endpoints,
        file.name,
        file.size,
        metadata
      )

      // Step 2: Upload chunks
      const uploadResult = await this.uploadChunks(
        file,
        endpoints,
        uploadId,
        key,
        chunkSize,
        maxConcurrentChunks,
        onProgress
      )

      if (!uploadResult.success) {
        return {
          success: false,
          error: uploadResult.error
        }
      }

      // Step 3: Complete upload
      const completeResult = await this.completeUpload(
        endpoints,
        uploadId,
        key,
        uploadResult.parts!,
        metadata
      )

      return {
        success: true,
        uploadId,
        key,
        parts: uploadResult.parts
      }
    } catch (error) {
      console.error('Chunked upload error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      }
    }
  }

  /**
   * Cancel an ongoing upload (placeholder - would need backend support)
   */
  async cancelUpload(uploadId: string, key: string): Promise<void> {
    // This would need backend support to abort multipart uploads
    console.warn('Cancel upload not implemented - would need backend support')
  }
}

// Simple semaphore implementation for concurrency control
class Semaphore {
  private permits: number
  private waiting: Array<() => void> = []

  constructor(permits: number) {
    this.permits = permits
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--
      return
    }

    return new Promise(resolve => {
      this.waiting.push(resolve)
    })
  }

  release(): void {
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift()!
      resolve()
    } else {
      this.permits++
    }
  }
}

// Export a default instance
export const genericChunkedUploadService = new GenericChunkedUploadService()


