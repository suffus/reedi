require('dotenv').config()
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkImageStatus() {
  try {
    console.log('🔍 Checking image processing status...\n')

    // Get counts for each status
    const statusCounts = await prisma.media.groupBy({
      by: ['imageProcessingStatus'],
      where: {
        mediaType: 'IMAGE',
        s3Key: { not: null }
      },
      _count: {
        id: true
      }
    })

    console.log('📊 Image Processing Status Summary:')
    console.log('=====================================')
    
    let totalImages = 0
    for (const status of statusCounts) {
      const count = status._count.id
      const statusName = status.imageProcessingStatus || 'NULL'
      console.log(`${statusName.padEnd(15)}: ${count} images`)
      totalImages += count
    }
    
    console.log('=====================================')
    console.log(`Total Images: ${totalImages}`)

    // Show some examples of each status
    console.log('\n📋 Sample Images by Status:')
    console.log('============================')

    for (const status of statusCounts) {
      const statusName = status.imageProcessingStatus || 'NULL'
      console.log(`\n${statusName}:`)
      
      const samples = await prisma.media.findMany({
        where: {
          mediaType: 'IMAGE',
          imageProcessingStatus: status.imageProcessingStatus,
          s3Key: { not: null }
        },
        select: {
          id: true,
          originalFilename: true,
          createdAt: true,
          imageProcessingStatus: true
        },
        take: 5,
        orderBy: {
          createdAt: 'desc'
        }
      })

      if (samples.length === 0) {
        console.log('  No images found')
      } else {
        samples.forEach(img => {
          const filename = img.originalFilename || 'unnamed'
          const date = new Date(img.createdAt).toLocaleDateString()
          console.log(`  - ${img.id} (${filename}) - ${date}`)
        })
      }
    }

    // Check for images with imageVersions
    console.log('\n🔍 Images with processed versions:')
    const processedImages = await prisma.media.findMany({
      where: {
        mediaType: 'IMAGE',
        imageVersions: { not: null },
        s3Key: { not: null }
      },
      select: {
        id: true,
        originalFilename: true,
        imageProcessingStatus: true,
        imageVersions: true
      },
      take: 10,
      orderBy: {
        updatedAt: 'desc'
      }
    })

    console.log(`Found ${processedImages.length} images with processed versions:`)
    processedImages.forEach(img => {
      const filename = img.originalFilename || 'unnamed'
      const versions = typeof img.imageVersions === 'string' 
        ? JSON.parse(img.imageVersions) 
        : img.imageVersions
      const qualityCount = Array.isArray(versions) ? versions.length : 0
      console.log(`  - ${img.id} (${filename}) - ${img.imageProcessingStatus} - ${qualityCount} versions`)
    })

  } catch (error) {
    console.error('❌ Script failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

console.log('🚀 Starting image status check...')
console.log(`📋 Configuration:`)
console.log(`   - Database: ${process.env['DATABASE_URL'] ? 'Connected' : 'Not configured'}`)
console.log('')

checkImageStatus() 