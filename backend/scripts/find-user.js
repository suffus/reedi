const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function findUser(identifier) {
  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { username: identifier }
        ]
      },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        canPublishLockedMedia: true
      }
    })

    if (user) {
      console.log('✅ User found:')
      console.log(`  ID: ${user.id}`)
      console.log(`  Name: ${user.name}`)
      console.log(`  Email: ${user.email}`)
      console.log(`  Username: ${user.username || 'N/A'}`)
      console.log(`  Can publish locked media: ${user.canPublishLockedMedia ? 'Yes' : 'No'}`)
    } else {
      console.log('❌ User not found')
    }
  } catch (error) {
    console.error('❌ Error finding user:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Get identifier from command line argument
const identifier = process.argv[2]

if (!identifier) {
  console.error('❌ Please provide an email or username as an argument')
  console.log('Usage: node find-user.js <email_or_username>')
  process.exit(1)
}

findUser(identifier) 