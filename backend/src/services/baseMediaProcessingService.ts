import { RabbitMQService } from './rabbitmqService'
import { createNamespacedExchanges, createNamespacedMediaQueues } from '../utils/rabbitmqNamespace'
import { 
  MediaProcessingMessage, 
  MediaProcessingRequest, 
  MediaProgressUpdate, 
  MediaProcessingResult,
  MediaType,
  MessageType,
  ProcessingStatus
} from '../types/media-processing'
import logger from '../utils/logger'

/**
 * Base class for all media processing services
 * Provides unified queue management and message handling
 */
export abstract class BaseMediaProcessingService extends RabbitMQService {
  protected readonly mediaType: MediaType
  protected mediaUpdateCallback?: (update: MediaProcessingMessage) => Promise<void>
  protected skipQueueConsumption: boolean = false

  constructor(mediaType: MediaType, skipQueueConsumption: boolean = false) {
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
    
    this.mediaType = mediaType
    this.skipQueueConsumption = skipQueueConsumption
  }

  /**
   * Start the processing service
   */
  async start(): Promise<void> {
    await this.connect()
    
    // Only consume from queue if not skipped
    if (!this.skipQueueConsumption) {
      await this.consumeUpdates()
    }
    
    logger.info(`${this.mediaType} processing service started${this.skipQueueConsumption ? ' (queue consumption disabled)' : ''}`)
  }

  /**
   * Stop the processing service
   */
  async stop(): Promise<void> {
    await this.close()
    logger.info(`${this.mediaType} processing service stopped`)
  }

  /**
   * Publish a processing request
   */
  async publishProcessingRequest(request: Omit<MediaProcessingRequest, 'messageType' | 'mediaType' | 'timestamp'>): Promise<void> {
    const message: MediaProcessingRequest = {
      ...request,
      messageType: 'request',
      mediaType: this.mediaType,
      timestamp: new Date().toISOString()
    }

    console.log(`📤 [BASE-SERVICE] Publishing ${this.mediaType} processing request`)
    console.log(`📤 [BASE-SERVICE] Media ID: ${request.mediaId}`)
    console.log(`📤 [BASE-SERVICE] User ID: ${request.userId}`)
    console.log(`📤 [BASE-SERVICE] S3 Key: ${request.s3Key}`)
    console.log(`📤 [BASE-SERVICE] Original filename: ${request.originalFilename}`)
    console.log(`📤 [BASE-SERVICE] Full message:`, JSON.stringify(message, null, 2))

    await this.sendMessage('requests', message)
    logger.info(`Published ${this.mediaType} processing request for media ${request.mediaId}`)
  }

  /**
   * Publish a progress update
   */
  async publishProgressUpdate(update: Omit<MediaProgressUpdate, 'messageType' | 'mediaType' | 'timestamp'>): Promise<void> {
    const message: MediaProgressUpdate = {
      ...update,
      messageType: 'progress',
      mediaType: this.mediaType,
      timestamp: new Date().toISOString()
    }

    await this.sendMessage('updates', message)
    logger.debug(`Published ${this.mediaType} progress update for media ${update.mediaId}`)
  }

  /**
   * Publish a processing result
   */
  async publishProcessingResult(result: Omit<MediaProcessingResult, 'messageType' | 'mediaType' | 'timestamp'>): Promise<void> {
    const message: MediaProcessingResult = {
      ...result,
      messageType: 'result',
      mediaType: this.mediaType,
      timestamp: new Date().toISOString()
    }

    await this.sendMessage('updates', message)
    logger.info(`Published ${this.mediaType} processing result for media ${result.mediaId}`)
  }

  /**
   * Publish a processing error
   */
  async publishProcessingError(error: Omit<MediaProcessingMessage, 'messageType' | 'mediaType' | 'timestamp'>): Promise<void> {
    const message: MediaProcessingMessage = {
      ...error,
      messageType: 'error',
      mediaType: this.mediaType,
      timestamp: new Date().toISOString()
    } as MediaProcessingMessage

    await this.sendMessage('updates', message)
    logger.error(`Published ${this.mediaType} processing error for media ${error.mediaId}`)
  }

  /**
   * Consume updates from the unified updates queue
   * Filters messages by media type
   */
  private async consumeUpdates(): Promise<void> {
    await this.consumeProgressUpdates(async (update) => {
      try {
        console.log(`🔄 [BASE-SERVICE] Received ProgressUpdate:`, JSON.stringify(update, null, 2))
        
        // Convert ProgressUpdate to MediaProcessingMessage
        const isResultMessage = update.status === 'completed' || update.status === 'failed'
        
        let mediaUpdate: MediaProcessingMessage
        
        if (isResultMessage) {
          // Create MediaProcessingResult
          mediaUpdate = {
            messageType: 'result',
            mediaType: this.mediaType,
            mediaId: update.media_id,
            userId: '', // Not available in ProgressUpdate, will be filled by the handler
            timestamp: update.timestamp,
            status: update.status.toUpperCase() as ProcessingStatus,
            result: update.image_versions ? {
              s3Key: update.image_versions[0]?.s3Key || '',
              thumbnailS3Key: update.image_versions[0]?.s3Key || '',
              width: update.image_versions[0]?.width || 0,
              height: update.image_versions[0]?.height || 0,
              metadata: update.metadata || {}
            } : undefined,
            error: update.error_message,
            details: {
              jobId: update.job_id
            }
          } as MediaProcessingResult
        } else {
          // Create MediaProgressUpdate
          mediaUpdate = {
            messageType: 'progress',
            mediaType: this.mediaType,
            mediaId: update.media_id,
            userId: '', // Not available in ProgressUpdate, will be filled by the handler
            timestamp: update.timestamp,
            status: update.status.toUpperCase() as ProcessingStatus,
            progress: update.progress,
            stage: update.current_step || 'processing',
            details: {
              jobId: update.job_id,
              errorMessage: update.error_message,
              imageVersions: update.image_versions,
              metadata: update.metadata
            }
          } as MediaProgressUpdate
        }
        
        console.log(`🔄 [BASE-SERVICE] Converted to MediaProcessingMessage:`, JSON.stringify(mediaUpdate, null, 2))
        
        // Filter by media type
        if (mediaUpdate.mediaType !== this.mediaType) {
          console.log(`🔄 [BASE-SERVICE] Filtering out message for media type: ${mediaUpdate.mediaType} (expected: ${this.mediaType})`)
          return
        }

        // Call the update callback if set
        if (this.mediaUpdateCallback) {
          console.log(`🔄 [BASE-SERVICE] Calling update callback for media ${mediaUpdate.mediaId}`)
          await this.mediaUpdateCallback(mediaUpdate)
        }

        logger.debug(`Processed ${this.mediaType} update for media ${mediaUpdate.mediaId}`)
      } catch (error) {
        console.error(`❌ [BASE-SERVICE] Error processing ${this.mediaType} update:`, error)
        logger.error(`Error processing ${this.mediaType} update:`, error)
      }
    })
  }

  /**
   * Set the update callback
   */
  setUpdateCallback(callback: (update: MediaProcessingMessage) => Promise<void>): void {
    this.mediaUpdateCallback = callback
  }

  /**
   * Handle progress update directly (for unified routing)
   */
  async handleProgressUpdate(update: MediaProcessingMessage): Promise<void> {
    if (this.mediaUpdateCallback) {
      await this.mediaUpdateCallback(update)
    }
  }

  /**
   * Check if the service is connected
   */
  isConnected(): boolean {
    return super.isConnected()
  }
}
