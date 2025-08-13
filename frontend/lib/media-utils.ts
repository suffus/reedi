import { Media } from './types'
import { BACKEND_BASE_URL } from './api'

export function mapMediaData(rawMedia: any, order: number = 0): Media {
  return {
    id: rawMedia.id,
    url: rawMedia.url || '',
    thumbnail: rawMedia.thumbnail || null,
    s3Key: rawMedia.s3Key,
    thumbnailS3Key: rawMedia.thumbnailS3Key,
    originalFilename: rawMedia.originalFilename,
    altText: rawMedia.altText || rawMedia.title || null,
    caption: rawMedia.caption || rawMedia.description || null,
    width: rawMedia.width || null,
    height: rawMedia.height || null,
    size: rawMedia.size || null,
    mimeType: rawMedia.mimeType || null,
    tags: Array.isArray(rawMedia.tags) ? rawMedia.tags : [],
    visibility: rawMedia.visibility || 'PUBLIC',
    mediaType: rawMedia.mediaType || 'IMAGE',
    processingStatus: rawMedia.processingStatus || 'COMPLETED',
    duration: rawMedia.duration || null,
    codec: rawMedia.codec || null,
    bitrate: rawMedia.bitrate || null,
    framerate: rawMedia.framerate || null,
    videoUrl: rawMedia.videoUrl || null,
    videoS3Key: rawMedia.videoS3Key || null,
    // Video processing fields
    videoProcessingStatus: rawMedia.videoProcessingStatus || null,
    videoThumbnails: rawMedia.videoThumbnails || null,
    videoVersions: rawMedia.videoVersions || null,
    videoMetadata: rawMedia.videoMetadata || null,
    createdAt: rawMedia.createdAt,
    updatedAt: rawMedia.updatedAt,
    authorId: rawMedia.authorId,
    // Add missing required properties
    order: order,
    author: rawMedia.author || {
      id: rawMedia.authorId || '',
      name: 'Unknown User',
      email: '',
      isPrivate: false,
      isVerified: false,
      createdAt: rawMedia.createdAt || new Date().toISOString(),
      updatedAt: rawMedia.updatedAt || new Date().toISOString()
    }
  }
}

export function mapMediaArray(rawMediaArray: any[]): Media[] {
  return rawMediaArray.map((rawMedia, index) => mapMediaData(rawMedia, index))
}

/**
 * Get the best thumbnail URL for a media item
 * For videos, prioritize processed thumbnails over the original thumbnail
 */
export function getBestThumbnailUrl(media: Media): string | null {
  // Use the main thumbnail endpoint which now handles both image and video thumbnails
  return `${BACKEND_BASE_URL}/api/media/serve/${media.id}/thumbnail`
}

/**
 * Smart image selection based on display context
 * @param media - The media object
 * @param context - The display context ('main', 'small', 'thumbnail', 'detail')
 * @returns The appropriate URL for the given context
 */
export function getSmartMediaUrl(media: any, context: 'main' | 'small' | 'thumbnail' | 'detail' = 'main'): string {
  if (!media || !media.id) {
    // For locked media without ID, return empty string to prevent URL construction
    if (media?.isLocked) {
      return ''
    }
    return media?.url || ''
  }

  const baseUrl = `${BACKEND_BASE_URL}/api/media/serve`
  
  switch (context) {
    case 'main':
      // For main images in posts, use 1080p if available
      return `${baseUrl}/by_quality/${media.id}/1080p`
    
    case 'small':
      // For smaller images in posts, use 540p if available
      return `${baseUrl}/by_quality/${media.id}/540p`
    
    case 'thumbnail':
      // For thumbnails, use the thumbnail endpoint
      return `${baseUrl}/${media.id}/thumbnail`
    
    case 'detail':
      // For image detail modal, use original quality
      return `${baseUrl}/by_quality/${media.id}/original`
    
    default:
      // Default to main quality
      return `${baseUrl}/by_quality/${media.id}/1080p`
  }
}

/**
 * Get the best quality URL for a media item with fallback logic
 * @param media - The media object
 * @param preferredQuality - The preferred quality (e.g., '1080p', '540p', 'thumbnail')
 * @returns The best available URL for the given quality
 */
export function getQualityUrl(media: any, preferredQuality: string): string {
  if (!media || !media.id) {
    // For locked media without ID, return empty string to prevent URL construction
    if (media?.isLocked) {
      return ''
    }
    return media?.url || ''
  }

  const baseUrl = `${BACKEND_BASE_URL}/api/media/serve`
  
  // If it's a thumbnail request, use the thumbnail endpoint
  if (preferredQuality === 'thumbnail') {
    return `${baseUrl}/${media.id}/thumbnail`
  }
  
  // For other qualities, use the quality endpoint
  return `${baseUrl}/by_quality/${media.id}/${preferredQuality}`
} 