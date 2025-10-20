import { API_ENDPOINTS } from './api'
import { genericChunkedUploadService, ChunkedUploadConfig, UploadProgress, ChunkedUploadEndpoints } from './genericChunkedUploadService'

export interface MediaUploadMetadata {
  title?: string
  description?: string
  tags?: string[]
  userId?: string
  visibility?: 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE'
}

export interface MediaUploadResult {
  success: boolean
  data?: {
    id: string
    url: string
    thumbnail?: string
    filename: string
    size: number
    mimeType: string
    mediaType: 'IMAGE' | 'VIDEO'
  }
  error?: string
}

export class MediaChunkedUploadService {
  private genericUploadService = genericChunkedUploadService
  private mediaEndpoints: ChunkedUploadEndpoints = {
    initiate: `${API_ENDPOINTS.MEDIA.UPLOAD}/initiate`,
    chunk: `${API_ENDPOINTS.MEDIA.UPLOAD}/chunk`,
    complete: `${API_ENDPOINTS.MEDIA.UPLOAD}/complete`
  }

  constructor(config?: Partial<ChunkedUploadConfig>) {
    // Update the generic service config if provided
    if (config) {
      Object.assign(this.genericUploadService, config)
    }
  }

  /**
   * Check if a file should use chunked upload
   */
  shouldUseChunkedUpload(fileSize: number): boolean {
    return this.genericUploadService.shouldUseChunkedUpload(fileSize)
  }

  /**
   * Upload a media file using chunked upload for large files or direct upload for small files
   */
  async uploadFile(
    file: File,
    metadata: MediaUploadMetadata = {},
    onProgress?: (progress: UploadProgress) => void
  ): Promise<MediaUploadResult> {
    try {
      // For small files, use direct upload
      if (!this.shouldUseChunkedUpload(file.size)) {
        return await this.directUpload(file, metadata)
      }

      // For large files, use chunked upload
      return await this.chunkedUpload(file, metadata, onProgress)
    } catch (error) {
      console.error('Media upload error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      }
    }
  }

  /**
   * Direct upload for small media files
   */
  private async directUpload(file: File, metadata: MediaUploadMetadata): Promise<MediaUploadResult> {
    const formData = new FormData()
    formData.append('media', file)
    formData.append('title', metadata.title || '')
    formData.append('description', metadata.description || '')
    formData.append('tags', JSON.stringify(metadata.tags || []))
    formData.append('userId', metadata.userId || '')
    formData.append('visibility', metadata.visibility || 'PUBLIC')

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

    return {
      success: true,
      data: {
        id: data.data.id,
        url: data.data.url,
        thumbnail: data.data.thumbnail,
        filename: data.data.filename,
        size: data.data.size,
        mimeType: data.data.mimeType,
        mediaType: data.data.mediaType
      }
    }
  }

  /**
   * Chunked upload for large media files
   */
  private async chunkedUpload(
    file: File,
    metadata: MediaUploadMetadata,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<MediaUploadResult> {
    const result = await this.genericUploadService.uploadFile(
      file,
      this.mediaEndpoints,
      {
        filename: file.name,
        fileSize: file.size,
        title: metadata.title || '',
        description: metadata.description || '',
        tags: JSON.stringify(metadata.tags || []),
        userId: metadata.userId || '',
        visibility: metadata.visibility || 'PUBLIC'
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
    // The actual media data would come from the complete response
    return {
      success: true,
      data: {
        id: result.uploadId!, // This will be the media ID from the complete response
        url: '', // Would be populated from complete response
        filename: file.name,
        size: file.size,
        mimeType: file.type,
        mediaType: file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE'
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
export const mediaChunkedUploadService = new MediaChunkedUploadService()



