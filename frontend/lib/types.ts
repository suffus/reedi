export interface User {
  id: string
  name: string
  email: string
  username?: string
  avatar?: string
  bio?: string
  location?: string
  website?: string
  isPrivate: boolean
  isVerified: boolean
  createdAt: string
  updatedAt: string
}

export interface Group {
  id: string
  name: string
  username: string
  description?: string
  rules?: string
  coverPhoto?: string
  avatar?: string
  visibility: 'PUBLIC' | 'PRIVATE_VISIBLE' | 'PRIVATE_HIDDEN'
  type: 'GENERAL' | 'SOCIAL_LEARNING' | 'GAMING' | 'JOBS' | 'BUY_SELL' | 'PARENTING' | 'WORK'
  moderationPolicy: 'NO_MODERATION' | 'ADMIN_APPROVAL_REQUIRED' | 'AI_FILTER' | 'SELECTIVE_MODERATION'
  isActive: boolean
  createdAt: string
  updatedAt: string
  members?: GroupMember[]
  _count?: {
    members: number
    posts: number
  }
}

export interface GroupMember {
  id: string
  groupId: string
  userId: string
  role: 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER'
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'PENDING_APPROVAL'
  joinedAt: string
  leftAt?: string
  suspendedAt?: string
  bannedAt?: string
  user: User
}

export interface GroupPost {
  id: string
  groupId: string
  postId: string
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'DELETED'
  isPriority: boolean
  approvedAt?: string
  approvedBy?: string
  rejectedAt?: string
  rejectedBy?: string
  rejectionReason?: string
  createdAt: string
  updatedAt: string
  post: Post
}

export interface GroupInvitation {
  id: string
  groupId: string
  inviterId: string
  inviteeEmail?: string
  inviteeUserId?: string
  inviteCode: string
  expiresAt: string
  acceptedAt?: string
  createdAt: string
  group?: Group
  inviter?: User
  invitee?: User
}

export interface GroupApplication {
  id: string
  groupId: string
  applicantId: string
  message?: string
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED'
  reviewedAt?: string
  reviewedBy?: string
  createdAt: string
  updatedAt: string
  group?: Group
  applicant?: User
  reviewer?: User
}

export interface GroupAction {
  id: string
  groupId: string
  userId: string
  actionType: string
  description: string
  metadata?: Record<string, unknown>
  createdAt: string
  group?: Group
  user?: User
}

export interface GroupActivity {
  type: 'action' | 'post'
  id: string
  timestamp: string
  actionType?: string
  description?: string
  user?: User
  metadata?: Record<string, unknown>
  status?: string
  post?: {
    id: string
    title?: string
    content: string
    authorId: string
    createdAt: string
    author: User
  }
}

// Group-related type definitions
export type GroupVisibility = 'PUBLIC' | 'PRIVATE_VISIBLE' | 'PRIVATE_HIDDEN'
export type GroupType = 'GENERAL' | 'SOCIAL_LEARNING' | 'GAMING' | 'JOBS' | 'BUY_SELL' | 'PARENTING' | 'WORK'
export type GroupModerationPolicy = 'NO_MODERATION' | 'ADMIN_APPROVAL_REQUIRED' | 'AI_FILTER' | 'SELECTIVE_MODERATION'

export interface Post {
  id: string
  title?: string
  content: string
  publicationStatus: 'PUBLIC' | 'PAUSED' | 'CONTROLLED' | 'DELETED'
  visibility: 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE'
  authorId: string
  createdAt: string
  updatedAt: string
  isLocked: boolean
  unlockPrice?: number
  author: User
  media?: Media[] // Flattened array of Media objects directly
  hashtags?: Hashtag[]
  comments?: Comment[]
  reactions?: Reaction[]
  _count?: {
    comments: number
    reactions: number
  }
}

// PostMedia interface removed - API returns flattened Media objects directly in Post.media array

export interface Media {
  id: string
  url: string
  s3Key?: string
  originalFilename?: string
  altText?: string
  caption?: string
  width?: number
  height?: number
  size?: number
  mimeType?: string
  tags: string[]
  visibility: 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE'
  postId?: string
  authorId: string
  galleryId?: string
  order: number
  mediaType: 'IMAGE' | 'VIDEO' | 'ZIP' // Added ZIP support
  processingStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'FAILED'
  duration?: number
  codec?: string
  bitrate?: number
  framerate?: number
  videoUrl?: string
  videoS3Key?: string
  createdAt: string
  updatedAt: string
  metadata?: Record<string, unknown>
  thumbnails?: Array<{ s3Key: string; width: number; height: number; fileSize?: number }> // Updated to match API
  versions?: Array<{ quality: string; s3Key: string; width: number; height: number }> // Updated to match API
  isLocked?: boolean // Added from PostMedia.isLocked
  originalPath?: string // Added for zip files
  zipMediaId?: string // Added for zip files
  author?: User // Made optional since not all responses include it
}

export interface Comment {
  id: string
  content: string
  postId?: string
  authorId: string
  parentId?: string
  createdAt: string
  updatedAt: string
  mediaId?: string
  post?: Post
  media?: Media
  author: User
  parent?: Comment
  replies?: Comment[]
  reactions?: Reaction[]
}

export interface Reaction {
  id: string
  type: 'LIKE' | 'LOVE' | 'HAHA' | 'WOW' | 'SAD' | 'ANGRY'
  postId?: string
  commentId?: string
  authorId: string
  createdAt: string
  post?: Post
  comment?: Comment
  author: User
}

export interface Gallery {
  id: string
  name: string
  description?: string
  visibility: 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE'
  authorId: string
  createdAt: string
  updatedAt: string
  coverMediaId?: string
  author: User
  media: Media[]
  coverMedia?: Media
}

export interface FriendRequest {
  id: string
  senderId: string
  receiverId: string
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED'
  createdAt: string
  updatedAt: string
  sender: User
  receiver: User
}

export interface Notification {
  id: string
  type: 'LIKE' | 'COMMENT' | 'FOLLOW' | 'MENTION' | 'FRIEND_REQUEST' | 'FRIEND_REQUEST_ACCEPTED'
  title: string
  message: string
  isRead: boolean
  userId: string
  postId?: string
  commentId?: string
  createdAt: string
  user: User
  post?: Post
  comment?: Comment
}

export interface Conversation {
  id: string
  type: 'DIRECT' | 'GROUP'
  name?: string
  avatarUrl?: string
  createdById: string
  createdAt: string
  updatedAt: string
  lastMessageAt?: string
  isActive: boolean
  createdBy: User
  participants: ConversationParticipant[]
  messages: Message[]
}

export interface ConversationParticipant {
  id: string
  conversationId: string
  userId: string
  role: 'ADMIN' | 'MEMBER'
  joinedAt: string
  leftAt?: string
  isActive: boolean
  conversation: Conversation
  user: User
}

export interface Message {
  id: string
  conversationId: string
  senderId: string
  content?: string
  messageType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'SYSTEM' | 'POST'
  mediaId?: string
  replyToId?: string
  encryptedContent?: string
  encryptionVersion: number
  createdAt: string
  updatedAt: string
  isDeleted: boolean
  isLocked: boolean
  unlockPrice?: number
  conversation: Conversation
  sender: User
  media?: Media
  mediaItems: MessageMedia[]
  deliveryStatus: MessageDeliveryStatus[]
  reactions: MessageReaction[]
}

export interface MessageMedia {
  id: string
  messageId: string
  mediaId: string
  order: number
  isLocked: boolean
  message: Message
  media: Media
}

export interface MessageDeliveryStatus {
  id: string
  messageId: string
  userId: string
  status: 'SENT' | 'DELIVERED' | 'READ'
  deliveredAt?: string
  readAt?: string
  message: Message
  user: User
}

export interface MessageReaction {
  id: string
  messageId: string
  userId: string
  reaction: string
  createdAt: string
  message: Message
  user: User
}

export interface UnlockedPost {
  id: string
  userId: string
  postId: string
  paidAmount: number
  unlockedAt: string
  user: User
  post: Post
}

export interface UnlockedMessage {
  id: string
  userId: string
  messageId: string
  paidAmount: number
  unlockedAt: string
  user: User
  message: Message
}

export interface UserSession {
  id: string
  userId: string
  sessionId: string
  deviceInfo?: Record<string, unknown>
  lastSeen: string
  isActive: boolean
  createdAt: string
  user: User
}

export interface SearchHistory {
  id: string
  query: string
  userId: string
  createdAt: string
  user: User
}

export interface Mention {
  id: string
  postId: string
  userId: string
  createdAt: string
  post: Post
  user: User
}

export interface Hashtag {
  id: string
  name: string
  createdAt: string
  posts: Post[]
}

export interface MediaProcessingJob {
  id: string
  mediaId: string
  userId: string
  mediaType: 'IMAGE' | 'VIDEO' | 'ZIP' // Added ZIP support
  s3Key: string
  originalFilename: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'FAILED'
  progress: number
  currentStep?: string
  errorMessage?: string
  thumbnails?: Array<{ s3Key: string; width: number; height: number; fileSize?: number }> // Updated to match API
  versions?: Array<{ quality: string; s3Key: string; width: number; height: number }> // Updated to match API
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
  completedAt?: string
  media: Media
  user: User
}

export interface Follows {
  id: string
  followerId: string
  followingId: string
  createdAt: string
  follower: User
  following: User
}
