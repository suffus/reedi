#!/usr/bin/env node

/**
 * Data Migration Script: Add Context to Existing Comments
 * 
 * This script migrates existing comments to have proper context values:
 * - Comments on posts that only exist in groups -> context='GROUP', groupId set
 * - All other comments -> context='FEED', groupId=NULL
 * 
 * Usage:
 *   node migrate-comment-context.js [--dry-run]
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const isDryRun = process.argv.includes('--dry-run')

async function main() {
  console.log('🚀 Starting comment context migration...')
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log('')

  try {
    // Get all comments
    const allComments = await prisma.comment.findMany({
      select: {
        id: true,
        postId: true,
        mediaId: true,
        context: true,
        groupId: true
      }
    })

    console.log(`📊 Total comments to process: ${allComments.length}`)
    console.log('')

    let groupComments = 0
    let feedComments = 0
    let skippedComments = 0
    let errors = 0

    for (const comment of allComments) {
      try {
        // Skip if already has context
        if (comment.context && comment.context !== 'FEED') {
          skippedComments++
          continue
        }

        // Skip media comments for now (they default to FEED)
        if (comment.mediaId) {
          if (!isDryRun && !comment.context) {
            await prisma.comment.update({
              where: { id: comment.id },
              data: { context: 'FEED', groupId: null }
            })
          }
          feedComments++
          continue
        }

        // For post comments, check if post belongs to a single group
        if (comment.postId) {
          const groupPosts = await prisma.groupPost.findMany({
            where: { postId: comment.postId },
            select: { groupId: true }
          })

          // If post is in exactly one group, assign GROUP context
          if (groupPosts.length === 1) {
            if (!isDryRun) {
              await prisma.comment.update({
                where: { id: comment.id },
                data: { 
                  context: 'GROUP',
                  groupId: groupPosts[0].groupId
                }
              })
            }
            groupComments++
            if (groupComments % 100 === 0) {
              console.log(`  ✅ Processed ${groupComments} group comments...`)
            }
          } else {
            // Post is in 0 or multiple groups, or only in feed
            if (!isDryRun) {
              await prisma.comment.update({
                where: { id: comment.id },
                data: { context: 'FEED', groupId: null }
              })
            }
            feedComments++
            if (feedComments % 100 === 0) {
              console.log(`  ✅ Processed ${feedComments} feed comments...`)
            }
          }
        }
      } catch (error) {
        console.error(`  ❌ Error processing comment ${comment.id}:`, error.message)
        errors++
      }
    }

    console.log('')
    console.log('📈 Migration Summary:')
    console.log(`  • Comments migrated to GROUP context: ${groupComments}`)
    console.log(`  • Comments migrated to FEED context: ${feedComments}`)
    console.log(`  • Comments skipped (already migrated): ${skippedComments}`)
    console.log(`  • Errors: ${errors}`)
    console.log('')

    if (isDryRun) {
      console.log('⚠️  DRY RUN - No changes were made')
      console.log('   Run without --dry-run to apply changes')
    } else {
      console.log('✅ Migration completed successfully!')
    }

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

