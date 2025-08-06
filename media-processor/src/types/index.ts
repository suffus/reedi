export interface ProcessingJob {
  id: string
  mediaId: string
  userId: string
  mediaType: 'IMAGE' | 'VIDEO'
  s3Key: string
  originalFilename: string
  mimeType: string
  fileSize: number
  createdAt: Date
  priority?: number
  retryCount?: number
}

export interface VideoProcessingJob extends ProcessingJob {
  mediaType: 'VIDEO'
  duration?: number
  codec?: string
  bitrate?: number
  framerate?: number
  resolution?: string
}

export interface ImageProcessingJob extends ProcessingJob {
  mediaType: 'IMAGE'
  width?: number
  height?: number
}

export interface ProcessingResult {
  success: boolean
  mediaId: string
  outputs: ProcessingOutput[]
  metadata?: MediaMetadata
  error?: string
  processingTime: number
}

export interface ProcessingOutput {
  type: 'thumbnail' | 'scaled' | 'original' | 'metadata'
  s3Key: string
  url?: string
  width?: number
  height?: number
  fileSize: number
  mimeType: string
  quality?: string
}

export interface MediaMetadata {
  duration?: number
  codec?: string
  bitrate?: number
  framerate?: number
  resolution?: string
  width?: number
  height?: number
  fileSize: number
  mimeType: string
}

export interface VideoQuality {
  name: string
  resolution: string
  bitrate: string
  width: number
  height: number
}

export interface ImageQuality {
  name: string
  width: number
  height: number
  quality: number
}

export interface ProcessingConfig {
  maxConcurrentJobs: number
  videoMaxDuration: number
  videoMaxFileSize: number
  imageMaxFileSize: number
  ffmpegPath: string
  ffprobePath: string
  videoQualities: VideoQuality[]
  imageQualities: ImageQuality[]
  thumbnailTime: string
}

export interface JobQueueConfig {
  redis: {
    host: string
    port: number
    password?: string
    db: number
  }
  maxConcurrentJobs: number
  defaultJobOptions: {
    attempts: number
    backoff: {
      type: 'exponential'
      delay: number
    }
    removeOnComplete: number
    removeOnFail: number
  }
}

export interface S3Config {
  region: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
}

export interface ProcessingStatus {
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  progress?: number
  currentStep?: string
  error?: string
  outputs?: ProcessingOutput[]
  metadata?: MediaMetadata
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy'
  timestamp: Date
  services: {
    redis: boolean
    s3: boolean
    ffmpeg: boolean
    api: boolean
  }
  stats: {
    activeJobs: number
    completedJobs: number
    failedJobs: number
    queueSize: number
  }
} 