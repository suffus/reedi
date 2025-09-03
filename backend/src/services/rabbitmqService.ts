import * as amqp from 'amqplib'
import logger from '../utils/logger'
import { createNamespacedExchanges, createNamespacedStagedQueues } from '../utils/rabbitmqNamespace'

export interface ImageProcessingRequest {
  type: 'image_processing_request'
  job_id: string
  media_id: string
  user_id: string
  s3_key: string
  original_filename: string
  request_progress_updates: boolean
  progress_interval: number
  timestamp: string
}

export interface ImageProgressUpdate {
  type: 'image_processing_update'
  job_id: string
  media_id: string
  status: 'processing' | 'completed' | 'failed'
  progress: number
  current_step?: string
  image_versions?: Array<{
    quality: string
    s3Key: string
    width: number
    height: number
    fileSize: number
  }>
  metadata?: {
    width: number
    height: number
    format: string
    colorSpace?: string
    hasAlpha?: boolean
  }
  error_message?: string
  timestamp: string
}

export interface ImageQueueConfig {
  download: string
  processing: string
  upload: string
  updates: string
}

// Legacy RabbitMQ service for video processing (keeping for backward compatibility)
export interface ProcessingRequest {
  type: 'video_processing_request'
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
  type: 'video_processing_update'
  job_id: string
  media_id: string
  status: 'pending' | 'processing' | 'completed' | 'rejected' | 'failed'
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
    s3Key: string
    width: number
    height: number
    fileSize: number
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

export class RabbitMQService {
  private connection?: amqp.Connection
  private channel?: amqp.Channel
  private readonly url: string
  private readonly routingKey: string
  private readonly exchanges: {
    processing: string
    updates: string
  }
  private readonly queues: {
    requests: string
    updates: string
  }
  private updateCallback?: (update: ProgressUpdate) => Promise<void>

  constructor(
    url: string = process.env['RABBITMQ_URL'] || `amqp://${process.env['RABBITMQ_USER'] || 'guest'}:${process.env['RABBITMQ_PASSWORD'] || 'guest'}@localhost:${process.env['RABBITMQ_PORT'] || '5672'}`,
    exchanges: {
      processing: string,
      updates: string
    },
    routingKey = 'media',
    queues: {
      requests: string,
      updates: string
    } 
  ) {
    this.url = url
    this.exchanges = exchanges
    this.queues = queues
    this.routingKey = routingKey
  }

  async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(this.url) as any
      this.channel = await (this.connection as any).createChannel()
      
      if (!this.channel) {
        throw new Error('Failed to create RabbitMQ channel')
      }
      
      // Declare exchanges
      await this.channel.assertExchange(this.exchanges.processing, 'direct', { durable: true })
      await this.channel.assertExchange(this.exchanges.updates, 'direct', { durable: true })
      
      // Declare queues
      await this.channel.assertQueue(this.queues.requests, { durable: true })
      await this.channel.assertQueue(this.queues.updates, { durable: true })
      
      // Bind queues to exchanges
      await this.channel.bindQueue(this.queues.requests, this.exchanges.processing, this.routingKey + '.request')
      await this.channel.bindQueue(this.queues.updates, this.exchanges.updates, this.routingKey + '.updates')
      logger.info(`Binding queue ${this.queues.updates} to exchange ${this.exchanges.updates} with routing key ${this.routingKey + '.updates'}`)
      
      logger.info('RabbitMQ connection established')
    } catch (error) {
      logger.error('Failed to connect to RabbitMQ:', error)
      throw error
    }
  }
/*
  async publishProcessingRequest(request: ProcessingRequest): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized')
    }

    try {
      const message = Buffer.from(JSON.stringify(request))
      await this.channel.publish(
        this.exchanges.processing,
        this.routingKey + '.request',
        message,
        { persistent: true }
      )
      
      logger.info(`Published processing request for job ${request.job_id}`)
    } catch (error) {
      logger.error('Failed to publish processing request:', error)
      throw error
    }
  }
*/
  async sendMessage(queueName: string, message: any): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized')
    }

    try {
      const messageBuffer = Buffer.from(JSON.stringify(message))
      const routingCode = this.routingKey + '.' + queueName.split('.').pop() || 'default'

      await this.channel.publish(
        this.exchanges.processing,
        routingCode,
        messageBuffer,
        { persistent: true }
      )
      
      logger.info(`Sent message to queue ${queueName} with routing code ${routingCode} over exchange ${this.exchanges.processing}: ${message.id || message.job_id}`)
    } catch (error) {
      logger.error(`Failed to send message to queue ${queueName}:`, error)
      throw error
    }
  }

  async consumeProgressUpdates(callback: (update: ProgressUpdate) => Promise<void>): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized')
    }

    this.updateCallback = callback
    logger.info(`Rabbit MQ Consuming progress updates from queue: ${this.queues.updates}`)
    await this.channel.consume(this.queues.updates, async (msg: amqp.ConsumeMessage | null) => {
      if (!msg) {
        console.log('XXX No message received in updates queue ' + this.queues.updates)
        return
      }

      logger.info(`Rabbit MQ Consuming an update from queue: ${this.queues.updates}`)

      try {
        const update: ProgressUpdate = JSON.parse(msg.content.toString())
        logger.info(`Received progress update for job ${update.job_id}: ${update.status} (${update.progress}%)`)
        
        // Acknowledge the message
        this.channel!.ack(msg)
        if (this.updateCallback) {
          await this.updateCallback(update)
        }
        
      } catch (error) {
        logger.error('Error processing progress update:', error)
        
        // Reject the message and requeue it
        this.channel!.nack(msg, false, true)
      }
    })

    logger.info(`Started consuming progress updates from queue: ${this.queues.updates}`)
  }

  async close(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close()
      }
      if (this.connection) {
        await (this.connection as any).close()
      }
      logger.info('RabbitMQ connection closed')
    } catch (error) {
      logger.error('Error closing RabbitMQ connection:', error)
    }
  }

  isConnected(): boolean {
    return !!(this.connection && this.channel)
  }
}
