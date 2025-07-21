export interface GalleryImage {
  id: string
  url: string
  thumbnail: string
  s3Key?: string
  thumbnailS3Key?: string
  title: string | null
  description: string | null
  createdAt: string
  authorId: string
  tags: string[]
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