export interface Media {
  id: string
  url: string
  thumbnail: string | null
  s3Key?: string
  thumbnailS3Key?: string
  originalFilename?: string
  altText: string | null
  caption: string | null
  width: number | null
  height: number | null
  size: number | null
  mimeType: string | null
  tags: string[]
  visibility: 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE'
  mediaType: 'IMAGE' | 'VIDEO'
  processingStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'FAILED'
  duration?: number | null
  codec?: string | null
  bitrate?: number | null
  framerate?: number | null
  videoUrl?: string | null
  videoS3Key?: string | null
  // Video processing fields
  videoProcessingStatus?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'FAILED'
  videoThumbnails?: any[] | null
  videoVersions?: any[] | null
  videoMetadata?: any | null
  createdAt: string
  updatedAt: string
  authorId: string
}

export interface GalleryMedia extends Media {
  title: string | null
  description: string | null
  metadata: {
    width: number
    height: number
    size: number
    format: string
  }
}

export interface Comment {
  id: string
  content: string
  authorId: string
  createdAt: string
  author: {
    id: string
    name: string
    username: string | null
    avatar: string | null
  }
} 