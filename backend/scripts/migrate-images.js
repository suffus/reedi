const { PrismaClient } = require('@prisma/client')
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')
const { v4: uuidv4 } = require('uuid')

const prisma = new PrismaClient()

const UPLOADS_DIR = path.join(process.cwd(), 'uploads')
const IMAGES_DIR = path.join(UPLOADS_DIR, 'images')
const THUMBNAILS_DIR = path.join(UPLOADS_DIR, 'thumbnails')

// Ensure directories exist
const ensureDirectories = () => {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true })
  }
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true })
  }
  if (!fs.existsSync(THUMBNAILS_DIR)) {
    fs.mkdirSync(THUMBNAILS_DIR, { recursive: true })
  }
}

// Generate a unique filename
const generateFilename = (originalName = 'migrated-image') => {
  const uniqueId = uuidv4()
  return `migrated_${uniqueId}.jpg`
}

// Process base64 image and save to disk
const processBase64Image = async (base64Data, imageId) => {
  try {
    // Remove data URL prefix if present
    const base64String = base64Data.replace(/^data:image\/[a-z]+;base64,/, '')
    
    // Convert base64 to buffer
    const buffer = Buffer.from(base64String, 'base64')
    
    // Generate filename
    const filename = generateFilename()
    const imagePath = path.join(IMAGES_DIR, filename)
    const thumbnailPath = path.join(THUMBNAILS_DIR, `thumb_${filename}`)
    
    // Get image metadata
    const metadata = await sharp(buffer).metadata()
    const width = metadata.width || 0
    const height = metadata.height || 0
    
    // Save full-size image
    await sharp(buffer)
      .jpeg({ quality: 90 })
      .toFile(imagePath)
    
    // Generate thumbnail (300x300, maintaining aspect ratio)
    await sharp(buffer)
      .resize(300, 300, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 80 })
      .toFile(thumbnailPath)
    
    // Get file sizes
    const imageStats = fs.statSync(imagePath)
    
    return {
      imagePath: `/uploads/images/${filename}`,
      thumbnailPath: `/uploads/thumbnails/thumb_${filename}`,
      width,
      height,
      size: imageStats.size
    }
  } catch (error) {
    console.error(`Error processing image ${imageId}:`, error.message)
    return null
  }
}

// Main migration function
const migrateImages = async () => {
  console.log('Starting image migration...')
  
  try {
    // Ensure directories exist
    ensureDirectories()
    
    // Get all image IDs first (without the large url field)
    const imageIds = await prisma.image.findMany({
      select: { id: true }
    })
    
    console.log(`Found ${imageIds.length} total images`)
    
    let successCount = 0
    let errorCount = 0
    let skippedCount = 0
    
    for (const { id } of imageIds) {
      console.log(`Processing image ${id}...`)
      
      try {
        // Get the full image record one by one
        const image = await prisma.image.findUnique({
          where: { id },
          select: {
            id: true,
            url: true,
            altText: true,
            caption: true,
            tags: true
          }
        })
        
        if (!image) {
          console.log(`❌ Image ${id} not found`)
          errorCount++
          continue
        }
        
        // Check if it's a base64 image
        if (!image.url || !image.url.startsWith('data:image/')) {
          console.log(`⏭️  Image ${id} is already migrated or not base64, skipping`)
          skippedCount++
          continue
        }
        
        // Process the base64 image
        const processedImage = await processBase64Image(image.url, image.id)
        
        if (processedImage) {
          // Update the database record
          await prisma.image.update({
            where: { id: image.id },
            data: {
              url: processedImage.imagePath,
              thumbnail: processedImage.thumbnailPath,
              width: processedImage.width,
              height: processedImage.height,
              size: processedImage.size,
              mimeType: 'image/jpeg'
            }
          })
          
          console.log(`✅ Successfully migrated image ${image.id}`)
          successCount++
        } else {
          console.log(`❌ Failed to process image ${image.id}`)
          errorCount++
        }
      } catch (error) {
        console.error(`❌ Error migrating image ${id}:`, error.message)
        errorCount++
      }
    }
    
    console.log('\n=== Migration Summary ===')
    console.log(`Total images processed: ${imageIds.length}`)
    console.log(`Successfully migrated: ${successCount}`)
    console.log(`Skipped (already migrated): ${skippedCount}`)
    console.log(`Failed: ${errorCount}`)
    console.log('========================\n')
    
  } catch (error) {
    console.error('Migration failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the migration
migrateImages()
  .then(() => {
    console.log('Migration completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Migration failed:', error)
    process.exit(1)
  }) 