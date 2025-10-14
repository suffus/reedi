const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:te1twe5tX1966@localhost:5432/reeditestdb'
    }
  }
})

async function main() {
  const alice = await prisma.user.findUnique({
    where: { email: 'alice@test.com' }
  })
  
  const media = await prisma.media.findMany({
    where: { 
      authorId: alice.id,
      galleryId: null
    },
    select: {
      originalFilename: true,
      visibility: true,
      galleryId: true
    }
  })
  
  console.log('Alice\'s unorganized media:')
  media.forEach(m => {
    console.log(`  - ${m.originalFilename}: visibility=${m.visibility}, galleryId=${m.galleryId}`)
  })
  
  await prisma.$disconnect()
}

main().catch(console.error)
