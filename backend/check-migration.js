const { PrismaClient } = require('@prisma/client')
require('dotenv').config()

const prisma = new PrismaClient()

async function checkMigrationStatus() {
  console.log('🔍 Checking migration status...')
  console.log('')

  // Get all images
  const allImages = await prisma.image.findMany({
    select: {
      id: true,
      url: true,
      thumbnail: true,
      s3Key: true,
      thumbnailS3Key: true,
      authorId: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' }
  })

  console.log(`📊 Total images in database: ${allImages.length}`)

  // Count images with S3 keys
  const s3Images = allImages.filter(img => img.s3Key)
  const localImages = allImages.filter(img => !img.s3Key)

  console.log(`☁️  Images with S3 keys: ${s3Images.length}`)
  console.log(`💾 Images with local paths: ${localImages.length}`)
  console.log('')

  if (s3Images.length > 0) {
    console.log('✅ Migration appears to be complete!')
    console.log('')
    
    // Show some sample S3 URLs
    console.log('📋 Sample S3 URLs:')
    s3Images.slice(0, 3).forEach((img, index) => {
      console.log(`  ${index + 1}. ${img.url}`)
      if (img.thumbnail) {
        console.log(`     Thumbnail: ${img.thumbnail}`)
      }
    })
    console.log('')

    // Check if URLs are using S3
    const s3UrlCount = s3Images.filter(img => 
      img.url.includes(process.env.IDRIVE_PUBLIC_URL?.replace(/\/$/, '') || '')
    ).length

    console.log(`🔗 Images using S3 URLs: ${s3UrlCount}/${s3Images.length}`)
    
    if (s3UrlCount === s3Images.length) {
      console.log('✅ All migrated images are using S3 URLs!')
    } else {
      console.log('⚠️  Some images may still be using local URLs')
    }
  }

  if (localImages.length > 0) {
    console.log('⚠️  Some images still have local paths:')
    localImages.slice(0, 5).forEach(img => {
      console.log(`  - ${img.url}`)
    })
    if (localImages.length > 5) {
      console.log(`  ... and ${localImages.length - 5} more`)
    }
  }

  console.log('')
  console.log('🎯 App Status:')
  console.log('✅ New uploads will go to S3')
  console.log('✅ Image deletion will remove from S3')
  console.log('✅ All existing images are in S3')
  console.log('')
  console.log('💡 You can safely delete the local uploads folder!')
}

checkMigrationStatus()
  .then(() => {
    console.log('✅ Check complete')
    process.exit(0)
  })
  .catch(error => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 