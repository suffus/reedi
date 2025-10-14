import { testPrisma } from '../test-database.config'
import { getUserByEmail } from './users'

/**
 * Seed comments for testing comment context isolation
 * Creates comments in different contexts: FEED, GROUP, USER_PAGE
 */
export async function seedComments() {
  console.log('🔄 Seeding comments...')

  try {
    // Get test users
    const alice = await getUserByEmail('alice@test.com')
    const bob = await getUserByEmail('bob@test.com')
    const charlie = await getUserByEmail('charlie@test.com')
    const david = await getUserByEmail('david@test.com')

    if (!alice || !bob || !charlie || !david) {
      throw new Error('Test users not found')
    }

    // Get some posts for commenting
    const posts = await testPrisma.post.findMany({
      take: 10,
      include: {
        groupPosts: {
          include: {
            group: true
          }
        }
      }
    })

    if (posts.length === 0) {
      console.log('⚠️  No posts found - skipping comment seeding')
      return
    }

    let feedComments = 0
    let groupComments = 0
    let userPageComments = 0

    for (const post of posts) {
      // Create FEED context comments (for posts in feeds)
      if (post.visibility === 'PUBLIC') {
        await testPrisma.comment.create({
          data: {
            content: `This is a FEED comment on ${post.title || 'this post'}`,
            postId: post.id,
            authorId: bob.id,
            context: 'FEED'
          }
        })
        feedComments++

        // Add a reply
        const parentComment = await testPrisma.comment.findFirst({
          where: { postId: post.id, context: 'FEED' }
        })
        if (parentComment) {
          await testPrisma.comment.create({
            data: {
              content: 'Reply to feed comment',
              postId: post.id,
              authorId: charlie.id,
              parentId: parentComment.id,
              context: 'FEED' // Should inherit but explicitly set
            }
          })
          feedComments++
        }
      }

      // Create GROUP context comments (for posts in groups)
      if (post.groupPosts && post.groupPosts.length > 0) {
        for (const groupPost of post.groupPosts) {
          // Check if user is a member
          const membership = await testPrisma.groupMember.findFirst({
            where: {
              groupId: groupPost.groupId,
              userId: bob.id,
              status: 'ACTIVE'
            }
          })

          if (membership) {
            await testPrisma.comment.create({
              data: {
                content: `GROUP comment in ${groupPost.group.name}`,
                postId: post.id,
                authorId: bob.id,
                context: 'GROUP',
                groupId: groupPost.groupId
              }
            })
            groupComments++

            // Add another group member comment
            const otherMember = await testPrisma.groupMember.findFirst({
              where: {
                groupId: groupPost.groupId,
                userId: { not: bob.id },
                status: 'ACTIVE'
              }
            })

            if (otherMember) {
              await testPrisma.comment.create({
                data: {
                  content: 'Another GROUP member commenting',
                  postId: post.id,
                  authorId: otherMember.userId,
                  context: 'GROUP',
                  groupId: groupPost.groupId
                }
              })
              groupComments++
            }
          }
        }
      }

      // Create USER_PAGE context comments (for posts on user pages)
      if (post.authorId === alice.id) {
        await testPrisma.comment.create({
          data: {
            content: 'USER_PAGE comment on Alice\'s post',
            postId: post.id,
            authorId: charlie.id,
            context: 'USER_PAGE'
          }
        })
        userPageComments++
      }
    }

    console.log(`✅ Seeded ${feedComments} FEED comments`)
    console.log(`✅ Seeded ${groupComments} GROUP comments`)
    console.log(`✅ Seeded ${userPageComments} USER_PAGE comments`)
    console.log(`✅ Total: ${feedComments + groupComments + userPageComments} comments`)

  } catch (error) {
    console.error('❌ Error seeding comments:', error)
    throw error
  }
}

/**
 * Delete all comments (for cleanup)
 */
export async function deleteComments() {
  await testPrisma.comment.deleteMany({})
  console.log('✅ Deleted all comments')
}

