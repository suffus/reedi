import { GalleryImage } from './types'

// Map backend image data to frontend GalleryImage format
export const mapImageData = (image: any): GalleryImage => ({
  id: image.id,
  url: image.s3Key || image.url, // Use S3 key if available, fallback to old URL
  thumbnail: image.thumbnailS3Key || image.thumbnail || image.url, // Use S3 key if available, fallback to old thumbnail
  s3Key: image.s3Key || image.url,
  thumbnailS3Key: image.thumbnailS3Key || image.thumbnail || image.url,
  title: image.altText || image.title,
  description: image.caption || image.description,
  createdAt: image.createdAt,
  authorId: image.authorId,
  tags: image.tags || [],
  metadata: {
    width: image.width || 0,
    height: image.height || 0,
    size: image.size || 0,
    format: image.mimeType || 'unknown'
  }
}) 