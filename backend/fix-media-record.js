const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function fixMediaRecord() {
  const mediaId = 'cmdzbbpae000113y1pb5noqqw'
  
  try {
    // Update the media record with the processed information
    const updatedMedia = await prisma.media.update({
      where: { id: mediaId },
      data: {
        imageProcessingStatus: 'COMPLETED',
        thumbnail: 'processed/images/cmdzbbpae000113y1pb5noqqw/thumbnail.jpg',
        thumbnailS3Key: 'processed/images/cmdzbbpae000113y1pb5noqqw/thumbnail.jpg',
        url: 'processed/images/cmdzbbpae000113y1pb5noqqw/1080p.jpg',
        width: 1080,
        height: 1618,
        size: 314773,
        imageVersions: JSON.stringify([
          {
            s3Key: "processed/images/cmdzbbpae000113y1pb5noqqw/thumbnail.jpg",
            quality: "thumbnail",
            width: 300,
            height: 300,
            fileSize: 9565,
            mimeType: "image/jpeg"
          },
          {
            s3Key: "processed/images/cmdzbbpae000113y1pb5noqqw/180p.jpg",
            quality: "180p",
            width: 180,
            height: 270,
            fileSize: 8399,
            mimeType: "image/jpeg"
          },
          {
            s3Key: "processed/images/cmdzbbpae000113y1pb5noqqw/360p.jpg",
            quality: "360p",
            width: 360,
            height: 539,
            fileSize: 24258,
            mimeType: "image/jpeg"
          },
          {
            s3Key: "processed/images/cmdzbbpae000113y1pb5noqqw/720p.jpg",
            quality: "720p",
            width: 720,
            height: 1079,
            fileSize: 99534,
            mimeType: "image/jpeg"
          },
          {
            s3Key: "processed/images/cmdzbbpae000113y1pb5noqqw/1080p.jpg",
            quality: "1080p",
            width: 1080,
            height: 1618,
            fileSize: 314773,
            mimeType: "image/jpeg"
          }
        ]),
        imageMetadata: JSON.stringify({
          width: 4912,
          height: 7360,
          fileSize: 6673914,
          mimeType: "image/jpeg",
          format: "jpeg",
          colorSpace: "srgb",
          hasAlpha: false
        })
      }
    })
    
    console.log('Media record updated successfully:', updatedMedia.id)
    
  } catch (error) {
    console.error('Error updating media record:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixMediaRecord() 