import * as amqp from 'amqplib'
import logger from '../utils/logger'

export interface ProcessingRequest {
  type: 'video_processing_request'
  job_id: string
  media_id: string
  user_id: string
  s3_key: string
  original_filename: string
  request_thumbnails: boolean
  request_progress_updates: boolean
  progress_interval: number
  timestamp: string
}

export interface ProgressUpdate {
  type: 'video_processing_update'
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
  metadata?: {
    duration: number
    resolution: string
    codec: string
    bitrate: number
    framerate: number
  }
  error_message?: string
  timestamp: string
}

export interface QueueConfig {
  download: string
  processing: string
  upload: string
  updates: string
}

export class EnhancedRabbitMQService {
  private connection?: amqp.Connection
  private channel?: amqp.Channel
  private readonly url: string
  private readonly exchanges: {
    processing: string
    updates: string
  }
  private readonly queues: QueueConfig

  constructor(
    url: string = 'amqp://localhost',
    exchanges = {
      processing: 'video.processing',
      updates: 'video.updates'
    },
    queues: QueueConfig = {
      download: 'video.processing.download',
      processing: 'video.processing.processing',
      upload: 'video.processing.upload',
      updates: 'video.processing.updates'
    }
  ) {
    this.url = url
    this.exchanges = exchanges
    this.queues = queues
  }

  async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(this.url) as any
      this.channel = await (this.connection as any).createChannel()
      
      // Declare exchanges
      await (this.channel as any).assertExchange(this.exchanges.processing, 'direct', { durable: true })
      await (this.channel as any).assertExchange(this.exchanges.updates, 'direct', { durable: true })
      
      // Declare all queues
      await (this.channel as any).assertQueue(this.queues.download, { durable: true })
      await (this.channel as any).assertQueue(this.queues.processing, { durable: true })
      await (this.channel as any).assertQueue(this.queues.upload, { durable: true })
      await (this.channel as any).assertQueue(this.queues.updates, { durable: true })
      
      // Bind queues to exchanges
      await (this.channel as any).bindQueue(this.queues.download, this.exchanges.processing, 'download')
      await (this.channel as any).bindQueue(this.queues.processing, this.exchanges.processing, 'processing')
      await (this.channel as any).bindQueue(this.queues.upload, this.exchanges.processing, 'upload')
      await (this.channel as any).bindQueue(this.queues.updates, this.exchanges.updates, 'update')
      
      logger.info('Enhanced RabbitMQ connection established')
    } catch (error) {
      logger.error('Failed to connect to RabbitMQ:', error)
      throw error
    }
  }

  async consumeQueue(queueName: string, callback: (message: any) => Promise<void>): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized')
    }

    await this.channel.consume(queueName, async (msg: amqp.ConsumeMessage | null) => {
      if (!msg) return

      try {
        const message = JSON.parse(msg.content.toString())
        logger.info(`Received message from queue ${queueName}: ${message.job_id || message.id}`)
        
        await callback(message)
        
        // Acknowledge the message
        this.channel!.ack(msg)
      } catch (error) {
        logger.error(`Error processing message from queue ${queueName}:`, error)
        
        // Reject the message and requeue it
        this.channel!.nack(msg, false, true)
      }
    })

    logger.info(`Started consuming from queue: ${queueName}`)
  }

  async sendMessage(queueName: string, message: any): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized')
    }

    try {
      const messageBuffer = Buffer.from(JSON.stringify(message))
      await this.channel.publish(
        this.exchanges.processing,
        queueName.split('.').pop() || 'default',
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
      await this.channel.publish(
        this.exchanges.updates,
        'update',
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