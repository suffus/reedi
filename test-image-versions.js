const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkImageVersions() {
  try {
    const media = await prisma.media.findUnique({
      where: { id: 'cmdznlvfw007j1490lnty78a7' },
      select: {
        id: true,
        mediaType: true,
        processingStatus: true,
        imageProcessingStatus: true,
        imageVersions: true,
        imageMetadata: true,
        s3Key: true
      }
    })

    console.log('Media record:')
    console.log(JSON.stringify(media, null, 2))

    if (media.imageVersions) {
      console.log('\nImage versions type:', typeof media.imageVersions)
      console.log('Image versions:', media.imageVersions)
      
      if (Array.isArray(media.imageVersions)) {
        console.log('\nParsed as array with', media.imageVersions.length, 'versions')
        media.imageVersions.forEach((version, index) => {
          console.log(`Version ${index}:`, version)
        })
      }
    }

    if (media.imageMetadata) {
      console.log('\nImage metadata type:', typeof media.imageMetadata)
      console.log('Image metadata:', media.imageMetadata)
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkImageVersions() 