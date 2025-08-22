import * as amqp from 'amqplib'
import logger from '../utils/logger'

export interface ProcessingRequest {
  type: 'video_processing_request' | 'image_processing_request'
  job_id: string
  media_id: string
  user_id: string
  s3_key: string
  original_filename: string
  request_thumbnails?: boolean
  request_progress_updates: boolean
  progress_interval: number
  timestamp: string
}

export interface ProgressUpdate {
  type: 'video_processing_update' | 'image_processing_update'
  job_id: string
  media_id: string
  status: 'processing' | 'completed' | 'failed'
  progress: number
  current_step?: string
  thumbnails?: Array<{
    s3_key: string
    timestamp: string
    width: number
    height: number
  }>
  video_versions?: Array<{
    quality: string
    s3_key: string
    width: number
    height: number
    file_size: number
  }>
  image_versions?: Array<{
    quality: string
    width: number
    height: number
    file_size: number
  }>
  metadata?: {
    duration?: number
    resolution?: string
    codec?: string
    bitrate?: number
    framerate?: number
    width?: number
    height?: number
    format?: string
    colorSpace?: string
    hasAlpha?: boolean
  }
  error_message?: string
  timestamp: string
}

export interface QueueConfig {
  download: string
  processing: string
  upload: string
  cleanup: string
  updates: string
}

export class EnhancedRabbitMQService {
  private connection?: amqp.Connection
  private channel?: amqp.Channel
  private readonly url: string
  private readonly exchanges: {
    requests: string
    processing: string
    updates: string
  }
  private readonly queues: QueueConfig
  private readonly routingKey: string
  
  // Track consumer tags for subscription management
  private consumerTags: Map<string, string> = new Map()
  private isSubscribed: Map<string, boolean> = new Map()

  constructor(
    url: string = 'amqp://localhost',
    exchanges = {
      requests: 'media.requests',
      processing: 'media.processing',
      updates: 'media.updates'
    },
    routingKey = 'define-the-routing-key',
    queues: QueueConfig 
  ) {
    this.url = url
    this.exchanges = exchanges
    this.queues = queues
    this.routingKey = routingKey
    
    // Initialize subscription state
    Object.values(queues).forEach(queueName => {
      this.isSubscribed.set(queueName, false)
    })
  }

  async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(this.url) as any
      this.channel = await (this.connection as any).createChannel()
      
      // Declare exchanges
      for (const exchange of Object.values(this.exchanges)) {
        await (this.channel as any).assertExchange(exchange, 'direct', {durable: true})
      }
      
      // Declare all queues
      await this.assertQueues(this.queues)
      await this.bindQueues(this.queues, this.routingKey)
      logger.info('Enhanced RabbitMQ connection established')
    } catch (error) {
      logger.error('Failed to connect to RabbitMQ:', error)
      throw error
    }
  }

  async assertQueues(queues: QueueConfig): Promise<void> {
    for (const queue of Object.values(queues)) {
      await (this.channel as any).assertQueue(queue, { durable: true })
    }
  }

  async bindQueues( queues: QueueConfig, routingKey: string): Promise<void> {
    await (this.channel as any).bindQueue(queues.download, this.exchanges.processing, routingKey+'.download')
    logger.info(`Binding queue ${queues.download} to exchange ${this.exchanges.processing} with routing key ${routingKey+'.download'}`)
    await (this.channel as any).bindQueue(queues.processing, this.exchanges.processing, routingKey+'.processing')
    logger.info(`Binding queue ${queues.processing} to exchange ${this.exchanges.processing} with routing key ${routingKey+'.processing'}`)
    await (this.channel as any).bindQueue(queues.upload, this.exchanges.processing, routingKey+'.upload')
    logger.info(`Binding queue ${queues.upload} to exchange ${this.exchanges.processing} with routing key ${routingKey+'.upload'}`)
    await (this.channel as any).bindQueue(queues.cleanup, this.exchanges.processing, routingKey+'.cleanup')
    logger.info(`Binding queue ${queues.cleanup} to exchange ${this.exchanges.processing} with routing key ${routingKey+'.cleanup'}`)
    await (this.channel as any).bindQueue(queues.updates, this.exchanges.updates, routingKey+'.updates')
    logger.info(`Binding queue ${queues.updates} to exchange ${this.exchanges.updates} with routing key ${routingKey+'.updates'}`)
  }

  async consumeQueue(queueName: string, callback: (message: any) => Promise<void>): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized')
    }

    logger.info(`Consuming from queue ${queueName}`)

    const consumer = await this.channel.consume(queueName, async (msg: amqp.ConsumeMessage | null) => {
      if (!msg) return

      try {
        const message = JSON.parse(msg.content.toString())
        logger.info(`Received message from queue ${queueName}: ${message.job_id || message.id}`)
        
        // Acknowledge the message immediately after receiving it
        // This prevents RabbitMQ timeouts for long-running processing jobs
        this.channel!.ack(msg)
        
        // Now process the message (without blocking the acknowledgment)
        await callback(message)
        
      } catch (error) {
        logger.error(`Error processing message from queue ${queueName}:`, error)
        
        // Note: We can't nack here since we already acked the message
        // The error will be logged but the message won't be requeued
        // This is acceptable since we want to avoid timeouts for long videos
      }
    }, {
      // Use noAck: false to ensure we can manually acknowledge messages
      noAck: false
    })

    // Store the consumer tag for later cancellation
    this.consumerTags.set(queueName, consumer.consumerTag)
    this.isSubscribed.set(queueName, true)
    
    logger.info(`Started consuming from queue: ${queueName}`)
  }

  async unsubscribeFromQueue(queueName: string): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized')
    }

    const consumerTag = this.consumerTags.get(queueName)
    if (!consumerTag || !this.isSubscribed.get(queueName)) {
      logger.warn(`Not subscribed to queue ${queueName}, cannot unsubscribe`)
      return
    }

    try {
      await this.channel.cancel(consumerTag)
      this.consumerTags.delete(queueName)
      this.isSubscribed.set(queueName, false)
      logger.info(`Unsubscribed from queue: ${queueName}`)
    } catch (error) {
      logger.error(`Failed to unsubscribe from queue ${queueName}:`, error)
      throw error
    }
  }

  async resubscribeToQueue(queueName: string, callback: (message: any) => Promise<void>): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized')
    }

    if (this.isSubscribed.get(queueName)) {
      logger.warn(`Already subscribed to queue ${queueName}, cannot resubscribe`)
      return
    }

    try {
      await this.consumeQueue(queueName, callback)
      logger.info(`Resubscribed to queue: ${queueName}`)
    } catch (error) {
      logger.error(`Failed to resubscribe to queue ${queueName}:`, error)
      throw error
    }
  }

  isSubscribedToQueue(queueName: string): boolean {
    return this.isSubscribed.get(queueName) || false
  }

  async sendMessage(queueName: string, message: any): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized')
    }

    try {
      const messageBuffer = Buffer.from(JSON.stringify(message))
      logger.info(`Routing message to queue ${queueName} with routing key ${this.routingKey + '.' + queueName.split('.').pop() || 'default'}`)
      await this.channel.publish(
        this.exchanges.processing,
        this.routingKey + '.' + queueName.split('.').pop() || 'default',
        messageBuffer,
        { persistent: true }
      )
      
      logger.info(`Sent message to queue ${queueName}: ${message.job_id || message.id}`)
      console.log(JSON.stringify(message, null, 2))
    } catch (error) {
      logger.error(`Failed to send message to queue ${queueName}:`, error)
      throw error
    }
  }

  async publishProgressUpdate(update: ProgressUpdate): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized')
    }

    try {
      const message = Buffer.from(JSON.stringify(update))
      logger.info(`Publishing progress update for job ${update.job_id} with message ${message}`)
      await this.channel.publish(
        this.exchanges.updates,
        this.routingKey + '.updates',
        message,
        { persistent: true }
      )
      
      logger.info(`Published progress update for job ${update.job_id}: ${update.status} (${update.progress}%)`)
    } catch (error) {
      logger.error('Failed to publish progress update:', error)
      throw error
    }
  }

  async close(): Promise<void> {
    try {
      if (this.channel) {
        await (this.channel as any).close()
      }
      if (this.connection) {
        await (this.connection as any).close()
      }
      logger.info('Enhanced RabbitMQ connection closed')
    } catch (error) {
      logger.error('Error closing RabbitMQ connection:', error)
    }
  }

  isConnected(): boolean {
    return !!(this.connection && this.channel)
  }

  getQueueConfig(): QueueConfig {
    return this.queues
  }
} 