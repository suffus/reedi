const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkGalleryMedia() {
  try {
    console.log('Checking gallery media relationships...')
    
    // Check total media count
    const totalMedia = await prisma.media.count()
    console.log(`Total media items: ${totalMedia}`)
    
    // Check media with galleryId
    const mediaWithGallery = await prisma.media.count({
      where: {
        galleryId: {
          not: null
        }
      }
    })
    console.log(`Media items with galleryId: ${mediaWithGallery}`)
    
    // Check galleries
    const galleries = await prisma.gallery.findMany({
      include: {
        _count: {
          select: {
            media: true
          }
        }
      }
    })
    console.log(`Total galleries: ${galleries.length}`)
    
    galleries.forEach(gallery => {
      console.log(`Gallery "${gallery.name}" (${gallery.id}): ${gallery._count.media} media items`)
    })
    
    // Show some sample media with galleryId
    const sampleMedia = await prisma.media.findMany({
      where: {
        galleryId: {
          not: null
        }
      },
      include: {
        gallery: {
          select: {
            name: true
          }
        }
      },
      take: 5
    })
    
    console.log('\nSample media with galleryId:')
    sampleMedia.forEach(media => {
      console.log(`- ${media.originalFilename || media.id} -> Gallery: ${media.gallery?.name || 'Unknown'}`)
    })
    
  } catch (error) {
    console.error('Error checking gallery media:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkGalleryMedia() 