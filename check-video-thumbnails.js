const { PrismaClient } = require('@prisma/client')

async function checkVideoThumbnails() {
  const prisma = new PrismaClient()
  
  try {
    // Get a video record to see the structure
    const video = await prisma.media.findFirst({
      where: {
        mediaType: 'VIDEO',
        processingStatus: 'COMPLETED'
      },
      select: {
        id: true,
        originalFilename: true,
        processingStatus: true,
        thumbnailS3Key: true,
        thumbnails: true,
        metadata: true
      }
    })
    
    if (video) {
      console.log('Video record found:')
      console.log('ID:', video.id)
      console.log('Filename:', video.originalFilename)
      console.log('Processing Status:', video.processingStatus)
      console.log('ThumbnailS3Key:', video.thumbnailS3Key)
      console.log('Thumbnails field:', JSON.stringify(video.thumbnails, null, 2))
      console.log('Metadata field:', JSON.stringify(video.metadata, null, 2))
    } else {
      console.log('No completed video records found')
    }
    
    // Also check how many videos we have
    const videoCounts = await prisma.media.groupBy({
      by: ['mediaType', 'processingStatus'],
      where: {
        mediaType: 'VIDEO'
      },
      _count: {
        id: true
      }
    })
    
    console.log('\nVideo counts by status:')
    videoCounts.forEach(group => {
      console.log(`  ${group.mediaType} - ${group.processingStatus}: ${group._count.id}`)
    })
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkVideoThumbnails()
