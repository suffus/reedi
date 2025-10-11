import { testPrisma } from '../test-database.config'
import { TestUser } from './users'

export async function seedGalleries(users: TestUser[]) {
  console.log('🌱 Seeding galleries...')
  
  if (users.length < 3) {
    console.log('⚠️  Not enough users for gallery seeding')
    return
  }
  
  const alice = users[0]
  const bob = users[1]
  const charlie = users[2]
  
  // Get Alice's media
  const aliceMedia = await testPrisma.media.findMany({
    where: { authorId: alice.id },
    orderBy: { createdAt: 'asc' }
  })
  
  // Get Bob's media
  const bobMedia = await testPrisma.media.findMany({
    where: { authorId: bob.id },
    orderBy: { createdAt: 'asc' }
  })
  
  // Get Charlie's media
  const charlieMedia = await testPrisma.media.findMany({
    where: { authorId: charlie.id },
    orderBy: { createdAt: 'asc' }
  })
  
  // Alice's Gallery 1: Vacation Photos (PUBLIC)
  if (aliceMedia.length >= 2) {
    const vacationGallery = await testPrisma.gallery.create({
      data: {
        name: 'Summer Vacation 2024',
        description: 'Our amazing summer vacation at the beach',
        visibility: 'PUBLIC',
        authorId: alice.id,
        coverMediaId: aliceMedia[0].id // vacation photo
      }
    })
    
    // Add vacation and birthday media to this gallery
    await testPrisma.media.update({
      where: { id: aliceMedia[0].id },
      data: { galleryId: vacationGallery.id, order: 0 }
    })
    
    if (aliceMedia.length >= 3) {
      await testPrisma.media.update({
        where: { id: aliceMedia[2].id }, // birthday video
        data: { galleryId: vacationGallery.id, order: 1 }
      })
    }
    
    console.log(`  ✅ Created "${vacationGallery.name}" gallery for Alice (PUBLIC, 2 items)`)
  }
  
  // Alice's Gallery 2: Family Moments (FRIENDS_ONLY)
  if (aliceMedia.length >= 2) {
    const familyGallery = await testPrisma.gallery.create({
      data: {
        name: 'Family Moments',
        description: 'Special moments with my family',
        visibility: 'FRIENDS_ONLY',
        authorId: alice.id,
        coverMediaId: aliceMedia[1].id // family dinner
      }
    })
    
    // Add family photo to this gallery
    await testPrisma.media.update({
      where: { id: aliceMedia[1].id },
      data: { galleryId: familyGallery.id, order: 0 }
    })
    
    console.log(`  ✅ Created "${familyGallery.name}" gallery for Alice (FRIENDS_ONLY, 1 item)`)
  }
  
  // Alice's private photo stays unorganized (not in any gallery)
  
  // Bob's Gallery: Work & Tech (PUBLIC)
  if (bobMedia.length >= 2) {
    const workGallery = await testPrisma.gallery.create({
      data: {
        name: 'Work & Tech',
        description: 'My workspace and coding tutorials',
        visibility: 'PUBLIC',
        authorId: bob.id,
        coverMediaId: bobMedia[0].id // office view
      }
    })
    
    // Add office and tutorial to this gallery
    await testPrisma.media.update({
      where: { id: bobMedia[0].id },
      data: { galleryId: workGallery.id, order: 0 }
    })
    
    await testPrisma.media.update({
      where: { id: bobMedia[1].id }, // coding tutorial
      data: { galleryId: workGallery.id, order: 1 }
    })
    
    console.log(`  ✅ Created "${workGallery.name}" gallery for Bob (PUBLIC, 2 items)`)
  }
  
  // Bob's pending image stays unorganized
  
  // Charlie's Gallery 1: Photography Portfolio (PUBLIC)
  if (charlieMedia.length >= 2) {
    const portfolioGallery = await testPrisma.gallery.create({
      data: {
        name: 'Photography Portfolio',
        description: 'My best photography work',
        visibility: 'PUBLIC',
        authorId: charlie.id,
        coverMediaId: charlieMedia[1].id // landscape
      }
    })
    
    // Add landscape and portrait to portfolio
    await testPrisma.media.update({
      where: { id: charlieMedia[1].id },
      data: { galleryId: portfolioGallery.id, order: 0 }
    })
    
    await testPrisma.media.update({
      where: { id: charlieMedia[2].id }, // portrait
      data: { galleryId: portfolioGallery.id, order: 1 }
    })
    
    console.log(`  ✅ Created "${portfolioGallery.name}" gallery for Charlie (PUBLIC, 2 items)`)
  }
  
  // Charlie's Gallery 2: Vlogs (PUBLIC)
  if (charlieMedia.length >= 1) {
    const vlogGallery = await testPrisma.gallery.create({
      data: {
        name: 'Daily Vlogs',
        description: 'Daily life vlogs and behind the scenes',
        visibility: 'PUBLIC',
        authorId: charlie.id,
        coverMediaId: charlieMedia[0].id // daily vlog
      }
    })
    
    // Add vlog to this gallery
    await testPrisma.media.update({
      where: { id: charlieMedia[0].id },
      data: { galleryId: vlogGallery.id, order: 0 }
    })
    
    console.log(`  ✅ Created "${vlogGallery.name}" gallery for Charlie (PUBLIC, 1 item)`)
  }
  
  // Charlie's failed video stays unorganized
  
  console.log('✅ Created 5 galleries total')
}

export async function seedExtendedGalleries(users: TestUser[]) {
  if (users.length < 10) {
    console.log('⚠️  Not enough users for extended gallery seeding')
    return
  }
  
  console.log('🌱 Seeding extended galleries...')
  
  let galleriesCreated = 0
  
  // Create galleries for extended users (5-9)
  for (let i = 5; i < 10; i++) {
    const user = users[i]
    
    // Get user's media
    const userMedia = await testPrisma.media.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: 'asc' }
    })
    
    if (userMedia.length > 0) {
      const gallery = await testPrisma.gallery.create({
        data: {
          name: `${user.name}'s Collection`,
          description: `Personal collection by ${user.name}`,
          visibility: i % 2 === 0 ? 'PUBLIC' : 'PRIVATE', // Alternate visibility
          authorId: user.id,
          coverMediaId: userMedia[0].id
        }
      })
      
      // Add all user's media to their gallery
      for (let j = 0; j < userMedia.length; j++) {
        await testPrisma.media.update({
          where: { id: userMedia[j].id },
          data: { galleryId: gallery.id, order: j }
        })
      }
      
      galleriesCreated++
    }
  }
  
  console.log(`✅ Created ${galleriesCreated} extended galleries`)
}

