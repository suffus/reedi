import Queue from 'bull'
import { config } from '../utils/config'
import { createLogger } from '../utils/logger'
import { ProcessingJob } from '../types'

const logger = createLogger('jobQueue')

// Create Redis connection
const redisConfig = {
  host: config.queue.redis.host,
  port: config.queue.redis.port,
  password: config.queue.redis.password,
  db: config.queue.redis.db
}

// Create queues
export const videoProcessingQueue = new Queue<ProcessingJob>('video-processing', {
  redis: redisConfig,
  defaultJobOptions: config.queue.defaultJobOptions
})

export const imageProcessingQueue = new Queue<ProcessingJob>('image-processing', {
  redis: redisConfig,
  defaultJobOptions: config.queue.defaultJobOptions
})

// Queue event handlers
videoProcessingQueue.on('error', (error) => {
  logger.error('Video processing queue error:', error)
})

videoProcessingQueue.on('failed', (job, error) => {
  logger.error(`Video processing job ${job.id} failed:`, error)
})

videoProcessingQueue.on('completed', (job, result) => {
  logger.info(`Video processing job ${job.id} completed successfully`)
})

imageProcessingQueue.on('error', (error) => {
  logger.error('Image processing queue error:', error)
})

imageProcessingQueue.on('failed', (job, error) => {
  logger.error(`Image processing job ${job.id} failed:`, error)
})

imageProcessingQueue.on('completed', (job, result) => {
  logger.info(`Image processing job ${job.id} completed successfully`)
})

// Queue management functions
export const addVideoProcessingJob = async (jobData: ProcessingJob): Promise<Queue.Job<ProcessingJob>> => {
  logger.info(`Adding video processing job for media ${jobData.mediaId}`)
  return await videoProcessingQueue.add(jobData, {
    priority: jobData.priority || 0,
    attempts: config.queue.defaultJobOptions.attempts,
    backoff: config.queue.defaultJobOptions.backoff
  })
}

export const addImageProcessingJob = async (jobData: ProcessingJob): Promise<Queue.Job<ProcessingJob>> => {
  logger.info(`Adding image processing job for media ${jobData.mediaId}`)
  return await imageProcessingQueue.add(jobData, {
    priority: jobData.priority || 0,
    attempts: config.queue.defaultJobOptions.attempts,
    backoff: config.queue.defaultJobOptions.backoff
  })
}

export const getQueueStats = async () => {
  const [videoStats, imageStats] = await Promise.all([
    videoProcessingQueue.getJobCounts(),
    imageProcessingQueue.getJobCounts()
  ])

  return {
    video: videoStats,
    image: imageStats,
    total: {
      waiting: (videoStats.waiting || 0) + (imageStats.waiting || 0),
      active: (videoStats.active || 0) + (imageStats.active || 0),
      completed: (videoStats.completed || 0) + (imageStats.completed || 0),
      failed: (videoStats.failed || 0) + (imageStats.failed || 0)
    }
  }
}

export const pauseQueues = async () => {
  await Promise.all([
    videoProcessingQueue.pause(),
    imageProcessingQueue.pause()
  ])
  logger.info('All processing queues paused')
}

export const resumeQueues = async () => {
  await Promise.all([
    videoProcessingQueue.resume(),
    imageProcessingQueue.resume()
  ])
  logger.info('All processing queues resumed')
}

export const cleanQueues = async () => {
  await Promise.all([
    videoProcessingQueue.clean(24 * 60 * 60 * 1000, 'completed'), // 24 hours
    videoProcessingQueue.clean(24 * 60 * 60 * 1000, 'failed'),
    imageProcessingQueue.clean(24 * 60 * 60 * 1000, 'completed'),
    imageProcessingQueue.clean(24 * 60 * 60 * 1000, 'failed')
  ])
  logger.info('Cleaned old jobs from queues')
}

export const closeQueues = async () => {
  await Promise.all([
    videoProcessingQueue.close(),
    imageProcessingQueue.close()
  ])
  logger.info('All processing queues closed')
} 