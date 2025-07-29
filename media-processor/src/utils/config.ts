import dotenv from 'dotenv'
import Joi from 'joi'
import { ProcessingConfig, JobQueueConfig, S3Config, ApiConfig } from '../types'

// Load environment variables
dotenv.config()

// Validation schema for environment variables
const envSchema = Joi.object({
  // Redis Configuration
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().optional(),
  REDIS_DB: Joi.number().default(0),

  // AWS S3 Configuration
  AWS_REGION: Joi.string().required(),
  AWS_ACCESS_KEY_ID: Joi.string().required(),
  AWS_SECRET_ACCESS_KEY: Joi.string().required(),
  S3_BUCKET: Joi.string().required(),

  // API Backend Configuration
  API_BASE_URL: Joi.string().uri().required(),
  API_WEBHOOK_SECRET: Joi.string().required(),

  // Processing Configuration
  MAX_CONCURRENT_JOBS: Joi.number().default(3),
  VIDEO_MAX_DURATION: Joi.number().default(300),
  VIDEO_MAX_FILE_SIZE: Joi.number().default(500000000),
  IMAGE_MAX_FILE_SIZE: Joi.number().default(50000000),

  // FFmpeg Configuration
  FFMPEG_PATH: Joi.string().default('/usr/bin/ffmpeg'),
  FFPROBE_PATH: Joi.string().default('/usr/bin/ffprobe'),

  // Video Processing Settings
  VIDEO_QUALITIES: Joi.string().default('1080p,720p,480p'),
  VIDEO_BITRATES: Joi.string().default('5000k,2500k,1000k'),
  THUMBNAIL_TIME: Joi.string().default('00:00:05'),

  // Image Processing Settings
  IMAGE_QUALITIES: Joi.string().default('original,large,medium,small'),
  IMAGE_SIZES: Joi.string().default('1920x1080,1280x720,800x600,400x300'),

  // Logging
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  LOG_FILE: Joi.string().default('logs/media-processor.log'),

  // Health Check
  HEALTH_CHECK_PORT: Joi.number().default(3002)
})

// Validate environment variables
const { error, value: envVars } = envSchema.validate(process.env, {
  allowUnknown: true,
  stripUnknown: true
})

if (error) {
  throw new Error(`Environment validation error: ${error.message}`)
}

// Parse video qualities
const parseVideoQualities = (): Array<{ name: string; resolution: string; bitrate: string; width: number; height: number }> => {
  const qualities = envVars.VIDEO_QUALITIES.split(',')
  const bitrates = envVars.VIDEO_BITRATES.split(',')
  
  return qualities.map((quality: string, index: number) => {
    const [width, height] = quality.replace('p', '').split('x')
    const h = parseInt(height || quality.replace('p', ''))
    const w = parseInt(width || Math.round(h * 16 / 9).toString())
    
    return {
      name: quality,
      resolution: quality,
      bitrate: bitrates[index] || '1000k',
      width: w,
      height: h
    }
  })
}

// Parse image qualities
const parseImageQualities = (): Array<{ name: string; width: number; height: number; quality: number }> => {
  const qualities = envVars.IMAGE_QUALITIES.split(',')
  const sizes = envVars.IMAGE_SIZES.split(',')
  
  return qualities.map((quality: string, index: number) => {
    const size = sizes[index] || '800x600'
    const [width, height] = size.split('x').map(Number)
    
    return {
      name: quality,
      width: width || 800,
      height: height || 600,
      quality: quality === 'original' ? 100 : quality === 'large' ? 90 : quality === 'medium' ? 80 : 70
    }
  })
}

// Export configuration objects
export const config = {
  processing: {
    maxConcurrentJobs: envVars.MAX_CONCURRENT_JOBS,
    videoMaxDuration: envVars.VIDEO_MAX_DURATION,
    videoMaxFileSize: envVars.VIDEO_MAX_FILE_SIZE,
    imageMaxFileSize: envVars.IMAGE_MAX_FILE_SIZE,
    ffmpegPath: envVars.FFMPEG_PATH,
    ffprobePath: envVars.FFPROBE_PATH,
    videoQualities: parseVideoQualities(),
    imageQualities: parseImageQualities(),
    thumbnailTime: envVars.THUMBNAIL_TIME
  } as ProcessingConfig,

  queue: {
    redis: {
      host: envVars.REDIS_HOST,
      port: envVars.REDIS_PORT,
      password: envVars.REDIS_PASSWORD,
      db: envVars.REDIS_DB
    },
    maxConcurrentJobs: envVars.MAX_CONCURRENT_JOBS,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential' as const,
        delay: 2000
      },
      removeOnComplete: 100,
      removeOnFail: 50
    }
  } as JobQueueConfig,

  s3: {
    region: envVars.AWS_REGION,
    accessKeyId: envVars.AWS_ACCESS_KEY_ID,
    secretAccessKey: envVars.AWS_SECRET_ACCESS_KEY,
    bucket: envVars.S3_BUCKET
  } as S3Config,

  api: {
    baseUrl: envVars.API_BASE_URL,
    webhookSecret: envVars.API_WEBHOOK_SECRET
  } as ApiConfig,

  logging: {
    level: envVars.LOG_LEVEL,
    file: envVars.LOG_FILE
  },

  healthCheck: {
    port: envVars.HEALTH_CHECK_PORT
  }
}

export default config 