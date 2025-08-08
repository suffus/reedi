const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function grantLockedPostsPermission(userId) {
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { canPublishLockedMedia: true }
    })

    console.log(`✅ Granted locked posts permission to user: ${user.name} (${user.email})`)
  } catch (error) {
    console.error('❌ Error granting permission:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Get user ID from command line argument
const userId = process.argv[2]

if (!userId) {
  console.error('❌ Please provide a user ID as an argument')
  console.log('Usage: node grant-locked-posts-permission.js <userId>')
  process.exit(1)
}

grantLockedPostsPermission(userId) 