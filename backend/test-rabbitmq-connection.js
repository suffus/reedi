#!/usr/bin/env node

const amqp = require('amqplib')

async function testBackendRabbitMQConnection() {
  try {
    // Use the same URL construction as the backend
    const user = process.env.RABBITMQ_USER || 'guest'
    const password = process.env.RABBITMQ_PASSWORD || 'guest'
    const port = process.env.RABBITMQ_PORT || '5672'
    const url = `amqp://${user}:${password}@localhost:${port}`
    
    console.log('🔗 Connecting to RabbitMQ with URL:', url.replace(/\/\/.*@/, '//***:***@'))
    
    const connection = await amqp.connect(url)
    const channel = await connection.createChannel()
    
    console.log('✅ Backend RabbitMQ connection successful')
    
    // Declare the same exchanges and queues as the backend
    await channel.assertExchange('video.processing', 'direct', { durable: true })
    await channel.assertExchange('video.updates', 'direct', { durable: true })
    await channel.assertQueue('video.processing.requests', { durable: true })
    await channel.assertQueue('video.processing.updates', { durable: true })
    
    console.log('✅ Backend queues and exchanges declared successfully')
    
    // Test consuming from the updates queue
    await channel.consume('video.processing.updates', (msg) => {
      if (msg) {
        console.log('📨 Backend received message:', msg.content.toString())
        channel.ack(msg)
      }
    })
    
    console.log('✅ Backend consumer started successfully')
    
    // Send a test message
    const testMessage = {
      type: 'video_processing_update',
      job_id: 'test-backend-' + Date.now(),
      media_id: 'test-media-' + Date.now(),
      status: 'completed',
      progress: 100,
      timestamp: new Date().toISOString()
    }
    
    await channel.sendToQueue('video.processing.updates', Buffer.from(JSON.stringify(testMessage)))
    console.log('✅ Backend sent test message')
    
    // Wait a bit to see if the message is received
    setTimeout(async () => {
      await connection.close()
      console.log('✅ Backend RabbitMQ test completed')
      process.exit(0)
    }, 5000)
    
  } catch (error) {
    console.error('❌ Backend RabbitMQ test failed:', error)
    process.exit(1)
  }
}

testBackendRabbitMQConnection() 