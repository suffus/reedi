#!/usr/bin/env node

import express from 'express'
import cors from 'cors'
import { StagedVideoProcessingService } from './services/stagedVideoProcessingService'
import { StagedImageProcessingService } from './services/stagedImageProcessingService'
import { EnhancedRabbitMQService } from './services/enhancedRabbitMQService'
import { S3ProcessorService } from './services/s3ProcessorService'
import dotenv from 'dotenv'
import logger from './utils/logger'

dotenv.config()

async function main() {
  // Load configuration from environment variables
  const config = {
    server: {
      port: parseInt(process.env['PORT'] || '8044')
    },
    rabbitmq: {
      url: process.env['RABBITMQ_URL'] || `amqp://${process.env['RABBITMQ_USER'] || 'guest'}:${process.env['RABBITMQ_PASSWORD'] || 'guest'}@localhost:${process.env['RABBITMQ_PORT'] || '5672'}`,
      exchanges: {
        requests: process.env['RABBITMQ_REQUESTS_EXCHANGE'] || 'media.requests',
        processing: process.env['RABBITMQ_PROCESSING_EXCHANGE'] || 'media.processing',
        updates: process.env['RABBITMQ_UPDATES_EXCHANGE'] || 'media.updates'
      },
      video_queues: {
        requests: process.env['RABBITMQ_REQUESTS_QUEUE'] || 'media.video.processing.requests',
        updates: process.env['RABBITMQ_UPDATES_QUEUE'] || 'media.video.processing.updates'
      },
      image_queues: {
        requests: process.env['RABBITMQ_REQUESTS_QUEUE'] || 'media.image.processing.requests',
        updates: process.env['RABBITMQ_UPDATES_QUEUE'] || 'media.image.processing.updates'
      }
    },
                s3: {
              region: process.env['IDRIVE_REGION'] || 'us-east-1',
              endpoint: process.env['IDRIVE_ENDPOINT'] || '',
              accessKeyId: process.env['IDRIVE_ACCESS_KEY_ID'] || '',
              secretAccessKey: process.env['IDRIVE_SECRET_ACCESS_KEY'] || '',
              bucket: process.env['IDRIVE_BUCKET_NAME'] || ''
            },
    processing: {
      tempDir: process.env['TEMP_DIR'] || '/tmp',
      progressInterval: parseInt(process.env['PROGRESS_INTERVAL'] || '5')
    }
  }

            // Validate required configuration
    if (!config.s3.accessKeyId || !config.s3.secretAccessKey || !config.s3.bucket) {
        console.log(config.s3);
            logger.error('Missing required IDRIVE configuration. Please set IDRIVE_ACCESS_KEY_ID, IDRIVE_SECRET_ACCESS_KEY, and IDRIVE_BUCKET_NAME environment variables.')
            process.exit(1)
          }

  let videoProcessingService: StagedVideoProcessingService | null = null
  let imageProcessingService: StagedImageProcessingService | null = null

  try {
    logger.info('Starting media processing services...')

    // Initialize shared services
    const s3Service = new S3ProcessorService(
      config.s3.region,
      config.s3.accessKeyId,
      config.s3.secretAccessKey,
      config.s3.bucket,
      config.processing.tempDir,
      config.s3.endpoint
    )

    // Initialize video processing service
    logger.info('Starting staged video processing service...')
    const videoRabbitmqService = new EnhancedRabbitMQService(
      config.rabbitmq.url,
      {
        requests: 'media.requests',
        processing: 'media.processing',
        updates: 'media.updates'
      },
      'video',
      {
        download: 'video.processing.download',
        processing: 'video.processing.processing',
        upload: 'video.processing.upload',
        updates: 'video.processing.updates'
      }
    )

    videoProcessingService = new StagedVideoProcessingService(
      videoRabbitmqService,
      s3Service,
      config.processing.tempDir
    )

    // Start the video processing service
    await videoProcessingService.start()
    logger.info('✅ Video processing service started successfully')

    // Initialize image processing service
    logger.info('Starting staged image processing service...')
    const imageRabbitmqService = new EnhancedRabbitMQService(
      config.rabbitmq.url,
      {
        requests: 'media.requests',
        processing: 'media.processing',
        updates: 'media.updates'
      },
      'images',
      {
        download: 'media.images.processing.download',
        processing: 'media.images.processing.processing',
        upload: 'media.images.processing.upload',
        updates: 'media.images.processing.updates'
      }
    )

    imageProcessingService = new StagedImageProcessingService(
      imageRabbitmqService,
      s3Service,
      config.processing.tempDir
    )

    // Start the image processing service
    await imageProcessingService.start()
    logger.info('✅ Image processing service started successfully')

    // Create Express server for health checks and monitoring
    const app = express()
    
    app.use(cors())
    app.use(express.json())

    // Health check endpoint
    app.get('/health', (_req, res) => {
      res.json({
        status: 'OK',
        service: 'video-processing',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        rabbitmq: videoRabbitmqService.isConnected() && imageRabbitmqService.isConnected()
      })
    })

    // Service info endpoint
    app.get('/info', (_req, res) => {
      res.json({
        service: 'Media Processing Service',
        version: '2.0.0',
        port: config.server.port,
        services: {
          video: {
            status: videoProcessingService ? 'running' : 'stopped',
            exchanges: config.rabbitmq.exchanges,
            queues: {
              download: 'video.processing.download',
              processing: 'video.processing.processing',
              upload: 'video.processing.upload',
              updates: 'video.processing.updates'
            }
          },
          image: {
            status: imageProcessingService ? 'running' : 'stopped',
            exchanges: {
              processing: 'reedi.images.processing',
              updates: 'reedi.images.updates'
            },
            queues: {
              download: 'reedi.images.processing.download',
              processing: 'reedi.images.processing.processing',
              upload: 'reedi.images.processing.upload',
              updates: 'reedi.images.processing.updates'
            }
          }
        },
        rabbitmq: {
          url: config.rabbitmq.url.replace(/\/\/.*@/, '//***:***@')
        },
        s3: {
          region: config.s3.region,
          bucket: config.s3.bucket
        },
        processing: {
          tempDir: config.processing.tempDir,
          progressInterval: config.processing.progressInterval
        }
      })
    })

    // Start HTTP server
    app.listen(config.server.port, () => {
      logger.info(`Video processing service HTTP server started on port ${config.server.port}`)
    })

    logger.info('All media processing services started successfully')

    // Set up periodic cleanup every 6 hours
    const cleanupInterval = setInterval(async () => {
      try {
        logger.info('Running periodic cleanup of old temporary files...')
        await videoProcessingService?.cleanupOldTempFiles(6) // Clean up files older than 6 hours
        await imageProcessingService?.cleanupOldTempFiles(6)
      } catch (error) {
        logger.error('Error during periodic cleanup:', error)
      }
    }, 6 * 60 * 60 * 1000) // 6 hours

    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`)
      
      clearInterval(cleanupInterval)

      // Run final cleanup before shutdown
      try {
        logger.info('Running final cleanup before shutdown...')
        await videoProcessingService?.cleanupOldTempFiles(0) // Clean up all files
        await imageProcessingService?.cleanupOldTempFiles(0)
      } catch (error) {
        logger.error('Error during final cleanup:', error)
      }
      
      if (videoProcessingService) {
        await videoProcessingService.stop()
        logger.info('Video processing service stopped')
      }
      
      if (imageProcessingService) {
        await imageProcessingService.stop()
        logger.info('Image processing service stopped')
      }
      
      logger.info('All media processing services stopped')
      process.exit(0)
    }

    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))

  } catch (error) {
    logger.error('Failed to start media processing services:', error)
    
    if (videoProcessingService) {
      await videoProcessingService.stop()
    }
    
    if (imageProcessingService) {
      await imageProcessingService.stop()
    }
    
    process.exit(1)
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

main().catch((error) => {
  logger.error('Failed to start application:', error)
  process.exit(1)
}) 