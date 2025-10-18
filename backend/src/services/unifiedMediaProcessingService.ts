import { PrismaClient } from '@prisma/client'
import { RabbitMQService } from './rabbitmqService'
import { createNamespacedExchanges, createNamespacedMediaQueues } from '../utils/rabbitmqNamespace'
import { ImageProcessingService } from './imageProcessingService'
import { ZipProcessingService } from './zipProcessingService'
import { VideoProcessingService } from './videoProcessingService'
import { MediaProcessingMessage, MediaProcessingRequest, MediaProgressUpdate, MediaProcessingResult } from '../types/media-processing'
import logger from '../utils/logger'

/**
 * Unified media processing service that routes messages to appropriate handlers
 * This prevents conflicts between different media processing services
 */
export class UnifiedMediaProcessingService extends RabbitMQService {
  private imageService: ImageProcessingService
  private zipService: ZipProcessingService
  private videoService: VideoProcessingService
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    const exchanges = createNamespacedExchanges()
    const queues = createNamespacedMediaQueues()
    
    super(
      process.env['RABBITMQ_URL'] || `amqp://${process.env['RABBITMQ_USER'] || 'guest'}:${process.env['RABBITMQ_PASSWORD'] || 'guest'}@localhost:${process.env['RABBITMQ_PORT'] || '5672'}`,
      exchanges,
      'media-processing',
      {
        requests: queues.requests,
        updates: queues.updates
      }
    )
    
    this.prisma = prisma
    this.imageService = new ImageProcessingService(prisma, true) // Skip queue consumption
    this.zipService = new ZipProcessingService(prisma, true) // Skip queue consumption
    this.videoService = new VideoProcessingService(prisma, true) // Skip queue consumption
  }

  async start(): Promise<void> {
    await this.connect()
    
    // Start individual services (they won't consume from queues, just handle updates)
    await this.imageService.start()
    await this.zipService.start()
    await this.videoService.start()
    
    // Only this service consumes from the unified updates queue
    // We need to consume raw messages directly to preserve the MediaProcessingMessage format
    await this.consumeRawUpdates(async (message) => {
      await this.routeUpdate(message)
    })
    
    logger.info('Unified media processing service started')
  }

  async stop(): Promise<void> {
    await this.imageService.stop()
    await this.zipService.stop()
    await this.videoService.stop()
    await this.close()
    logger.info('Unified media processing service stopped')
  }

  private async routeUpdate(update: any): Promise<void> {
    try {
      console.log(`🔄 [UNIFIED-ROUTER] Received update:`, JSON.stringify(update, null, 2))
      
      // The media processor is already sending the correct format with mediaType
      // We can use it directly instead of converting from ProgressUpdate format
      const mediaType = update.mediaType
      
      console.log(`🔄 [UNIFIED-ROUTER] Using mediaType from message: ${mediaType}`)
      
      // Route to appropriate service based on mediaType
      switch (mediaType) {
        case 'image':
          console.log(`🖼️ [UNIFIED-ROUTER] Calling ImageProcessingService.handleProgressUpdate`)
          await this.imageService.handleProgressUpdate(update)
          break
        case 'zip':
          console.log(`📦 [UNIFIED-ROUTER] Calling ZipProcessingService.handleProgressUpdate`)
          console.log(`📦 [UNIFIED-ROUTER] Update message type: ${update.messageType}`)
          console.log(`📦 [UNIFIED-ROUTER] Update status: ${update.status}`)
          await this.zipService.handleProgressUpdate(update)
          break
        case 'video':
          console.log(`🎥 [UNIFIED-ROUTER] Calling VideoProcessingService.handleProgressUpdate`)
          await this.videoService.handleProgressUpdate(update)
          break
        default:
          console.warn(`🔄 [UNIFIED-ROUTER] Unknown media type: ${mediaType}`)
      }
      
      console.log(`✅ [UNIFIED-ROUTER] Successfully routed update to ${mediaType} service`)
      
    } catch (error) {
      console.error(`❌ [UNIFIED-ROUTER] Error routing update:`, error)
      logger.error('Error routing update:', error)
    }
  }

  // Expose individual services for direct access
  getImageService(): ImageProcessingService {
    return this.imageService
  }

  getZipService(): ZipProcessingService {
    return this.zipService
  }

  getVideoService(): VideoProcessingService {
    return this.videoService
  }
}
