export interface StagedProcessingJob {
  id: string
  mediaId: string
  userId: string
  mediaType: 'VIDEO'
  s3Key: string
  originalFilename: string
  mimeType: string
  fileSize: number
  createdAt: Date
  stage: ProcessingStage
  previousStage?: ProcessingStage
  localVideoPath?: string
  metadata?: VideoMetadata
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

export interface ProcessingOutput {
  type: 'thumbnail' | 'scaled'
  s3Key: string
  width: number
  height: number
  fileSize: number
  mimeType: string
  quality?: string
}

export interface StageResult {
  success: boolean
  stage: ProcessingStage
  mediaId: string
  jobId: string
  localVideoPath?: string
  metadata?: VideoMetadata
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