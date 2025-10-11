import { testPrisma } from '../test-database.config'
import { TestUser } from './users'

export async function seedPosts(users: TestUser[]) {
  console.log('🌱 Seeding posts...')
  
  if (users.length < 4) {
    console.log('⚠️  Not enough users for post seeding')
    return
  }
  
  const alice = users[0]
  const bob = users[1]
  const charlie = users[2]
  const david = users[3]
  // Eve (users[4]) will have NO posts
  
  // Get media for attaching to posts
  const aliceMedia = await testPrisma.media.findMany({
    where: { authorId: alice.id },
    orderBy: { createdAt: 'asc' }
  })
  
  const bobMedia = await testPrisma.media.findMany({
    where: { authorId: bob.id },
    orderBy: { createdAt: 'asc' }
  })
  
  const charlieMedia = await testPrisma.media.findMany({
    where: { authorId: charlie.id },
    orderBy: { createdAt: 'asc' }
  })
  
  let postsCreated = 0
  
  // ALICE'S POSTS (3 posts)
  
  // Alice Post 1: Simple text post (PUBLIC)
  await testPrisma.post.create({
    data: {
      content: 'Just had an amazing day at the beach! The weather was perfect and the sunset was breathtaking. 🌅',
      visibility: 'PUBLIC',
      publicationStatus: 'PUBLIC',
      authorId: alice.id,
      hashtags: {
        connectOrCreate: [
          { where: { name: 'beach' }, create: { name: 'beach' } },
          { where: { name: 'sunset' }, create: { name: 'sunset' } },
          { where: { name: 'vacation' }, create: { name: 'vacation' } }
        ]
      }
    }
  })
  postsCreated++
  
  // Alice Post 2: Post with vacation media (PUBLIC)
  if (aliceMedia.length >= 2) {
    const postWithMedia = await testPrisma.post.create({
      data: {
        title: 'Summer Vacation Highlights',
        content: 'Here are some photos and videos from our amazing summer vacation! Can\'t wait to go back next year.',
        visibility: 'PUBLIC',
        publicationStatus: 'PUBLIC',
        authorId: alice.id,
        hashtags: {
          connectOrCreate: [
            { where: { name: 'travel' }, create: { name: 'travel' } },
            { where: { name: 'vacation' }, create: { name: 'vacation' } }
          ]
        }
      }
    })
    
    // Attach vacation photo and birthday video
    await testPrisma.postMedia.createMany({
      data: [
        { postId: postWithMedia.id, mediaId: aliceMedia[0].id, order: 0, isLocked: false },
        { postId: postWithMedia.id, mediaId: aliceMedia[2].id, order: 1, isLocked: false }
      ]
    })
    
    postsCreated++
  }
  
  // Alice Post 3: Friends-only post with family photo
  if (aliceMedia.length >= 2) {
    const friendsPost = await testPrisma.post.create({
      data: {
        content: 'Family dinner was so special tonight. Grateful for these moments. ❤️',
        visibility: 'FRIENDS_ONLY',
        publicationStatus: 'PUBLIC',
        authorId: alice.id,
        hashtags: {
          connectOrCreate: [
            { where: { name: 'family' }, create: { name: 'family' } }
          ]
        }
      }
    })
    
    await testPrisma.postMedia.create({
      data: { postId: friendsPost.id, mediaId: aliceMedia[1].id, order: 0, isLocked: false }
    })
    
    postsCreated++
  }
  
  // BOB'S POSTS (4 posts)
  
  // Bob Post 1: Tech tutorial post (PUBLIC)
  if (bobMedia.length >= 2) {
    const tutorialPost = await testPrisma.post.create({
      data: {
        title: 'Learn React in 2024 - Complete Tutorial',
        content: 'Just published my latest coding tutorial! This covers everything you need to know to get started with React. Check it out and let me know what you think!',
        visibility: 'PUBLIC',
        publicationStatus: 'PUBLIC',
        authorId: bob.id,
        hashtags: {
          connectOrCreate: [
            { where: { name: 'coding' }, create: { name: 'coding' } },
            { where: { name: 'react' }, create: { name: 'react' } },
            { where: { name: 'tutorial' }, create: { name: 'tutorial' } },
            { where: { name: 'webdev' }, create: { name: 'webdev' } }
          ]
        }
      }
    })
    
    await testPrisma.postMedia.create({
      data: { postId: tutorialPost.id, mediaId: bobMedia[1].id, order: 0, isLocked: false }
    })
    
    postsCreated++
  }
  
  // Bob Post 2: Workspace setup (PUBLIC)
  if (bobMedia.length >= 1) {
    const workspacePost = await testPrisma.post.create({
      data: {
        title: 'New Office Setup Complete!',
        content: 'Finally finished setting up my new home office. Productivity is going to go through the roof! 🚀',
        visibility: 'PUBLIC',
        publicationStatus: 'PUBLIC',
        authorId: bob.id,
        hashtags: {
          connectOrCreate: [
            { where: { name: 'workspace' }, create: { name: 'workspace' } },
            { where: { name: 'productivity' }, create: { name: 'productivity' } }
          ]
        }
      }
    })
    
    await testPrisma.postMedia.create({
      data: { postId: workspacePost.id, mediaId: bobMedia[0].id, order: 0, isLocked: false }
    })
    
    postsCreated++
  }
  
  // Bob Post 3: Simple text post (PUBLIC)
  await testPrisma.post.create({
    data: {
      content: 'Anyone else excited about the new JavaScript features coming in ES2024? 🎉',
      visibility: 'PUBLIC',
      publicationStatus: 'PUBLIC',
      authorId: bob.id,
      hashtags: {
        connectOrCreate: [
          { where: { name: 'javascript' }, create: { name: 'javascript' } },
          { where: { name: 'programming' }, create: { name: 'programming' } }
        ]
      }
    }
  })
  postsCreated++
  
  // Bob Post 4: Paused post (testing publication status)
  await testPrisma.post.create({
    data: {
      content: 'This is a draft post I\'m working on. Not ready to publish yet...',
      visibility: 'PUBLIC',
      publicationStatus: 'PAUSED',
      authorId: bob.id
    }
  })
  postsCreated++
  
  // CHARLIE'S POSTS (5 posts - content creator with most posts)
  
  // Charlie Post 1: Photography portfolio showcase (PUBLIC)
  if (charlieMedia.length >= 2) {
    const portfolioPost = await testPrisma.post.create({
      data: {
        title: 'My Latest Photography Work',
        content: 'Excited to share some of my recent photography work! These shots are from my trip to the mountains last month. What do you think?',
        visibility: 'PUBLIC',
        publicationStatus: 'PUBLIC',
        authorId: charlie.id,
        hashtags: {
          connectOrCreate: [
            { where: { name: 'photography' }, create: { name: 'photography' } },
            { where: { name: 'landscape' }, create: { name: 'landscape' } },
            { where: { name: 'nature' }, create: { name: 'nature' } }
          ]
        }
      }
    })
    
    await testPrisma.postMedia.createMany({
      data: [
        { postId: portfolioPost.id, mediaId: charlieMedia[1].id, order: 0, isLocked: false },
        { postId: portfolioPost.id, mediaId: charlieMedia[2].id, order: 1, isLocked: false }
      ]
    })
    
    postsCreated++
  }
  
  // Charlie Post 2: Daily vlog (PUBLIC)
  if (charlieMedia.length >= 1) {
    await testPrisma.post.create({
      data: {
        title: 'Day in My Life - Behind the Scenes',
        content: 'Follow me through a typical day! Link to full vlog in the video below. Don\'t forget to like and subscribe! 📹',
        visibility: 'PUBLIC',
        publicationStatus: 'PUBLIC',
        authorId: charlie.id,
        hashtags: {
          connectOrCreate: [
            { where: { name: 'vlog' }, create: { name: 'vlog' } },
            { where: { name: 'lifestyle' }, create: { name: 'lifestyle' } },
            { where: { name: 'daily' }, create: { name: 'daily' } }
          ]
        },
        media: {
          create: {
            mediaId: charlieMedia[0].id,
            order: 0,
            isLocked: false
          }
        }
      }
    })
    
    postsCreated++
  }
  
  // Charlie Post 3: Locked premium content (for testing locked posts)
  if (charlieMedia.length >= 2 && charlie.canPublishLockedMedia) {
    const lockedPost = await testPrisma.post.create({
      data: {
        title: '🔒 Premium Photography Tutorial - Advanced Techniques',
        content: 'Unlock this post to access my exclusive advanced photography tutorial! Learn professional editing techniques and composition secrets. Worth every penny! 💎',
        visibility: 'PUBLIC',
        publicationStatus: 'PUBLIC',
        authorId: charlie.id,
        isLocked: true,
        unlockPrice: 999, // $9.99 in cents
        hashtags: {
          connectOrCreate: [
            { where: { name: 'premium' }, create: { name: 'premium' } },
            { where: { name: 'tutorial' }, create: { name: 'tutorial' } },
            { where: { name: 'photography' }, create: { name: 'photography' } }
          ]
        }
      }
    })
    
    // Both media items are locked
    await testPrisma.postMedia.createMany({
      data: [
        { postId: lockedPost.id, mediaId: charlieMedia[1].id, order: 0, isLocked: true },
        { postId: lockedPost.id, mediaId: charlieMedia[2].id, order: 1, isLocked: true }
      ]
    })
    
    postsCreated++
  }
  
  // Charlie Post 4: Announcement post (PUBLIC)
  await testPrisma.post.create({
    data: {
      title: 'Big Announcement Coming Soon! 🎊',
      content: 'I have some exciting news to share next week! Can you guess what it is? Drop your guesses in the comments below! 👇',
      visibility: 'PUBLIC',
      publicationStatus: 'PUBLIC',
      authorId: charlie.id,
      hashtags: {
        connectOrCreate: [
          { where: { name: 'announcement' }, create: { name: 'announcement' } }
        ]
      }
    }
  })
  postsCreated++
  
  // Charlie Post 5: Private personal post
  await testPrisma.post.create({
    data: {
      content: 'Personal note to self: Remember to call mom this weekend. Also need to edit those wedding photos.',
      visibility: 'PRIVATE',
      publicationStatus: 'PUBLIC',
      authorId: charlie.id
    }
  })
  postsCreated++
  
  // DAVID'S POSTS (2 posts - text only, no media)
  
  // David Post 1: Introduction
  await testPrisma.post.create({
    data: {
      title: 'Hello Everyone!',
      content: 'Just joined this platform and excited to connect with everyone! I\'m interested in tech, photography, and travel. Feel free to reach out!',
      visibility: 'PUBLIC',
      publicationStatus: 'PUBLIC',
      authorId: david.id,
      hashtags: {
        connectOrCreate: [
          { where: { name: 'introduction' }, create: { name: 'introduction' } },
          { where: { name: 'newhere' }, create: { name: 'newhere' } }
        ]
      }
    }
  })
  postsCreated++
  
  // David Post 2: Discussion post
  await testPrisma.post.create({
    data: {
      content: 'What\'s everyone\'s favorite productivity app? I\'m looking for something to help organize my daily tasks better. Recommendations welcome! 🙏',
      visibility: 'PUBLIC',
      publicationStatus: 'PUBLIC',
      authorId: david.id,
      hashtags: {
        connectOrCreate: [
          { where: { name: 'productivity' }, create: { name: 'productivity' } },
          { where: { name: 'apps' }, create: { name: 'apps' } }
        ]
      }
    }
  })
  postsCreated++
  
  // EVE has NO posts (intentionally)
  
  console.log(`✅ Created ${postsCreated} posts`)
  console.log('   - Alice: 3 posts (with media)')
  console.log('   - Bob: 4 posts (including 1 paused)')
  console.log('   - Charlie: 5 posts (including 1 locked)')
  console.log('   - David: 2 posts (text only)')
  console.log('   - Eve: 0 posts')
}

export async function seedExtendedPosts(users: TestUser[]) {
  if (users.length < 10) {
    console.log('⚠️  Not enough users for extended post seeding')
    return
  }
  
  console.log('🌱 Seeding extended posts...')
  
  let postsCreated = 0
  
  // Create posts for extended users (5-9)
  for (let i = 5; i < 10; i++) {
    const user = users[i]
    
    // Each extended user gets 1-2 posts
    const post1 = await testPrisma.post.create({
      data: {
        content: `Test post by ${user.name}. This is sample content for testing purposes.`,
        visibility: 'PUBLIC',
        publicationStatus: 'PUBLIC',
        authorId: user.id,
        hashtags: {
          connectOrCreate: [
            { where: { name: 'test' }, create: { name: 'test' } }
          ]
        }
      }
    })
    postsCreated++
    
    // Some users get a second post
    if (i % 2 === 0) {
      await testPrisma.post.create({
        data: {
          title: `Update from ${user.name}`,
          content: 'Another test post with more sample content.',
          visibility: i % 3 === 0 ? 'FRIENDS_ONLY' : 'PUBLIC',
          publicationStatus: 'PUBLIC',
          authorId: user.id
        }
      })
      postsCreated++
    }
  }
  
  console.log(`✅ Created ${postsCreated} extended posts`)
}

