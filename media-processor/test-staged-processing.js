#!/usr/bin/env node

const amqp = require('amqplib')

async function testStagedProcessing() {
  try {
    // Connect to RabbitMQ with credentials
    const connection = await amqp.connect('amqp://reedi:El1xirOfL1f3@localhost:5672')
    const channel = await connection.createChannel()
    
    // Declare queues
    await channel.assertQueue('video.processing.download', { durable: true })
    await channel.assertQueue('video.processing.processing', { durable: true })
    await channel.assertQueue('video.processing.upload', { durable: true })
    await channel.assertQueue('video.processing.updates', { durable: true })
    
    console.log('✅ Connected to RabbitMQ and declared queues')
    
    // Create a test job
    const testJob = {
      id: 'test-job-' + Date.now(),
      mediaId: 'test-media-' + Date.now(),
      userId: 'test-user',
      mediaType: 'VIDEO',
      s3Key: 'videos/test-video.mp4',
      originalFilename: 'test-video.mp4',
      mimeType: 'video/mp4',
      fileSize: 1024 * 1024, // 1MB
      createdAt: new Date(),
      stage: 'DOWNLOADING'
    }
    
    // Send to download queue
    await channel.sendToQueue('video.processing.download', Buffer.from(JSON.stringify(testJob)))
    console.log('✅ Sent test job to download queue:', testJob.id)
    
    // Listen for updates
    await channel.consume('video.processing.updates', (msg) => {
      if (msg) {
        const update = JSON.parse(msg.content.toString())
        console.log('📊 Received update:', update)
        channel.ack(msg)
      }
    })
    
    console.log('👂 Listening for updates...')
    
    // Keep running for a bit to see updates
    setTimeout(async () => {
      await connection.close()
      console.log('✅ Test completed')
      process.exit(0)
    }, 30000) // Run for 30 seconds
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

testStagedProcessing() 