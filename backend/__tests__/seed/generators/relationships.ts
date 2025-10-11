import { testPrisma } from '../test-database.config'
import { TestUser } from './users'

export async function seedFriendships(users: TestUser[]) {
  console.log('🌱 Seeding friendships...')
  
  // Create friend relationships
  const friendships = [
    // Alice <-> Bob (friends)
    { sender: users[0].id, receiver: users[1].id },
    // Alice <-> Charlie (friends)
    { sender: users[0].id, receiver: users[2].id },
    // Bob <-> David (friends)
    { sender: users[1].id, receiver: users[3].id },
    // Charlie <-> David (friends)
    { sender: users[2].id, receiver: users[3].id },
  ]
  
  for (const { sender, receiver } of friendships) {
    await testPrisma.friendRequest.create({
      data: {
        senderId: sender,
        receiverId: receiver,
        status: 'ACCEPTED'
      }
    })
  }
  
  console.log(`✅ Created ${friendships.length} friendships`)
}

export async function seedPendingFriendRequests(users: TestUser[]) {
  console.log('🌱 Seeding pending friend requests...')
  
  // Eve has sent request to Alice (pending)
  if (users.length >= 5) {
    await testPrisma.friendRequest.create({
      data: {
        senderId: users[4].id,
        receiverId: users[0].id,
        status: 'PENDING'
      }
    })
    
    console.log('✅ Created pending friend requests')
  }
}

export async function seedFollows(users: TestUser[]) {
  console.log('🌱 Seeding follows...')
  
  const follows = [
    // Alice follows Charlie (content creator)
    { follower: users[0].id, following: users[2].id },
    // Bob follows Charlie
    { follower: users[1].id, following: users[2].id },
    // David follows Charlie
    { follower: users[3].id, following: users[2].id },
    // Charlie follows Alice
    { follower: users[2].id, following: users[0].id },
  ]
  
  for (const { follower, following } of follows) {
    await testPrisma.follows.create({
      data: {
        followerId: follower,
        followingId: following
      }
    })
  }
  
  console.log(`✅ Created ${follows.length} follow relationships`)
}

export async function seedExtendedRelationships(users: TestUser[]) {
  if (users.length < 10) {
    console.log('⚠️  Not enough users for extended relationships')
    return
  }
  
  console.log('🌱 Seeding extended relationships...')
  
  // Create a more complex network
  const additionalFriendships = [
    { sender: users[5].id, receiver: users[6].id },
    { sender: users[5].id, receiver: users[0].id },
    { sender: users[6].id, receiver: users[7].id },
    { sender: users[7].id, receiver: users[8].id },
  ]
  
  for (const { sender, receiver } of additionalFriendships) {
    await testPrisma.friendRequest.create({
      data: {
        senderId: sender,
        receiverId: receiver,
        status: 'ACCEPTED'
      }
    })
  }
  
  // Additional follows
  const additionalFollows = [
    { follower: users[5].id, following: users[2].id },
    { follower: users[6].id, following: users[2].id },
    { follower: users[7].id, following: users[2].id },
    { follower: users[8].id, following: users[0].id },
    { follower: users[9].id, following: users[0].id },
  ]
  
  for (const { follower, following } of additionalFollows) {
    await testPrisma.follows.create({
      data: {
        followerId: follower,
        followingId: following
      }
    })
  }
  
  console.log('✅ Created extended relationship network')
}

