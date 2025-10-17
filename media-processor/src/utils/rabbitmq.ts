import * as amqp from 'amqplib'
import logger from './logger'

let connection: amqp.Connection | null = null
let channel: amqp.Channel | null = null

export async function initRabbitMQ(): Promise<void> {
  try {
    const url = process.env['RABBITMQ_URL'] || `amqp://${process.env['RABBITMQ_USER'] || 'guest'}:${process.env['RABBITMQ_PASSWORD'] || 'guest'}@localhost:${process.env['RABBITMQ_PORT'] || '5672'}`;
    
    connection = await amqp.connect(url) as any;
    channel = await (connection as any).createChannel();
    
    logger.info('RabbitMQ connection initialized');
  } catch (error) {
    logger.error('Failed to initialize RabbitMQ connection:', error);
    throw error;
  }
}

export async function consumeMessage(queueName: string, handler: (message: string) => Promise<void>): Promise<void> {
  if (!channel) {
    await initRabbitMQ();
  }
  
  if (!channel) {
    throw new Error('RabbitMQ channel not initialized');
  }
  
  // Assert the queue exists before consuming
  await channel.assertQueue(queueName, { durable: true });
  
  console.log(`🐰 [MEDIA-PROCESSOR] Starting to consume from queue: ${queueName}`);
  
  await channel.consume(queueName, async (msg) => {
    if (!msg) return;
    
    try {
      const message = msg.content.toString();
      console.log(`🐰 [MEDIA-PROCESSOR] Received message from queue: ${queueName}`);
      console.log(`🐰 [MEDIA-PROCESSOR] Message content:`, message);
      
      // Try to parse and log message details
      try {
        const parsedMessage = JSON.parse(message);
        console.log(`🐰 [MEDIA-PROCESSOR] Message type: ${parsedMessage.messageType}`);
        console.log(`🐰 [MEDIA-PROCESSOR] Media type: ${parsedMessage.mediaType}`);
        console.log(`🐰 [MEDIA-PROCESSOR] Media ID: ${parsedMessage.mediaId}`);
        console.log(`🐰 [MEDIA-PROCESSOR] User ID: ${parsedMessage.userId}`);
      } catch (parseError) {
        console.log(`🐰 [MEDIA-PROCESSOR] Could not parse message as JSON`);
      }
      
      await handler(message);
      channel!.ack(msg);
      console.log(`🐰 [MEDIA-PROCESSOR] Message processed and acknowledged`);
    } catch (error) {
      console.error(`❌ [MEDIA-PROCESSOR] Error processing message from queue ${queueName}:`, error);
      logger.error('Error processing message:', error);
      // Reject and requeue
      channel!.nack(msg, false, true);
    }
  });
  
  logger.info(`Started consuming from queue: ${queueName}`);
}

export async function publishMessage(queueName: string, message: any): Promise<void> {
  if (!channel) {
    await initRabbitMQ();
  }
  
  if (!channel) {
    throw new Error('RabbitMQ channel not initialized');
  }
  
  // Assert the queue exists before publishing
  await channel.assertQueue(queueName, { durable: true });
  
  const messageBuffer = Buffer.from(JSON.stringify(message));
  
  console.log(`🐰 [MEDIA-PROCESSOR] Publishing message to queue: ${queueName}`);
  console.log(`🐰 [MEDIA-PROCESSOR] Message content:`, JSON.stringify(message, null, 2));
  
  await channel.sendToQueue(queueName, messageBuffer, { persistent: true });
  
  logger.info(`Published message to queue: ${queueName}`);
}

export async function closeRabbitMQ(): Promise<void> {
  if (channel) {
    await channel.close();
    channel = null;
  }
  
  if (connection) {
    await (connection as any).close();
    connection = null;
  }
  
  logger.info('RabbitMQ connection closed');
}
