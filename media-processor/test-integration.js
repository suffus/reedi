#!/usr/bin/env node

const amqp = require('amqplib')
require('dotenv').config()

async function testRabbitMQ() {
  try {
    console.log('Testing RabbitMQ connection...')
    
    // Build RabbitMQ URL from environment variables
    const rabbitmqUrl = process.env.RABBITMQ_URL || 
      `amqp://${process.env.RABBITMQ_USER || 'guest'}:${process.env.RABBITMQ_PASSWORD || 'guest'}@localhost:${process.env.RABBITMQ_PORT || '5672'}`
    
    console.log('Connecting to RabbitMQ at:', rabbitmqUrl.replace(/\/\/.*@/, '//***:***@'))
    
    // Connect to RabbitMQ
    const connection = await amqp.connect(rabbitmqUrl)
    const channel = await connection.createChannel()
    
    console.log('✅ Connected to RabbitMQ')
    
    // Declare exchanges
    await channel.assertExchange('video.processing', 'direct', { durable: true })
    await channel.assertExchange('video.updates', 'direct', { durable: true })
    
    console.log('✅ Exchanges declared')
    
    // Declare queues
    await channel.assertQueue('video.processing.requests', { durable: true })
    await channel.assertQueue('video.processing.updates', { durable: true })
    
    console.log('✅ Queues declared')
    
    // Bind queues to exchanges
    await channel.bindQueue('video.processing.requests', 'video.processing', 'request')
    await channel.bindQueue('video.processing.updates', 'video.updates', 'update')
    
    console.log('✅ Queues bound to exchanges')
    
    // Test publishing a message
    const testMessage = {
      type: 'video_processing_request',
      job_id: 'test-job-123',
      media_id: 'test-media-456',
      user_id: 'test-user-789',
      s3_key: 'uploads/test-video.mp4',
      original_filename: 'test-video.mp4',
      request_thumbnails: true,
      request_progress_updates: true,
      progress_interval: 5,
      timestamp: new Date().toISOString()
    }
    
    await channel.publish(
      'video.processing',
      'request',
      Buffer.from(JSON.stringify(testMessage)),
      { persistent: true }
    )
    
    console.log('✅ Test message published')
    
    // Test consuming a message
    await channel.consume('video.processing.requests', (msg) => {
      if (msg) {
        const content = JSON.parse(msg.content.toString())
        console.log('✅ Received test message:', content.job_id)
        channel.ack(msg)
        
        // Close connection after receiving message
        setTimeout(() => {
          connection.close()
          console.log('✅ Test completed successfully')
          process.exit(0)
        }, 1000)
      }
    })
    
    console.log('✅ Waiting for test message...')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    process.exit(1)
  }
}

testRabbitMQ() 