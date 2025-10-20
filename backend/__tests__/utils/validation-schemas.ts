/**
 * Common Zod validation schemas for API response testing
 * 
 * These schemas ensure that API responses include all required fields
 * and maintain type safety across the application.
 */

import { z } from 'zod'

// Base enums
export const MediaTypeSchema = z.enum(['IMAGE', 'VIDEO', 'ZIP'])
export const VisibilitySchema = z.enum(['PUBLIC', 'FRIENDS_ONLY', 'PRIVATE'])
export const ProcessingStatusSchema = z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED', 'FAILED'])
export const PublicationStatusSchema = z.enum(['PUBLIC', 'PAUSED', 'CONTROLLED', 'DELETED'])
export const MessageTypeSchema = z.enum(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'SYSTEM', 'POST'])
export const ConversationTypeSchema = z.enum(['DIRECT', 'GROUP'])
export const ParticipantRoleSchema = z.enum(['ADMIN', 'MEMBER'])

// User schema
export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string().nullable(),
  avatar: z.string().nullable()
})

// Media schema - the core schema we're validating
export const MediaSchema = z.object({
  id: z.string(),
  url: z.string(),
  s3Key: z.string().nullable(),
  originalFilename: z.string().nullable(),
  altText: z.string().nullable(),
  caption: z.string().nullable(),
  tags: z.array(z.string()),
  visibility: VisibilitySchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  size: z.number().nullable(),
  mimeType: z.string().nullable(),
  authorId: z.string(),
  mediaType: MediaTypeSchema, // Critical field for video detection
  processingStatus: ProcessingStatusSchema,
  duration: z.number().nullable(),
  codec: z.string().nullable(),
  bitrate: z.number().nullable(),
  framerate: z.number().nullable(),
  videoUrl: z.string().nullable(),
  videoS3Key: z.string().nullable(),
  thumbnails: z.any().nullable(),
  versions: z.any().nullable(),
  postId: z.string().nullable(),
  galleryId: z.string().nullable(),
  order: z.number(),
  originalPath: z.string().nullable(),
  zipMediaId: z.string().nullable(),
  metadata: z.any().nullable()
})

// Post media schema (for posts with media)
export const PostMediaSchema = z.object({
  media: MediaSchema.optional() // Make media optional since some posts might not have media
})

// Hashtag schema
export const HashtagSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string()
})

// Post schema - more flexible
export const PostSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  content: z.string(),
  publicationStatus: PublicationStatusSchema,
  visibility: VisibilitySchema,
  authorId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  isLocked: z.boolean(),
  unlockPrice: z.number().nullable(),
  author: UserSchema,
  media: z.array(PostMediaSchema).optional(), // Make media optional
  hashtags: z.array(HashtagSchema).optional(), // Make hashtags optional
  _count: z.object({
    comments: z.number(),
    reactions: z.number()
  }).optional() // Make _count optional
})

// Message media schema (for messages with media)
export const MessageMediaSchema = z.object({
  id: z.string(),
  url: z.string(),
  mimeType: z.string().nullable(),
  originalFilename: z.string().nullable(),
  mediaType: MediaTypeSchema // Critical field for message media
})

// Message schema
export const MessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  senderId: z.string(),
  content: z.string().nullable(),
  messageType: MessageTypeSchema,
  mediaId: z.string().nullable(),
  replyToId: z.string().nullable(),
  encryptedContent: z.string().nullable(),
  encryptionVersion: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  isDeleted: z.boolean(),
  isLocked: z.boolean(),
  unlockPrice: z.number().nullable(),
  sender: UserSchema,
  media: MessageMediaSchema.nullable(),
  mediaItems: z.array(z.object({
    media: MessageMediaSchema
  }))
})

// Conversation participant schema
export const ConversationParticipantSchema = z.object({
  id: z.string(),
  userId: z.string(),
  role: ParticipantRoleSchema,
  joinedAt: z.string(),
  leftAt: z.string().nullable(),
  isActive: z.boolean(),
  user: UserSchema
})

// Conversation schema
export const ConversationSchema = z.object({
  id: z.string(),
  type: ConversationTypeSchema,
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  createdById: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastMessageAt: z.string().nullable(),
  isActive: z.boolean(),
  participants: z.array(ConversationParticipantSchema),
  lastMessage: z.object({
    id: z.string(),
    content: z.string().nullable(),
    messageType: MessageTypeSchema,
    createdAt: z.string(),
    sender: UserSchema,
    media: MessageMediaSchema.nullable()
  }).nullable()
})

// Pagination schema
export const PaginationSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
  hasNext: z.boolean(),
  hasPrev: z.boolean()
})

// API Response schemas
export const PostsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    posts: z.array(PostSchema),
    pagination: PaginationSchema
  })
})

export const SinglePostResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    post: PostSchema
  })
})

export const MediaResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    media: z.array(MediaSchema),
    pagination: PaginationSchema
  })
})

export const MessagesResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    messages: z.array(MessageSchema)
  })
})

export const ConversationsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    conversations: z.array(ConversationSchema)
  })
})

// Utility functions for validation
export const validateMediaType = (mediaType: any): boolean => {
  try {
    MediaTypeSchema.parse(mediaType)
    return true
  } catch {
    return false
  }
}

export const validateAllMediaHaveType = (mediaArray: any[]): boolean => {
  return mediaArray.every(media => 
    media.mediaType && validateMediaType(media.mediaType)
  )
}

export const validatePostMediaHaveType = (posts: any[]): boolean => {
  return posts.every(post => {
    if (!post.media || !Array.isArray(post.media)) {
      return true // No media is fine
    }
    return post.media.every((mediaItem: any) => {
      if (!mediaItem.media) {
        return true // No media object is fine
      }
      return mediaItem.media.mediaType && validateMediaType(mediaItem.media.mediaType)
    })
  })
}

export const validateMessageMediaHaveType = (messages: any[]): boolean => {
  return messages.every(message => {
    // Check main media
    if (message.media && !validateMediaType(message.media.mediaType)) {
      return false
    }
    
    // Check media items
    return message.mediaItems.every((mediaItem: any) => 
      validateMediaType(mediaItem.media.mediaType)
    )
  })
}

// Test helper functions
export const expectValidMediaType = (mediaType: any) => {
  expect(validateMediaType(mediaType)).toBe(true)
  expect(['IMAGE', 'VIDEO', 'ZIP']).toContain(mediaType)
}

export const expectAllMediaHaveType = (mediaArray: any[]) => {
  expect(validateAllMediaHaveType(mediaArray)).toBe(true)
  mediaArray.forEach(media => {
    expect(media.mediaType).toBeDefined()
    expectValidMediaType(media.mediaType)
  })
}

export const expectPostMediaHaveType = (posts: any[]) => {
  expect(validatePostMediaHaveType(posts)).toBe(true)
  posts.forEach(post => {
    if (post.media && Array.isArray(post.media)) {
      post.media.forEach((mediaItem: any) => {
        if (mediaItem.media) {
          expect(mediaItem.media.mediaType).toBeDefined()
          expectValidMediaType(mediaItem.media.mediaType)
        }
      })
    }
  })
}

export const expectMessageMediaHaveType = (messages: any[]) => {
  expect(validateMessageMediaHaveType(messages)).toBe(true)
  messages.forEach(message => {
    if (message.media) {
      expectValidMediaType(message.media.mediaType)
    }
    message.mediaItems.forEach((mediaItem: any) => {
      expectValidMediaType(mediaItem.media.mediaType)
    })
  })
}
