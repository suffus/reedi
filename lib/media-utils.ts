import { Media } from './types'

export function mapMediaData(rawMedia: any): Media {
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
    createdAt: rawMedia.createdAt,
    updatedAt: rawMedia.updatedAt,
    authorId: rawMedia.authorId
  }
}

export function mapMediaArray(rawMediaArray: any[]): Media[] {
  return rawMediaArray.map(mapMediaData)
} 