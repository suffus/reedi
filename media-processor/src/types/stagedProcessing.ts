export interface StagedProcessingJob {
  id: string
  mediaId: string
  userId: string
  mediaType: 'VIDEO' | 'IMAGE'
  s3Key: string
  originalFilename: string
  mimeType: string
  fileSize: number
  createdAt: Date
  stage: ProcessingStage
  previousStage?: ProcessingStage
  localMediaPath?: string
  metadata?: VideoMetadata | ImageMetadata
  outputs?: ProcessingOutput[]
}

export type ProcessingStage = 
  | 'DOWNLOADING'
  | 'DOWNLOADED'
  | 'PROCESSING'
  | 'PROCESSED'
  | 'UPLOADING'
  | 'COMPLETED'
  | 'FAILED'

export interface VideoMetadata {
  duration: number
  codec: string
  bitrate: number
  framerate: number
  resolution: string
  width: number
  height: number
  fileSize: number
  mimeType: string
}

export interface ImageMetadata {
  width: number
  height: number
  fileSize: number
  mimeType: string
  format: string
  colorSpace?: string
  hasAlpha?: boolean
}

export interface ProcessingOutput {
  type: 'thumbnail' | 'scaled' | 'image_scaled'
  s3Key: string
  width: number
  height: number
  fileSize: number
  mimeType: string
  quality?: string
  localPath?: string
}

export interface StageResult {
  success: boolean
  stage: ProcessingStage
  mediaId: string
  jobId: string
  localMediaPath?: string
  metadata?: VideoMetadata | ImageMetadata
  outputs?: ProcessingOutput[]
  error?: string
}

export interface QueueConfig {
  download: string
  processing: string
  upload: string
  updates: string
}

export interface StageConfig {
  name: string
  queue: string
  timeout: number
  retries: number
} 