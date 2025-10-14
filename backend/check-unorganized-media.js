const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:te1twe5tX1966@localhost:5432/reeditestdb'
    }
  }
})

async function main() {
  // Find Alice
  const alice = await prisma.user.findUnique({
    where: { email: 'alice@test.com' }
  })
  
  if (!alice) {
    console.log('Alice not found')
    return
  }
  
  console.log('Alice ID:', alice.id)
  
  // Get all Alice's media
  const allMedia = await prisma.media.findMany({
    where: { authorId: alice.id },
    select: {
      id: true,
      originalFilename: true,
      galleryId: true
    }
  })
  
  console.log('\nAlice\'s media:')
  allMedia.forEach(m => {
    console.log(`  - ${m.originalFilename}: galleryId=${m.galleryId}`)
  })
  
  // Check gallery_media junction table
  console.log('\nChecking gallery_media junction table:')
  const galleryMedia = await prisma.galleryMedia.findMany({
    where: {
      media: { authorId: alice.id }
    },
    include: {
      media: { select: { originalFilename: true } },
      gallery: { select: { title: true } }
    }
  })
  
  console.log(`Found ${galleryMedia.length} gallery_media entries for Alice's media`)
  galleryMedia.forEach(gm => {
    console.log(`  - ${gm.media.originalFilename} in gallery "${gm.gallery.title}"`)
  })
  
  // Find unorganized media (not in any gallery)
  const mediaIds = allMedia.map(m => m.id)
  const organizedMediaIds = galleryMedia.map(gm => gm.mediaId)
  const unorganizedMediaIds = mediaIds.filter(id => !organizedMediaIds.includes(id))
  
  console.log(`\nUnorganized media (${unorganizedMediaIds.length}):`)
  allMedia
    .filter(m => unorganizedMediaIds.includes(m.id))
    .forEach(m => {
      console.log(`  - ${m.originalFilename} (${m.id})`)
    })
  
  await prisma.$disconnect()
}

main().catch(console.error)
