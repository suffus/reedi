require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const amqp = require('amqplib')

const prisma = new PrismaClient()

// RabbitMQ configuration
const RABBITMQ_URL = process.env['RABBITMQ_URL'] || `amqp://${process.env['RABBITMQ_USER'] || 'guest'}:${process.env['RABBITMQ_PASSWORD'] || 'guest'}@localhost:${process.env['RABBITMQ_PORT'] || '5672'}`
const QUEUE_NAME = 'media.images.processing.download'

async function reprocessImages(limit = 10) {
  let connection, channel
  try {
    console.log(`🔍 Finding unprocessed images (limit: ${limit})...`)
    
    // Find images that need processing
    const unprocessedImages = await prisma.media.findMany({
      where: {
        mediaType: 'IMAGE',
        AND: [
          {
            OR: [
              { imageProcessingStatus: null },
              { imageProcessingStatus: 'PENDING' },
              { imageProcessingStatus: 'FAILED' }
            ]
          },
          {
            s3Key: { not: null } // Make sure we have the original file
          }
        ]
      },
      select: {
        id: true,
        s3Key: true,
        originalFilename: true,
        mimeType: true,
        authorId: true,
        imageProcessingStatus: true
      },
      take: limit,
      orderBy: {
        createdAt: 'asc' // Process oldest first
      }
    })

    console.log(`📊 Found ${unprocessedImages.length} unprocessed images`)

    if (unprocessedImages.length === 0) {
      console.log('✅ No unprocessed images found!')
      return
    }

    // Connect to RabbitMQ
    try {
      connection = await amqp.connect(RABBITMQ_URL)
      channel = await connection.createChannel()
      await channel.assertQueue(QUEUE_NAME, { durable: true })
      console.log('🔗 Connected to RabbitMQ')
    } catch (error) {
      console.error('❌ Failed to connect to RabbitMQ:', error.message)
      return
    }

    let processedCount = 0
    let failedCount = 0

    for (const image of unprocessedImages) {
      try {
        console.log(`🔄 Processing image ${image.id} (${image.originalFilename || 'unnamed'})...`)
        
        // Update status to PENDING
        await prisma.media.update({
          where: { id: image.id },
          data: { imageProcessingStatus: 'PENDING' }
        })

        // Create processing job in database
        const jobId = `reprocess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        
        await prisma.mediaProcessingJob.create({
          data: {
            id: jobId,
            mediaId: image.id,
            userId: image.authorId,
            mediaType: 'IMAGE',
            s3Key: image.s3Key,
            originalFilename: image.originalFilename,
            status: 'PENDING',
            progress: 0,
            currentStep: 'queued'
          }
        })

        // Send to processing queue
        const jobData = {
          type: 'image_processing_request',
          job_id: jobId,
          media_id: image.id,
          user_id: image.authorId,
          s3_key: image.s3Key,
          original_filename: image.originalFilename,
          request_progress_updates: true,
          progress_interval: 10,
          timestamp: new Date().toISOString()
        }

        channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(jobData)))
        
        console.log(`✅ Queued image ${image.id} for processing`)
        processedCount++
        
        // Small delay to avoid overwhelming the queue
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        console.error(`❌ Failed to queue image ${image.id}:`, error.message)
        failedCount++
        
        // Update status back to FAILED
        await prisma.media.update({
          where: { id: image.id },
          data: { imageProcessingStatus: 'FAILED' }
        })
        
        // Clean up the job record if it was created
        try {
          await prisma.mediaProcessingJob.deleteMany({
            where: { 
              mediaId: image.id,
              status: 'PENDING'
            }
          })
        } catch (cleanupError) {
          console.error(`⚠️ Failed to cleanup job record for ${image.id}:`, cleanupError.message)
        }
      }
    }

    console.log('\n📈 Processing Summary:')
    console.log(`✅ Successfully queued: ${processedCount} images`)
    console.log(`❌ Failed to queue: ${failedCount} images`)
    console.log(`📊 Total processed: ${processedCount + failedCount} images`)

  } catch (error) {
    console.error('❌ Script failed:', error)
  } finally {
    if (connection) {
      await connection.close()
    }
    await prisma.$disconnect()
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
let limit = 10 // Default to 10

if (args.length > 0) {
  const parsedLimit = parseInt(args[0])
  if (!isNaN(parsedLimit) && parsedLimit > 0) {
    limit = parsedLimit
  } else {
    console.error('❌ Invalid limit. Please provide a positive number.')
    process.exit(1)
  }
}

console.log(`🚀 Starting image reprocessing script...`)
console.log(`📋 Configuration:`)
console.log(`   - Limit: ${limit} images`)
console.log(`   - RabbitMQ URL: ${process.env['RABBITMQ_URL'] || 'amqp://localhost:5672'}`)
console.log(`   - Database: ${process.env['DATABASE_URL'] ? 'Connected' : 'Not configured'}`)
console.log('')

// Run the script
reprocessImages(limit) 
