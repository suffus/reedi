require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const sharp = require('sharp')
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')

const prisma = new PrismaClient()

// S3 Client configuration for IDrive
const s3Client = new S3Client({
  region: process.env.IDRIVE_REGION || 'us-east-1',
  endpoint: process.env.IDRIVE_ENDPOINT,
  credentials: {
    accessKeyId: process.env.IDRIVE_ACCESS_KEY_ID,
    secretAccessKey: process.env.IDRIVE_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true, // Required for S3-compatible services
})

const BUCKET_NAME = process.env.IDRIVE_BUCKET_NAME

/**
 * Get image from S3 and return as buffer
 */
async function getImageFromS3(key) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })

  const response = await s3Client.send(command)
  
  if (!response.Body) {
    throw new Error('No image data received from S3')
  }

  // Convert stream to buffer
  const chunks = []
  for await (const chunk of response.Body) {
    chunks.push(Buffer.from(chunk))
  }
  
  return Buffer.concat(chunks)
}

/**
 * Upload image to S3
 */
async function uploadImageToS3(buffer, key, mimeType, metadata = {}) {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    Metadata: metadata,
    ACL: 'public-read', // Make objects publicly readable
  })

  await s3Client.send(command)
  
  // Return the S3 key (not URL) - URLs will be generated on-demand
  return key
}

/**
 * Delete image from S3
 */
async function deleteImageFromS3(key) {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })

  await s3Client.send(command)
}

/**
 * Convert a single image to progressive JPEG
 */
async function convertImageToProgressive(image) {
  try {
    console.log(`Processing image ${image.id}...`)
    
    // Get the original image from S3
    const originalBuffer = await getImageFromS3(image.s3Key)
    
    // Convert to progressive JPEG
    const progressiveBuffer = await sharp(originalBuffer)
      .jpeg({ 
        quality: 85,
        progressive: true,
        mozjpeg: true
      })
      .toBuffer()
    
    // Create new S3 key for progressive version
    const originalKey = image.s3Key
    const progressiveKey = originalKey.replace(/\.(jpg|jpeg)$/i, '_progressive.jpg')
    
    // Upload progressive version
    await uploadImageToS3(
      progressiveBuffer,
      progressiveKey,
      'image/jpeg',
      { 
        originalName: image.altText || 'converted_image',
        converted: 'true',
        originalKey: originalKey
      }
    )
    
    // Update database with new progressive key
    await prisma.image.update({
      where: { id: image.id },
      data: { 
        s3Key: progressiveKey,
        // Keep original key as backup in a custom field if needed
      }
    })
    
    console.log(`✓ Converted image ${image.id} to progressive JPEG`)
    console.log(`  Original: ${originalKey}`)
    console.log(`  Progressive: ${progressiveKey}`)
    console.log(`  Size reduction: ${originalBuffer.length} -> ${progressiveBuffer.length} bytes`)
    
    return {
      success: true,
      originalSize: originalBuffer.length,
      progressiveSize: progressiveBuffer.length,
      originalKey,
      progressiveKey
    }
    
  } catch (error) {
    console.error(`✗ Failed to convert image ${image.id}:`, error.message)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Batch convert all images to progressive JPEG
 */
async function batchConvertToProgressive() {
  console.log('Starting batch conversion to progressive JPEG...')
  
  try {
    // Get all images that need conversion
    const images = await prisma.image.findMany({
      where: {
        s3Key: {
          not: {
            contains: '_progressive'
          }
        }
      },
      select: {
        id: true,
        s3Key: true,
        thumbnailS3Key: true,
        altText: true,
        mimeType: true
      }
    })
    
    console.log(`Found ${images.length} images to convert`)
    
    if (images.length === 0) {
      console.log('No images need conversion. All images are already progressive!')
      return
    }
    
    const results = {
      total: images.length,
      successful: 0,
      failed: 0,
      totalOriginalSize: 0,
      totalProgressiveSize: 0,
      errors: []
    }
    
    // Process images in batches to avoid memory issues
    const batchSize = 10
    for (let i = 0; i < images.length; i += batchSize) {
      const batch = images.slice(i, i + batchSize)
      console.log(`\nProcessing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(images.length / batchSize)}`)
      
      const batchPromises = batch.map(image => convertImageToProgressive(image))
      const batchResults = await Promise.all(batchPromises)
      
      // Aggregate results
      batchResults.forEach(result => {
        if (result.success) {
          results.successful++
          results.totalOriginalSize += result.originalSize
          results.totalProgressiveSize += result.progressiveSize
        } else {
          results.failed++
          results.errors.push(result.error)
        }
      })
      
      // Small delay between batches to be nice to the system
      if (i + batchSize < images.length) {
        console.log('Waiting 2 seconds before next batch...')
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
    
    // Print final results
    console.log('\n' + '='.repeat(50))
    console.log('BATCH CONVERSION COMPLETE')
    console.log('='.repeat(50))
    console.log(`Total images processed: ${results.total}`)
    console.log(`Successful conversions: ${results.successful}`)
    console.log(`Failed conversions: ${results.failed}`)
    console.log(`Total original size: ${(results.totalOriginalSize / 1024 / 1024).toFixed(2)} MB`)
    console.log(`Total progressive size: ${(results.totalProgressiveSize / 1024 / 1024).toFixed(2)} MB`)
    console.log(`Size change: ${((results.totalProgressiveSize - results.totalOriginalSize) / results.totalOriginalSize * 100).toFixed(2)}%`)
    
    if (results.errors.length > 0) {
      console.log('\nErrors encountered:')
      results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`)
      })
    }
    
  } catch (error) {
    console.error('Batch conversion failed:', error)
    throw error
  }
}

/**
 * Cleanup function to remove original images after successful conversion
 * WARNING: This will permanently delete original images!
 */
async function cleanupOriginalImages() {
  console.log('\nWARNING: This will permanently delete original images!')
  console.log('Make sure you have backups before proceeding.')
  
  const shouldProceed = process.argv.includes('--cleanup')
  if (!shouldProceed) {
    console.log('To cleanup original images, run with --cleanup flag')
    return
  }
  
  try {
    // Find all progressive images
    const progressiveImages = await prisma.image.findMany({
      where: {
        s3Key: {
          contains: '_progressive'
        }
      },
      select: {
        id: true,
        s3Key: true
      }
    })
    
    console.log(`Found ${progressiveImages.length} progressive images`)
    
    for (const image of progressiveImages) {
      const originalKey = image.s3Key.replace('_progressive.jpg', '.jpg')
      
      try {
        // Delete original image from S3
        await deleteImageFromS3(originalKey)
        console.log(`✓ Deleted original: ${originalKey}`)
      } catch (error) {
        console.log(`- Original not found or already deleted: ${originalKey}`)
      }
    }
    
    console.log('Cleanup completed!')
    
  } catch (error) {
    console.error('Cleanup failed:', error)
  }
}

// Main execution
async function main() {
  try {
    await batchConvertToProgressive()
    await cleanupOriginalImages()
  } catch (error) {
    console.error('Script failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
if (require.main === module) {
  main()
}

module.exports = {
  convertImageToProgressive,
  batchConvertToProgressive,
  cleanupOriginalImages
} 