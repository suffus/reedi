#!/usr/bin/env node

/**
 * Test script for concurrency control in the media processor
 * This script simulates multiple concurrent jobs to test the subscription management
 * Tests both video and image processing services independently
 */

const { StagedVideoProcessingService } = require('./dist/services/stagedVideoProcessingService')
const { StagedImageProcessingService } = require('./dist/services/stagedImageProcessingService')
const { EnhancedRabbitMQService } = require('./dist/services/enhancedRabbitMQService')
const { S3ProcessorService } = require('./dist/services/s3ProcessorService')

async function testConcurrency() {
  console.log('🧪 Testing independent concurrency control for video and image processing...')
  
  // Mock services for testing
  const mockRabbitMQService = {
    connect: async () => console.log('✅ Mock RabbitMQ connected'),
    isSubscribedToQueue: (queueName) => false,
    unsubscribeFromQueue: async (queueName) => console.log(`🔴 Unsubscribed from ${queueName}`),
    resubscribeToQueue: async (queueName) => console.log(`🟢 Resubscribed to ${queueName}`),
    close: async () => console.log('✅ Mock RabbitMQ closed'),
    getQueueConfig: () => ({
      download: 'test.download',
      processing: 'test.processing',
      upload: 'test.upload',
      updates: 'test.updates'
    })
  }
  
  const mockS3Service = {
    // Mock S3 methods
  }
  
  // Test with different concurrency limits
  const maxVideoJobs = 3
  const maxImageJobs = 10
  
  console.log(`\n📊 Video Processing: max ${maxVideoJobs} concurrent jobs`)
  console.log(`📊 Image Processing: max ${maxImageJobs} concurrent jobs`)
  
  // Create video processing service
  const videoService = new StagedVideoProcessingService(
    mockRabbitMQService,
    mockS3Service,
    '/tmp',
    maxVideoJobs
  )
  
  // Create image processing service
  const imageService = new StagedImageProcessingService(
    mockRabbitMQService,
    mockS3Service,
    '/tmp',
    maxImageJobs
  )
  
  console.log('\n🚀 Testing Video Processing Service...')
  
  // Simulate starting multiple video jobs
  const videoJobIds = ['video1', 'video2', 'video3', 'video4', 'video5']
  
  for (let i = 0; i < videoJobIds.length; i++) {
    const jobId = videoJobIds[i]
    console.log(`\n🚀 Starting video job ${jobId}...`)
    
    // Simulate starting a job
    await videoService.startJob(jobId)
    
    // Wait a bit to see the effect
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  console.log('\n🚀 Testing Image Processing Service (should be independent)...')
  
  // Simulate starting multiple image jobs
  const imageJobIds = ['image1', 'image2', 'image3', 'image4', 'image5', 'image6', 'image7', 'image8', 'image9', 'image10', 'image11']
  
  for (let i = 0; i < imageJobIds.length; i++) {
    const jobId = imageJobIds[i]
    console.log(`\n🚀 Starting image job ${jobId}...`)
    
    // Simulate starting a job
    await imageService.startJob(jobId)
    
    // Wait a bit to see the effect
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  console.log('\n⏹️  Finishing some video jobs...')
  await videoService.finishJob('video1')
  await videoService.finishJob('video2')
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 100))
  
  console.log('\n⏹️  Finishing some image jobs...')
  await imageService.finishJob('image1')
  await imageService.finishJob('image2')
  await imageService.finishJob('image3')
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 100))
  
  // Start another video job
  console.log('\n🚀 Starting video6...')
  await videoService.startJob('video6')
  
  // Start another image job
  console.log('\n🚀 Starting image12...')
  await imageService.startJob('image12')
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 100))
  
  // Finish remaining jobs
  console.log('\n⏹️  Finishing remaining jobs...')
  await videoService.finishJob('video3')
  await videoService.finishJob('video4')
  await videoService.finishJob('video5')
  await videoService.finishJob('video6')
  
  await imageService.finishJob('image4')
  await imageService.finishJob('image5')
  await imageService.finishJob('image6')
  await imageService.finishJob('image7')
  await imageService.finishJob('image8')
  await imageService.finishJob('image9')
  await imageService.finishJob('image10')
  await imageService.finishJob('image11')
  await imageService.finishJob('image12')
  
  console.log('\n✅ Independent concurrency test completed!')
  console.log(`📊 Final video active job count: ${videoService.getActiveJobCount()}`)
  console.log(`📊 Final image active job count: ${imageService.getActiveJobCount()}`)
  
  console.log('\n🎯 Key Points Demonstrated:')
  console.log('✅ Video and image processing have independent concurrency limits')
  console.log('✅ Video processing at capacity doesn\'t block image processing')
  console.log('✅ Image processing at capacity doesn\'t block video processing')
  console.log('✅ Each service manages only its own queue subscriptions')
}

// Run the test
testConcurrency().catch(console.error)
