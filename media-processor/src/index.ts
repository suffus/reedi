#!/usr/bin/env node

import express from 'express'
import cors from 'cors'
// Removed old staged processing services - now using unified processor
import { S3ProcessorService } from './services/s3ProcessorService'
import { ZipExtractionService } from './services/zipExtractionService'
import { FileValidationService } from './services/fileValidationService'
import { UnifiedMediaProcessor } from './consumers/unifiedMediaProcessor'
import { initRabbitMQ } from './utils/rabbitmq'
import dotenv from 'dotenv'
import logger from './utils/logger'
import { createNamespacedExchanges, createNamespacedMediaQueues } from './utils/rabbitmqNamespace'

dotenv.config()

async function main() {
  // Load configuration from environment variables
  const config = {
    server: {
      port: parseInt(process.env['PORT'] || '8044')
    },
    rabbitmq: {
      url: process.env['RABBITMQ_URL'] || `amqp://${process.env['RABBITMQ_USER'] || 'guest'}:${process.env['RABBITMQ_PASSWORD'] || 'guest'}@localhost:${process.env['RABBITMQ_PORT'] || '5672'}`,
      exchanges: createNamespacedExchanges(),
      media_queues: createNamespacedMediaQueues()
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
      progressInterval: parseInt(process.env['PROGRESS_INTERVAL'] || '5'),
      maxConcurrentVideoJobs: parseInt(process.env['MAX_CONCURRENT_VIDEO_JOBS'] || '3'),
      maxConcurrentImageJobs: parseInt(process.env['MAX_CONCURRENT_IMAGE_JOBS'] || '10'),
      maxFileSize: parseInt(process.env['MAX_FILE_SIZE'] || '1073741824') // 1GB default
    }
  }

            // Validate required configuration
    if (!config.s3.accessKeyId || !config.s3.secretAccessKey || !config.s3.bucket) {
        console.log(config.s3);
            logger.error('Missing required IDRIVE configuration. Please set IDRIVE_ACCESS_KEY_ID, IDRIVE_SECRET_ACCESS_KEY, and IDRIVE_BUCKET_NAME environment variables.')
            process.exit(1)
          }

  let unifiedMediaProcessor: UnifiedMediaProcessor | null = null

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

    // Initialize unified media processor
    logger.info('Starting unified media processor...')
    
    // Initialize RabbitMQ
    await initRabbitMQ()
    
    // Initialize supporting services
    const zipExtractionService = new ZipExtractionService(config.processing.tempDir)
    const fileValidationService = new FileValidationService(
      config.processing.maxFileSize || 1024 * 1024 * 1024 // 1GB default
    )

    // Initialize unified media processor
    unifiedMediaProcessor = new UnifiedMediaProcessor(
      s3Service,
      zipExtractionService,
      fileValidationService,
      config.processing.tempDir
    )

    // Start the unified media processor
    await unifiedMediaProcessor.start()
    logger.info('✅ Unified media processor started successfully')

    // Create Express server for health checks and monitoring
    const app = express()
    
    app.use(cors())
    app.use(express.json())

    // Health check endpoint
    app.get('/health', (_req, res) => {
      res.json({
        status: 'OK',
        service: 'unified-media-processing',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        rabbitmq: true, // RabbitMQ connection is managed by unified processor
        unifiedProcessor: {
          status: unifiedMediaProcessor ? 'running' : 'stopped',
          concurrency: {
            video: {
              maxConcurrentJobs: config.processing.maxConcurrentVideoJobs,
              activeJobs: 0 // Not tracked in unified processor
            },
            image: {
              maxConcurrentJobs: config.processing.maxConcurrentImageJobs,
              activeJobs: 0 // Not tracked in unified processor
            }
          }
        }
      })
    })

    // Service info endpoint
    app.get('/info', (_req, res) => {
      const queues = createNamespacedMediaQueues()
      res.json({
        service: 'Unified Media Processing Service',
        version: '3.0.0',
        port: config.server.port,
        unifiedProcessor: {
          status: unifiedMediaProcessor ? 'running' : 'stopped',
          queues: queues,
          exchanges: config.rabbitmq.exchanges
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
        // Note: Cleanup is handled by the unified processor
        // Individual services no longer exist
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
        // Note: Cleanup is handled by the unified processor
        // Individual services no longer exist
      } catch (error) {
        logger.error('Error during final cleanup:', error)
      }
      
      if (unifiedMediaProcessor) {
        await unifiedMediaProcessor.stop()
        logger.info('Unified media processor stopped')
      }
      
      logger.info('All media processing services stopped')
      process.exit(0)
    }

    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))

  } catch (error) {
    logger.error('Failed to start media processing services:', error)
    
    if (unifiedMediaProcessor) {
      await unifiedMediaProcessor.stop()
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