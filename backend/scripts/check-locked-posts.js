const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkLockedPosts() {
  try {
    console.log('🔍 Checking locked posts...\n')

    // Get all posts with their locked status
    const posts = await prisma.post.findMany({
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            canPublishLockedMedia: true
          }
        },
        media: {
          include: {
            media: {
              select: {
                id: true,
                originalFilename: true,
                mediaType: true
              }
            }
          }
        },
        unlockedBy: {
          select: {
            id: true,
            userId: true,
            paidAmount: true,
            unlockedAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    console.log(`📊 Found ${posts.length} recent posts:\n`)

    posts.forEach((post, index) => {
      console.log(`${index + 1}. Post ID: ${post.id}`)
      console.log(`   Content: ${post.content.substring(0, 50)}${post.content.length > 50 ? '...' : ''}`)
      console.log(`   Author: ${post.author.name} (${post.author.email})`)
      console.log(`   Author can publish locked media: ${post.author.canPublishLockedMedia ? 'Yes' : 'No'}`)
      console.log(`   Is Locked: ${post.isLocked ? 'Yes' : 'No'}`)
      console.log(`   Unlock Price: ${post.unlockPrice || 'N/A'}`)
      console.log(`   Media Count: ${post.media.length}`)
      
      if (post.media.length > 0) {
        console.log(`   Locked Media: ${post.media.filter(pm => pm.isLocked).length}/${post.media.length}`)
        post.media.forEach((pm, i) => {
          console.log(`     ${i + 1}. ${pm.media.originalFilename} - Locked: ${pm.isLocked ? 'Yes' : 'No'}`)
        })
      }
      
      console.log(`   Unlocked By: ${post.unlockedBy.length} users`)
      console.log(`   Created: ${post.createdAt}`)
      console.log('')
    })

    // Check specifically for locked posts
    const lockedPosts = posts.filter(post => post.isLocked)
    console.log(`🔒 Found ${lockedPosts.length} locked posts`)

    if (lockedPosts.length > 0) {
      console.log('\n📋 Locked Posts Details:')
      lockedPosts.forEach((post, index) => {
        console.log(`\n${index + 1}. Locked Post: ${post.id}`)
        console.log(`   Content: ${post.content}`)
        console.log(`   Unlock Price: ${post.unlockPrice} tokens`)
        console.log(`   Locked Media: ${post.media.filter(pm => pm.isLocked).map(pm => pm.media.originalFilename).join(', ')}`)
      })
    }

  } catch (error) {
    console.error('❌ Error checking locked posts:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkLockedPosts() 