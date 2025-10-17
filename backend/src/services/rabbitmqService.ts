import * as amqp from 'amqplib'
import logger from '../utils/logger'
import { createNamespacedExchanges, createNamespacedStagedQueues } from '../utils/rabbitmqNamespace'



declare module 'amqplib' {
  interface Connection {
    close: (callback?: () => void) => void;
    connect: (url: string) => Promise<Connection>;
    createChannel: () => Promise<Channel>;
  }
}


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
  type: 'image_processing_update' | 'video_processing_update' | 'zip_processing_update'
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
      this.connection = await amqp.connect(this.url) as unknown as amqp.Connection;
      this.channel = await this.connection.createChannel()
      
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
      await this.channel.bindQueue(this.queues.requests, this.exchanges.processing, this.routingKey + '.requests')
      await this.channel.bindQueue(this.queues.updates, this.exchanges.updates, this.routingKey + '.updates')
      logger.info(`Binding queue ${this.queues.requests} to exchange ${this.exchanges.processing} with routing key ${this.routingKey + '.requests'}`)
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
      
      console.log(`🐰 [BACKEND] Sending message to queue: ${queueName}`)
      console.log(`🐰 [BACKEND] Routing code: ${routingCode}`)
      console.log(`🐰 [BACKEND] Exchange: ${this.exchanges.processing}`)
      console.log(`🐰 [BACKEND] Message type: ${message.messageType}`)
      console.log(`🐰 [BACKEND] Media type: ${message.mediaType}`)
      console.log(`🐰 [BACKEND] Media ID: ${message.mediaId}`)
      console.log(`🐰 [BACKEND] Full message:`, JSON.stringify(message, null, 2))
      
      logger.info(`Sent message to queue ${queueName} with routing code ${routingCode} over exchange ${this.exchanges.processing}: ${message.id || message.job_id}`)
    } catch (error) {
      console.error(`❌ [BACKEND] Failed to send message to queue ${queueName}:`, error)
      logger.error(`Failed to send message to queue ${queueName}:`, error)
      throw error
    }
  }

  async consumeProgressUpdates(callback: (update: ProgressUpdate) => Promise<void>): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized')
    }

    this.updateCallback = callback
    console.log(`🐰 [BACKEND] Starting to consume progress updates from queue: ${this.queues.updates}`)
    logger.info(`Rabbit MQ Consuming progress updates from queue: ${this.queues.updates}`)
    
    await this.channel.consume(this.queues.updates, async (msg: amqp.ConsumeMessage | null) => {
      if (!msg) {
        console.log('XXX No message received in updates queue ' + this.queues.updates)
        return
      }

      console.log(`🐰 [BACKEND] Received message from updates queue: ${this.queues.updates}`)
      console.log(`🐰 [BACKEND] Message content:`, msg.content.toString())
      logger.info(`Rabbit MQ Consuming an update from queue: ${this.queues.updates}`)

      try {
        const messageContent = msg.content.toString()
        const parsedMessage = JSON.parse(messageContent)
        
        console.log(`🐰 [BACKEND] Parsed message:`, JSON.stringify(parsedMessage, null, 2))
        console.log(`🐰 [BACKEND] Message type: ${parsedMessage.messageType}`)
        console.log(`🐰 [BACKEND] Media type: ${parsedMessage.mediaType}`)
        console.log(`🐰 [BACKEND] Media ID: ${parsedMessage.mediaId}`)
        
        // Try to convert to ProgressUpdate format for backward compatibility
        let progress = parsedMessage.progress || 0
        let status = parsedMessage.status?.toLowerCase() || 'processing'
        let currentStep = parsedMessage.stage || 'processing'
        
        // Handle result messages - if it's a result with COMPLETED status, set progress to 100
        if (parsedMessage.messageType === 'result' && parsedMessage.status === 'COMPLETED') {
          progress = 100
          status = 'completed'
          currentStep = 'completed'
        } else if (parsedMessage.messageType === 'result' && parsedMessage.status === 'FAILED') {
          progress = 0
          status = 'failed'
          currentStep = 'failed'
        }
        
        const update: ProgressUpdate = {
          type: parsedMessage.mediaType === 'video' ? 'video_processing_update' : 
                parsedMessage.mediaType === 'zip' ? 'zip_processing_update' : 
                'image_processing_update',
          job_id: parsedMessage.details?.jobId || `img_${parsedMessage.mediaId}`,
          media_id: parsedMessage.mediaId,
          status,
          progress,
          current_step: currentStep,
          timestamp: parsedMessage.timestamp,
          // Include result data if it's a result message
          ...(parsedMessage.messageType === 'result' && parsedMessage.result ? {
            image_versions: parsedMessage.result.s3Key ? [{
              quality: 'original',
              s3Key: parsedMessage.result.s3Key,
              width: parsedMessage.result.width || 0,
              height: parsedMessage.result.height || 0,
              fileSize: 0
            }] : undefined,
            metadata: parsedMessage.result.metadata
          } : {})
        }
        
        console.log(`🐰 [BACKEND] Converted to ProgressUpdate:`, JSON.stringify(update, null, 2))
        console.log(`🐰 [BACKEND] Message conversion: ${parsedMessage.messageType} -> ${update.status} (${update.progress}%)`)
        logger.info(`Received progress update for job ${update.job_id}: ${update.status} (${update.progress}%)`)
        
        // Acknowledge the message
        this.channel!.ack(msg)
        if (this.updateCallback) {
          await this.updateCallback(update)
        }
        
      } catch (error) {
        console.error(`❌ [BACKEND] Error processing progress update:`, error)
        logger.error('Error processing progress update:', error)
        
        // Reject the message and requeue it
        this.channel!.nack(msg, false, true)
      }
    })

    logger.info(`Started consuming progress updates from queue: ${this.queues.updates}`)
  }

  async consumeRawUpdates(callback: (message: any) => Promise<void>): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized')
    }

    console.log(`🐰 [BACKEND] Starting to consume raw updates from queue: ${this.queues.updates}`)
    logger.info(`Rabbit MQ Consuming raw updates from queue: ${this.queues.updates}`)
    
    await this.channel.consume(this.queues.updates, async (msg: amqp.ConsumeMessage | null) => {
      if (!msg) {
        console.log('XXX No message received in updates queue ' + this.queues.updates)
        return
      }

      console.log(`🐰 [BACKEND] Received raw message from updates queue: ${this.queues.updates}`)
      console.log(`🐰 [BACKEND] Raw message content:`, msg.content.toString())
      logger.info(`Rabbit MQ Consuming raw update from queue: ${this.queues.updates}`)

      try {
        const messageContent = msg.content.toString()
        const parsedMessage = JSON.parse(messageContent)
        
        console.log(`🐰 [BACKEND] Parsed raw message:`, JSON.stringify(parsedMessage, null, 2))
        console.log(`🐰 [BACKEND] Message type: ${parsedMessage.messageType}`)
        console.log(`🐰 [BACKEND] Media type: ${parsedMessage.mediaType}`)
        console.log(`🐰 [BACKEND] Media ID: ${parsedMessage.mediaId}`)
        
        // Pass the raw message directly without conversion
        await callback(parsedMessage)
        
        // Acknowledge the message
        this.channel!.ack(msg)
        
      } catch (error) {
        console.error(`❌ [BACKEND] Error processing raw update:`, error)
        logger.error('Error processing raw update:', error)
        
        // Reject the message and requeue it
        this.channel!.nack(msg, false, true)
      }
    })

    logger.info(`Started consuming raw updates from queue: ${this.queues.updates}`)
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

// Simple helper functions for permission audit logging
let auditChannel: amqp.Channel | null = null;
let auditConnection: amqp.Connection | null = null;

/**
 * Initialize dedicated channel for permission audit logging
 */
export async function initAuditChannel(): Promise<void> {
  try {
    const url = process.env['RABBITMQ_URL'] || `amqp://${process.env['RABBITMQ_USER'] || 'guest'}:${process.env['RABBITMQ_PASSWORD'] || 'guest'}@localhost:${process.env['RABBITMQ_PORT'] || '5672'}`;
    
    auditConnection = await amqp.connect(url) as unknown as amqp.Connection;
    auditChannel = await auditConnection.createChannel() as amqp.Channel;
    
    // Declare audit queues
    await auditChannel.assertQueue('permission-audit', { durable: true });
    await auditChannel.assertQueue('facet-changes', { durable: true });
    
    logger.info('RabbitMQ audit channel initialized');
  } catch (error) {
    logger.error('Failed to initialize RabbitMQ audit channel:', error);
    // Don't throw - we'll fallback to direct DB writes if needed
  }
}

/**
 * Publish message to a queue
 */
export async function publishToQueue(
  queueName: string,
  data: any
): Promise<void> {
  // Initialize if not already done
  if (!auditChannel && !auditConnection) {
    await initAuditChannel();
  }
  
  if (!auditChannel) {
    throw new Error('RabbitMQ audit channel not initialized');
  }
  
  await auditChannel.sendToQueue(
    queueName,
    Buffer.from(JSON.stringify(data)),
    { persistent: true }
  );
  
  logger.debug(`Published message to queue ${queueName}`);
}

/**
 * Consume messages from a queue
 */
export async function consumeQueue(
  queueName: string,
  handler: (data: any) => Promise<void>
): Promise<void> {
  if (!auditChannel) {
    await initAuditChannel();
  }
  
  if (!auditChannel) {
    throw new Error('RabbitMQ audit channel not initialized');
  }
  
  // Assert the queue exists before consuming
  await auditChannel.assertQueue(queueName, { durable: true });
  
  await auditChannel.consume(queueName, async (msg) => {
    if (!msg) return;
    
    try {
      const data = JSON.parse(msg.content.toString());
      await handler(data);
      auditChannel!.ack(msg);
    } catch (error) {
      logger.error('Error processing message:', error);
      // Reject and requeue
      auditChannel!.nack(msg, false, true);
    }
  });
  
  logger.info(`Started consuming from queue: ${queueName}`);
}

/**
 * Close audit channel
 */
export async function closeAuditChannel(): Promise<void> {
  try {
    if (auditChannel) {
      await auditChannel.close();
      auditChannel = null;
    }
    if (auditConnection) {
      await (auditConnection as amqp.Connection).close( ()=>{} );
      auditConnection = null;
    }
    logger.info('RabbitMQ audit channel closed');
  } catch (error) {
    logger.error('Error closing RabbitMQ audit channel:', error);
  }
}
