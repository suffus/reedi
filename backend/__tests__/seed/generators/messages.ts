import { testPrisma } from '../test-database.config'
import { TestUser } from './users'

export async function seedMessages(users: TestUser[]) {
  console.log('🌱 Seeding messages and conversations...')
  
  if (users.length < 5) {
    console.log('⚠️  Not enough users for message seeding')
    return
  }
  
  const alice = users[0]
  const bob = users[1]
  const charlie = users[2]
  const david = users[3]
  const eve = users[4]
  
  // Get some media to attach to messages
  const aliceMedia = await testPrisma.media.findMany({
    where: { authorId: alice.id, processingStatus: 'COMPLETED' },
    take: 2
  })
  
  const charlieMedia = await testPrisma.media.findFirst({
    where: { authorId: charlie.id, mediaType: 'IMAGE', processingStatus: 'COMPLETED' }
  })
  
  let conversationsCreated = 0
  let messagesCreated = 0
  
  // ========================================
  // DIRECT CONVERSATIONS
  // ========================================
  
  // 1. Alice and Bob conversation (friends, active)
  const aliceBobConvo = await testPrisma.conversation.create({
    data: {
      type: 'DIRECT',
      createdById: alice.id,
      lastMessageAt: new Date()
    }
  })
  
  await testPrisma.conversationParticipant.createMany({
    data: [
      { conversationId: aliceBobConvo.id, userId: alice.id, role: 'MEMBER' },
      { conversationId: aliceBobConvo.id, userId: bob.id, role: 'MEMBER' }
    ]
  })
  conversationsCreated++
  
  // Messages between Alice and Bob
  const aliceBobMsg1 = await testPrisma.message.create({
    data: {
      conversationId: aliceBobConvo.id,
      senderId: alice.id,
      content: 'Hey Bob! How are you doing?',
      messageType: 'TEXT',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
    }
  })
  messagesCreated++
  
  await testPrisma.messageDeliveryStatus.createMany({
    data: [
      { messageId: aliceBobMsg1.id, userId: bob.id, status: 'READ', deliveredAt: new Date(Date.now() - 2 * 60 * 60 * 1000), readAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000) }
    ]
  })
  
  const aliceBobMsg2 = await testPrisma.message.create({
    data: {
      conversationId: aliceBobConvo.id,
      senderId: bob.id,
      content: 'Hi Alice! I\'m great, thanks! Just finished that React tutorial I was working on.',
      messageType: 'TEXT',
      createdAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000)
    }
  })
  messagesCreated++
  
  await testPrisma.messageDeliveryStatus.create({
    data: { messageId: aliceBobMsg2.id, userId: alice.id, status: 'READ', deliveredAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000), readAt: new Date(Date.now() - 1 * 60 * 60 * 1000) }
  })
  
  // Bob sends a message with media
  if (aliceMedia.length > 0) {
    const aliceBobMsg3 = await testPrisma.message.create({
      data: {
        conversationId: aliceBobConvo.id,
        senderId: alice.id,
        content: 'Check out this photo from my vacation!',
        messageType: 'IMAGE',
        createdAt: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
      }
    })
    
    await testPrisma.messageMedia.create({
      data: {
        messageId: aliceBobMsg3.id,
        mediaId: aliceMedia[0].id,
        order: 0
      }
    })
    
    await testPrisma.messageDeliveryStatus.create({
      data: { messageId: aliceBobMsg3.id, userId: bob.id, status: 'READ', deliveredAt: new Date(Date.now() - 25 * 60 * 1000), readAt: new Date(Date.now() - 20 * 60 * 1000) }
    })
    
    // Bob reacts with a LIKE
    await testPrisma.messageReaction.create({
      data: {
        messageId: aliceBobMsg3.id,
        userId: bob.id,
        reaction: '❤️'
      }
    })
    
    messagesCreated++
  }
  
  const aliceBobMsg4 = await testPrisma.message.create({
    data: {
      conversationId: aliceBobConvo.id,
      senderId: bob.id,
      content: 'Beautiful! Looks like you had an amazing time 🌊',
      messageType: 'TEXT',
      createdAt: new Date(Date.now() - 15 * 60 * 1000) // 15 minutes ago
    }
  })
  messagesCreated++
  
  await testPrisma.messageDeliveryStatus.create({
    data: { messageId: aliceBobMsg4.id, userId: alice.id, status: 'DELIVERED', deliveredAt: new Date(Date.now() - 15 * 60 * 1000) }
  })
  
  // 2. Alice and Charlie conversation (friends)
  const aliceCharlieConvo = await testPrisma.conversation.create({
    data: {
      type: 'DIRECT',
      createdById: alice.id,
      lastMessageAt: new Date()
    }
  })
  
  await testPrisma.conversationParticipant.createMany({
    data: [
      { conversationId: aliceCharlieConvo.id, userId: alice.id, role: 'MEMBER' },
      { conversationId: aliceCharlieConvo.id, userId: charlie.id, role: 'MEMBER' }
    ]
  })
  conversationsCreated++
  
  const aliceCharlieMsg1 = await testPrisma.message.create({
    data: {
      conversationId: aliceCharlieConvo.id,
      senderId: alice.id,
      content: 'Hey Charlie! I saw your photography portfolio - it\'s amazing!',
      messageType: 'TEXT',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
    }
  })
  messagesCreated++
  
  await testPrisma.messageDeliveryStatus.create({
    data: { messageId: aliceCharlieMsg1.id, userId: charlie.id, status: 'READ', deliveredAt: new Date(Date.now() - 23 * 60 * 60 * 1000), readAt: new Date(Date.now() - 22 * 60 * 60 * 1000) }
  })
  
  const aliceCharlieMsg2 = await testPrisma.message.create({
    data: {
      conversationId: aliceCharlieConvo.id,
      senderId: charlie.id,
      content: 'Thanks Alice! That means a lot. Would you be interested in a photo session?',
      messageType: 'TEXT',
      createdAt: new Date(Date.now() - 22 * 60 * 60 * 1000)
    }
  })
  messagesCreated++
  
  await testPrisma.messageDeliveryStatus.create({
    data: { messageId: aliceCharlieMsg2.id, userId: alice.id, status: 'READ', deliveredAt: new Date(Date.now() - 22 * 60 * 60 * 1000), readAt: new Date(Date.now() - 20 * 60 * 60 * 1000) }
  })
  
  const aliceCharlieMsg3 = await testPrisma.message.create({
    data: {
      conversationId: aliceCharlieConvo.id,
      senderId: alice.id,
      content: 'Absolutely! Let\'s plan something. What\'s your rate?',
      messageType: 'TEXT',
      createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000)
    }
  })
  messagesCreated++
  
  await testPrisma.messageDeliveryStatus.create({
    data: { messageId: aliceCharlieMsg3.id, userId: charlie.id, status: 'DELIVERED', deliveredAt: new Date(Date.now() - 20 * 60 * 60 * 1000) }
  })
  
  // 3. Bob and David conversation (friends)
  const bobDavidConvo = await testPrisma.conversation.create({
    data: {
      type: 'DIRECT',
      createdById: bob.id,
      lastMessageAt: new Date()
    }
  })
  
  await testPrisma.conversationParticipant.createMany({
    data: [
      { conversationId: bobDavidConvo.id, userId: bob.id, role: 'MEMBER' },
      { conversationId: bobDavidConvo.id, userId: david.id, role: 'MEMBER' }
    ]
  })
  conversationsCreated++
  
  const bobDavidMsg1 = await testPrisma.message.create({
    data: {
      conversationId: bobDavidConvo.id,
      senderId: david.id,
      content: 'Hey Bob, welcome to the platform!',
      messageType: 'TEXT',
      createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000) // 2 days ago
    }
  })
  messagesCreated++
  
  await testPrisma.messageDeliveryStatus.create({
    data: { messageId: bobDavidMsg1.id, userId: bob.id, status: 'READ', deliveredAt: new Date(Date.now() - 48 * 60 * 60 * 1000), readAt: new Date(Date.now() - 47 * 60 * 60 * 1000) }
  })
  
  const bobDavidMsg2 = await testPrisma.message.create({
    data: {
      conversationId: bobDavidConvo.id,
      senderId: bob.id,
      content: 'Thanks David! Happy to be here.',
      messageType: 'TEXT',
      createdAt: new Date(Date.now() - 47 * 60 * 60 * 1000)
    }
  })
  messagesCreated++
  
  await testPrisma.messageDeliveryStatus.create({
    data: { messageId: bobDavidMsg2.id, userId: david.id, status: 'READ', deliveredAt: new Date(Date.now() - 47 * 60 * 60 * 1000), readAt: new Date(Date.now() - 46 * 60 * 60 * 1000) }
  })
  
  // 4. Charlie and David conversation
  const charlieDavidConvo = await testPrisma.conversation.create({
    data: {
      type: 'DIRECT',
      createdById: charlie.id,
      lastMessageAt: new Date()
    }
  })
  
  await testPrisma.conversationParticipant.createMany({
    data: [
      { conversationId: charlieDavidConvo.id, userId: charlie.id, role: 'MEMBER' },
      { conversationId: charlieDavidConvo.id, userId: david.id, role: 'MEMBER' }
    ]
  })
  conversationsCreated++
  
  const charlieDavidMsg1 = await testPrisma.message.create({
    data: {
      conversationId: charlieDavidConvo.id,
      senderId: charlie.id,
      content: 'David, check out my new vlog!',
      messageType: 'TEXT',
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000) // 12 hours ago
    }
  })
  messagesCreated++
  
  await testPrisma.messageDeliveryStatus.create({
    data: { messageId: charlieDavidMsg1.id, userId: david.id, status: 'SENT', deliveredAt: new Date(Date.now() - 12 * 60 * 60 * 1000) }
  })
  
  // ========================================
  // GROUP CONVERSATIONS
  // ========================================
  
  // 5. Group conversation: Alice, Bob, Charlie (Tech Talk)
  const groupConvo1 = await testPrisma.conversation.create({
    data: {
      type: 'GROUP',
      name: 'Tech Talk',
      createdById: bob.id,
      lastMessageAt: new Date()
    }
  })
  
  await testPrisma.conversationParticipant.createMany({
    data: [
      { conversationId: groupConvo1.id, userId: alice.id, role: 'MEMBER' },
      { conversationId: groupConvo1.id, userId: bob.id, role: 'ADMIN' },
      { conversationId: groupConvo1.id, userId: charlie.id, role: 'MEMBER' }
    ]
  })
  conversationsCreated++
  
  const groupMsg1 = await testPrisma.message.create({
    data: {
      conversationId: groupConvo1.id,
      senderId: bob.id,
      content: 'Hey everyone! Created this group to discuss tech stuff 🚀',
      messageType: 'TEXT',
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000) // 6 hours ago
    }
  })
  messagesCreated++
  
  await testPrisma.messageDeliveryStatus.createMany({
    data: [
      { messageId: groupMsg1.id, userId: alice.id, status: 'READ', deliveredAt: new Date(Date.now() - 6 * 60 * 60 * 1000), readAt: new Date(Date.now() - 5 * 60 * 60 * 1000) },
      { messageId: groupMsg1.id, userId: charlie.id, status: 'READ', deliveredAt: new Date(Date.now() - 6 * 60 * 60 * 1000), readAt: new Date(Date.now() - 5.5 * 60 * 60 * 1000) }
    ]
  })
  
  const groupMsg2 = await testPrisma.message.create({
    data: {
      conversationId: groupConvo1.id,
      senderId: alice.id,
      content: 'Great idea! I\'ve been learning about web3 lately.',
      messageType: 'TEXT',
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000)
    }
  })
  messagesCreated++
  
  await testPrisma.messageDeliveryStatus.createMany({
    data: [
      { messageId: groupMsg2.id, userId: bob.id, status: 'READ', deliveredAt: new Date(Date.now() - 5 * 60 * 60 * 1000), readAt: new Date(Date.now() - 4.5 * 60 * 60 * 1000) },
      { messageId: groupMsg2.id, userId: charlie.id, status: 'DELIVERED', deliveredAt: new Date(Date.now() - 5 * 60 * 60 * 1000) }
    ]
  })
  
  const groupMsg3 = await testPrisma.message.create({
    data: {
      conversationId: groupConvo1.id,
      senderId: charlie.id,
      content: 'Nice! I\'m more into content creation tools but always interested in tech.',
      messageType: 'TEXT',
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000)
    }
  })
  messagesCreated++
  
  await testPrisma.messageDeliveryStatus.createMany({
    data: [
      { messageId: groupMsg3.id, userId: alice.id, status: 'READ', deliveredAt: new Date(Date.now() - 3 * 60 * 60 * 1000), readAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
      { messageId: groupMsg3.id, userId: bob.id, status: 'DELIVERED', deliveredAt: new Date(Date.now() - 3 * 60 * 60 * 1000) }
    ]
  })
  
  // 6. Group conversation: Alice, Bob, Charlie, David (Weekend Plans)
  const groupConvo2 = await testPrisma.conversation.create({
    data: {
      type: 'GROUP',
      name: 'Weekend Plans 🎉',
      createdById: alice.id,
      lastMessageAt: new Date()
    }
  })
  
  await testPrisma.conversationParticipant.createMany({
    data: [
      { conversationId: groupConvo2.id, userId: alice.id, role: 'ADMIN' },
      { conversationId: groupConvo2.id, userId: bob.id, role: 'MEMBER' },
      { conversationId: groupConvo2.id, userId: charlie.id, role: 'MEMBER' },
      { conversationId: groupConvo2.id, userId: david.id, role: 'MEMBER' }
    ]
  })
  conversationsCreated++
  
  const groupMsg4 = await testPrisma.message.create({
    data: {
      conversationId: groupConvo2.id,
      senderId: alice.id,
      content: 'Anyone up for a meetup this weekend?',
      messageType: 'TEXT',
      createdAt: new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago
    }
  })
  messagesCreated++
  
  await testPrisma.messageDeliveryStatus.createMany({
    data: [
      { messageId: groupMsg4.id, userId: bob.id, status: 'READ', deliveredAt: new Date(Date.now() - 10 * 60 * 1000), readAt: new Date(Date.now() - 8 * 60 * 1000) },
      { messageId: groupMsg4.id, userId: charlie.id, status: 'DELIVERED', deliveredAt: new Date(Date.now() - 10 * 60 * 1000) },
      { messageId: groupMsg4.id, userId: david.id, status: 'SENT' }
    ]
  })
  
  const groupMsg5 = await testPrisma.message.create({
    data: {
      conversationId: groupConvo2.id,
      senderId: bob.id,
      content: 'I\'m in! Let\'s do it 🙌',
      messageType: 'TEXT',
      createdAt: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
    }
  })
  messagesCreated++
  
  await testPrisma.messageDeliveryStatus.createMany({
    data: [
      { messageId: groupMsg5.id, userId: alice.id, status: 'READ', deliveredAt: new Date(Date.now() - 5 * 60 * 1000), readAt: new Date(Date.now() - 4 * 60 * 1000) },
      { messageId: groupMsg5.id, userId: charlie.id, status: 'DELIVERED', deliveredAt: new Date(Date.now() - 5 * 60 * 1000) },
      { messageId: groupMsg5.id, userId: david.id, status: 'SENT' }
    ]
  })
  
  // Bob reacts to Alice's message
  await testPrisma.messageReaction.create({
    data: {
      messageId: groupMsg4.id,
      userId: bob.id,
      reaction: '👍'
    }
  })
  
  console.log(`✅ Created ${conversationsCreated} conversations`)
  console.log(`   - 4 direct conversations`)
  console.log(`   - 2 group conversations`)
  console.log(`✅ Created ${messagesCreated} messages`)
  console.log(`   - Messages with text, images, and reactions`)
  console.log(`   - Various delivery statuses (sent, delivered, read)`)
}

export async function seedExtendedMessages(users: TestUser[]) {
  if (users.length < 10) {
    console.log('⚠️  Not enough users for extended message seeding')
    return
  }
  
  console.log('🌱 Seeding extended messages...')
  
  let conversationsCreated = 0
  let messagesCreated = 0
  
  // Create a few more conversations between extended users
  for (let i = 5; i < 9; i++) {
    const user1 = users[i]
    const user2 = users[(i + 1) % users.length]
    
    const convo = await testPrisma.conversation.create({
      data: {
        type: 'DIRECT',
        createdById: user1.id,
        lastMessageAt: new Date()
      }
    })
    
    await testPrisma.conversationParticipant.createMany({
      data: [
        { conversationId: convo.id, userId: user1.id, role: 'MEMBER' },
        { conversationId: convo.id, userId: user2.id, role: 'MEMBER' }
      ]
    })
    
    const msg = await testPrisma.message.create({
      data: {
        conversationId: convo.id,
        senderId: user1.id,
        content: `Hey ${user2.name}, how are you?`,
        messageType: 'TEXT'
      }
    })
    
    await testPrisma.messageDeliveryStatus.create({
      data: {
        messageId: msg.id,
        userId: user2.id,
        status: 'DELIVERED'
      }
    })
    
    conversationsCreated++
    messagesCreated++
  }
  
  console.log(`✅ Created ${conversationsCreated} extended conversations`)
  console.log(`✅ Created ${messagesCreated} extended messages`)
}

