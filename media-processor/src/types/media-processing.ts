/**
 * Unified message types for media processing
 */

export type MediaType = 'image' | 'video' | 'zip'

export type MessageType = 'request' | 'progress' | 'result' | 'error'

export type ProcessingStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

/**
 * Base message structure for all media processing
 */
export interface BaseMediaMessage {
  messageType: MessageType
  mediaType: MediaType
  mediaId: string
  userId: string
  timestamp: string
}

/**
 * Processing request message
 */
export interface MediaProcessingRequest extends BaseMediaMessage {
  messageType: 'request'
  s3Key: string
  originalFilename: string
  mimeType: string
  fileSize: number
  metadata?: Record<string, any>
}

/**
 * Progress update message
 */
export interface MediaProgressUpdate extends BaseMediaMessage {
  messageType: 'progress'
  status: ProcessingStatus
  progress: number // 0-100
  message?: string
  stage?: string
  details?: Record<string, any>
}

/**
 * Processing result message
 */
export interface MediaProcessingResult extends BaseMediaMessage {
  messageType: 'result'
  status: 'COMPLETED' | 'FAILED'
  result?: {
    s3Key?: string
    thumbnailS3Key?: string
    width?: number
    height?: number
    duration?: number
    metadata?: Record<string, any>
    // For zip files, this contains extracted media info
    extractedMedia?: Array<{
      s3Key: string
      thumbnailS3Key?: string
      originalFilename: string
      mimeType: string
      width?: number
      height?: number
      duration?: number
      metadata?: Record<string, any>
    }>
  }
  error?: string
  details?: Record<string, any>
}

/**
 * Processing error message
 */
export interface MediaProcessingError extends BaseMediaMessage {
  messageType: 'error'
  error: string
  details?: Record<string, any>
  retryable?: boolean
}

/**
 * Union type for all media processing messages
 */
export type MediaProcessingMessage = 
  | MediaProcessingRequest 
  | MediaProgressUpdate 
  | MediaProcessingResult 
  | MediaProcessingError

/**
 * Type guards for message type checking
 */
export function isMediaProcessingRequest(msg: MediaProcessingMessage): msg is MediaProcessingRequest {
  return msg.messageType === 'request' && 's3Key' in msg
}

export function isMediaProgressUpdate(msg: MediaProcessingMessage): msg is MediaProgressUpdate {
  return msg.messageType === 'progress' && 'progress' in msg
}

export function isMediaProcessingResult(msg: MediaProcessingMessage): msg is MediaProcessingResult {
  return msg.messageType === 'result'
}

export function isMediaProcessingError(msg: MediaProcessingMessage): msg is MediaProcessingError {
  return msg.messageType === 'error'
}
