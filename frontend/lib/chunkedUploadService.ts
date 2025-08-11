import { API_ENDPOINTS, getAuthHeaders } from './api'

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

export class ChunkedUploadService {
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
    filename: string,
    contentType: string,
    fileSize: number,
    metadata?: Record<string, any>
  ): Promise<{ uploadId: string; key: string; chunkSize: number; maxConcurrentChunks: number }> {
    const token = localStorage.getItem('token')
    if (!token) throw new Error('No token found')

    const response = await fetch(`${API_ENDPOINTS.MEDIA.UPLOAD}/initiate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filename,
        contentType,
        fileSize,
        metadata
      })
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Failed to initiate upload')

    return data
  }

  /**
   * Upload a single chunk
   */
  async uploadChunk(
    uploadId: string,
    key: string,
    partNumber: number,
    chunk: Blob,
    retryCount = 0
  ): Promise<{ partNumber: number; etag: string; size: number }> {
    try {
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No token found')

      // Create FormData to send binary chunk
      const formData = new FormData()
      formData.append('uploadId', uploadId)
      formData.append('key', key)
      formData.append('partNumber', partNumber.toString())
      formData.append('chunk', chunk, `chunk-${partNumber}.bin`)

      const response = await fetch(`${API_ENDPOINTS.MEDIA.UPLOAD}/chunk`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
          // Don't set Content-Type, let browser set it with boundary for FormData
        },
        body: formData
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to upload chunk')

      return data
    } catch (error) {
      if (retryCount < this.config.maxRetries) {
        console.warn(`Chunk upload failed, retrying (${retryCount + 1}/${this.config.maxRetries}):`, error)
        await this.delay(1000 * (retryCount + 1)) // Exponential backoff
        return this.uploadChunk(uploadId, key, partNumber, chunk, retryCount + 1)
      }
      throw error
    }
  }

  /**
   * Complete multipart upload
   */
  async completeUpload(
    uploadId: string,
    key: string,
    parts: Array<{ PartNumber: number; ETag: string }>,
    filename: string,
    contentType: string,
    fileSize: number,
    metadata?: Record<string, any>
  ): Promise<any> {
    const token = localStorage.getItem('token')
    if (!token) throw new Error('No token found')

    const response = await fetch(`${API_ENDPOINTS.MEDIA.UPLOAD}/complete`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        uploadId,
        key,
        parts,
        filename,
        contentType,
        fileSize,
        metadata
      })
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Failed to complete upload')

    return data
  }

  /**
   * Abort multipart upload
   */
  async abortUpload(uploadId: string, key: string): Promise<void> {
    const token = localStorage.getItem('token')
    if (!token) throw new Error('No token found')

    const response = await fetch(`${API_ENDPOINTS.MEDIA.UPLOAD}/abort`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        uploadId,
        key
      })
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to abort upload')
    }
  }

  /**
   * Upload file with chunking support
   */
  async uploadFile(
    file: File,
    metadata?: Record<string, any>,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<any> {
    // Check if we should use chunked upload
    if (!this.shouldUseChunkedUpload(file.size)) {
      // For small files, use regular upload
      const formData = new FormData()
      formData.append('media', file)
      formData.append('title', metadata?.title || '')
      formData.append('description', metadata?.description || '')
      formData.append('tags', JSON.stringify(metadata?.tags || []))
      formData.append('userId', metadata?.userId || '')
      formData.append('visibility', metadata?.visibility || 'PUBLIC')

      const token = localStorage.getItem('token')
      if (!token) throw new Error('No token found')

      const response = await fetch(API_ENDPOINTS.MEDIA.UPLOAD, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to upload file')

      return data
    }

    // Use chunked upload for large files
    const chunks = this.calculateChunks(file)
    
    // Initiate multipart upload
    const { uploadId, key } = await this.initiateUpload(
      file.name,
      file.type,
      file.size,
      metadata
    )

    const parts: Array<{ PartNumber: number; ETag: string }> = []
    let uploadedBytes = 0
    let currentChunk = 0
    
    try {

      // Report initial progress
      if (onProgress) {
        onProgress({
          uploadedBytes: 0,
          totalBytes: file.size,
          percentage: 0,
          currentChunk: 0,
          totalChunks: chunks.length,
          status: 'uploading'
        })
      }

      // Process chunks with controlled concurrency
      for (let i = 0; i < chunks.length; i += this.config.maxConcurrentChunks) {
        const chunkBatch = chunks.slice(i, i + this.config.maxConcurrentChunks)
        const uploadPromises = chunkBatch.map(async (chunk) => {
          const result = await this.uploadChunk(uploadId, key, chunk.partNumber, chunk.data)
          
          parts.push({
            PartNumber: result.partNumber,
            ETag: result.etag
          })

          // Update progress atomically
          const newUploadedBytes = uploadedBytes + chunk.size
          const newCurrentChunk = currentChunk + 1
          uploadedBytes = newUploadedBytes
          currentChunk = newCurrentChunk

          // Report progress
          if (onProgress) {
            onProgress({
              uploadedBytes: newUploadedBytes,
              totalBytes: file.size,
              percentage: Math.round((newUploadedBytes / file.size) * 100),
              currentChunk: newCurrentChunk,
              totalChunks: chunks.length,
              status: 'uploading'
            })
          }
        })

        // Wait for current batch to complete before starting next batch
        await Promise.all(uploadPromises)
      }

      // Complete the multipart upload
      const result = await this.completeUpload(
        uploadId,
        key,
        parts,
        file.name,
        file.type,
        file.size,
        metadata
      )

      // Report completion
      if (onProgress) {
        onProgress({
          uploadedBytes: file.size,
          totalBytes: file.size,
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
        await this.abortUpload(uploadId, key)
      } catch (abortError) {
        console.error('Failed to abort multipart upload:', abortError)
      }

      // Report failure
      if (onProgress) {
        onProgress({
          uploadedBytes: uploadedBytes,
          totalBytes: file.size,
          percentage: Math.round((uploadedBytes / file.size) * 100),
          currentChunk: currentChunk,
          totalChunks: chunks.length,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Upload failed'
        })
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
  getConfig(): ChunkedUploadConfig {
    return { ...this.config }
  }
}

// Export singleton instance
export const chunkedUploadService = new ChunkedUploadService() 