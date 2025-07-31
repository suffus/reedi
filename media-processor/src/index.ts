#!/usr/bin/env node

import express from 'express'
import cors from 'cors'
import { StagedVideoProcessingService } from './services/stagedVideoProcessingService'
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
        processing: process.env['RABBITMQ_PROCESSING_EXCHANGE'] || 'video.processing',
        updates: process.env['RABBITMQ_UPDATES_EXCHANGE'] || 'video.updates'
      },
      queues: {
        requests: process.env['RABBITMQ_REQUESTS_QUEUE'] || 'video.processing.requests',
        updates: process.env['RABBITMQ_UPDATES_QUEUE'] || 'video.processing.updates'
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

  try {
    logger.info('Starting staged video processing service...')

    // Initialize services
    const rabbitmqService = new EnhancedRabbitMQService(
      config.rabbitmq.url,
      config.rabbitmq.exchanges,
      {
        download: 'video.processing.download',
        processing: 'video.processing.processing',
        upload: 'video.processing.upload',
        updates: 'video.processing.updates'
      }
    )

    const s3Service = new S3ProcessorService(
      config.s3.region,
      config.s3.accessKeyId,
      config.s3.secretAccessKey,
      config.s3.bucket,
      config.processing.tempDir,
      config.s3.endpoint
    )

    videoProcessingService = new StagedVideoProcessingService(
      rabbitmqService,
      s3Service,
      config.processing.tempDir
    )

    // Start the video processing service
    await videoProcessingService.start()

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
        rabbitmq: rabbitmqService.isConnected()
      })
    })

    // Service info endpoint
    app.get('/info', (_req, res) => {
      res.json({
        service: 'Video Processing Service',
        version: '1.0.0',
        port: config.server.port,
        rabbitmq: {
          url: config.rabbitmq.url.replace(/\/\/.*@/, '//***:***@'),
          exchanges: config.rabbitmq.exchanges,
          queues: config.rabbitmq.queues
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

    logger.info('Video processing service started successfully')

    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`)
      
      if (videoProcessingService) {
        await videoProcessingService.stop()
      }
      
      logger.info('Video processing service stopped')
      process.exit(0)
    }

    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))

  } catch (error) {
    logger.error('Failed to start video processing service:', error)
    
    if (videoProcessingService) {
      await videoProcessingService.stop()
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