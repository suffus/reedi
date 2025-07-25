import { Request } from 'express'
import { User, Post, Comment, Media, Gallery, Reaction, Notification } from '@prisma/client'

// Extended Request interface with user
export interface AuthenticatedRequest extends Request {
  user?: User
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Auth types
export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  name: string
  email: string
  username?: string
  password: string
}

export interface AuthResponse {
  user: Omit<User, 'password'>
  token: string
}

// Post types
export interface CreatePostRequest {
  title?: string
  content: string
  isPrivate?: boolean
  hashtags?: string[]
  mentions?: string[]
}

export interface UpdatePostRequest {
  title?: string
  content?: string
  isPrivate?: boolean
  hashtags?: string[]
  mentions?: string[]
}

// Comment types
export interface CreateCommentRequest {
  content: string
  postId: string
  parentId?: string
}

export interface UpdateCommentRequest {
  content: string
}

// Media types
export interface CreateMediaRequest {
  url: string
  altText?: string
  caption?: string
  postId?: string
  galleryId?: string
  mediaType?: 'IMAGE' | 'VIDEO'
}

// Video processing types
export interface VideoProcessingRequest {
  mediaId: string
  s3Key: string
  userId: string
  originalFilename: string
  mimeType: string
}

export interface VideoProcessingResult {
  duration: number
  codec: string
  bitrate: number
  framerate: number
  videoUrl: string
  videoS3Key: string
  thumbnailUrl: string
  thumbnailS3Key: string
}

// Gallery types
export interface CreateGalleryRequest {
  name: string
  description?: string
  isPrivate?: boolean
}

// Search types
export interface SearchRequest {
  query: string
  type?: 'posts' | 'users' | 'hashtags' | 'all'
  limit?: number
  offset?: number
}

// Pagination types
export interface PaginationParams {
  page?: number
  limit?: number
  offset?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// Extended Prisma types with relations
export type PostWithAuthor = Post & {
  author: User
  _count: {
    comments: number
    reactions: number
  }
}

export type PostWithDetails = Post & {
  author: User
  comments: Comment[]
  reactions: Reaction[]
  media: Media[]
  hashtags: { name: string }[]
  _count: {
    comments: number
    reactions: number
  }
}

export type CommentWithAuthor = Comment & {
  author: User
  _count: {
    replies: number
    reactions: number
  }
}

export type UserWithStats = User & {
  _count: {
    posts: number
    followers: number
    following: number
  }
} 