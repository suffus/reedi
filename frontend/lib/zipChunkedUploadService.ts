import { API_BASE_URL, getAuthHeaders } from './api'
import { genericChunkedUploadService, ChunkedUploadConfig, UploadProgress, ChunkedUploadEndpoints } from './genericChunkedUploadService'

export interface ZipUploadOptions {
  preserveStructure?: boolean
  maxFileSize?: number
  allowedTypes?: ('IMAGE' | 'VIDEO' | 'DOCUMENT')[]
}

export interface ZipUploadResult {
  success: boolean
  data?: {
    batchId: string
    status: string
    filename: string
  }
  error?: string
}

export class ZipChunkedUploadService {
  private genericUploadService = genericChunkedUploadService
  private zipEndpoints: ChunkedUploadEndpoints = {
    initiate: `${API_BASE_URL}/media/upload/initiate`,
    chunk: `${API_BASE_URL}/media/upload/chunk`,
    complete: `${API_BASE_URL}/media/upload/complete`
  }

  constructor(config?: Partial<ChunkedUploadConfig>) {
    // Update the generic service config if provided
    if (config) {
      Object.assign(this.genericUploadService, config)
    }
  }

  /**
   * Upload a zip file using chunked upload for large files or direct upload for small files
   */
  async uploadZipFile(
    file: File,
    options: ZipUploadOptions = {},
    onProgress?: (progress: UploadProgress) => void
  ): Promise<ZipUploadResult> {
    try {
      // For small files (< 5MB), use direct upload
      if (!this.genericUploadService.shouldUseChunkedUpload(file.size)) {
        return await this.directUpload(file, options)
      }

      // For large files (>= 5MB), use chunked upload
      return await this.chunkedUpload(file, options, onProgress)
    } catch (error) {
      console.error('Zip upload error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      }
    }
  }

  /**
   * Direct upload for small zip files
   */
  private async directUpload(file: File, options: ZipUploadOptions): Promise<ZipUploadResult> {
    const formData = new FormData()
    formData.append('media', file) // Backend expects 'media' field, not 'zipFile'

    // Add options to form data
    if (options.preserveStructure !== undefined) {
      formData.append('preserveStructure', String(options.preserveStructure))
    }
    if (options.maxFileSize !== undefined) {
      formData.append('maxFileSize', String(options.maxFileSize))
    }
    if (options.allowedTypes) {
      formData.append('allowedTypes', JSON.stringify(options.allowedTypes))
    }

    const token = localStorage.getItem('token')
    const response = await fetch(`${API_BASE_URL}/media/upload`, {
      method: 'POST',
      headers: getAuthHeaders(token || undefined),
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Upload failed')
    }

    const result = await response.json()
    
    // Convert the media upload response to zip upload result format
    return {
      success: true,
      data: {
        batchId: result.id, // Use media ID as batch ID
        status: 'PENDING',
        filename: file.name
      }
    }
  }

  /**
   * Chunked upload for large zip files
   */
  private async chunkedUpload(
    file: File,
    options: ZipUploadOptions,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<ZipUploadResult> {
    const result = await this.genericUploadService.uploadFile(
      file,
      this.zipEndpoints,
      {
        filename: file.name,
        fileSize: file.size,
        contentType: 'application/zip',
        options: JSON.stringify(options)
      },
      onProgress
    )

    if (!result.success) {
      return {
        success: false,
        error: result.error
      }
    }

    // The generic service handles the complete upload, so we just return success
    return {
      success: true,
      data: {
        batchId: result.uploadId!, // This will be the batch ID from the complete response
        status: 'PENDING',
        filename: file.name
      }
    }
  }

  /**
   * Cancel an ongoing upload
   */
  async cancelUpload(uploadId: string, key: string): Promise<void> {
    await this.genericUploadService.cancelUpload(uploadId, key)
  }
}

// Export a default instance
export const zipChunkedUploadService = new ZipChunkedUploadService()
