#!/usr/bin/env node

const amqp = require('amqplib')

async function testProgressUpdate() {
  try {
    // Connect to RabbitMQ with credentials
    const connection = await amqp.connect('amqp://reedi:El1xirOfL1f3@localhost:5672')
    const channel = await connection.createChannel()
    
    // Declare the updates queue
    await channel.assertQueue('video.processing.updates', { durable: true })
    
    console.log('✅ Connected to RabbitMQ')
    
    // Create a test completion update
    const testUpdate = {
      type: 'video_processing_update',
      job_id: 'test-job-' + Date.now(),
      media_id: 'test-media-' + Date.now(),
      status: 'completed',
      progress: 100,
      current_step: 'upload_complete',
      thumbnails: [
        {
          s3_key: 'thumbnails/test-thumbnail.jpg',
          timestamp: new Date().toISOString(),
          width: 320,
          height: 240
        }
      ],
      video_versions: [
        {
          quality: '360p',
          s3_key: 'videos/test-video_360p.mp4',
          width: 640,
          height: 360,
          file_size: 1024000
        },
        {
          quality: '720p',
          s3_key: 'videos/test-video_720p.mp4',
          width: 1280,
          height: 720,
          file_size: 2048000
        }
      ],
      metadata: {
        duration: 120,
        resolution: '1280x720',
        codec: 'h264',
        bitrate: 2500000,
        framerate: 30
      },
      timestamp: new Date().toISOString()
    }
    
    // Send to updates queue
    await channel.sendToQueue('video.processing.updates', Buffer.from(JSON.stringify(testUpdate)))
    console.log('✅ Sent test completion update:', testUpdate.job_id)
    
    // Keep running for a bit to see if backend processes it
    setTimeout(async () => {
      await connection.close()
      console.log('✅ Test completed')
      process.exit(0)
    }, 10000) // Run for 10 seconds
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

testProgressUpdate() 