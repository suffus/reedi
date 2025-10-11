/**
 * Test Helper Utilities
 * Common utilities used across all tests
 */

import { testPrisma } from '../seed/test-database.config'
import jwt from 'jsonwebtoken'

export interface TestUser {
  id: string
  email: string
  username: string
  name: string
  password?: string
}

export interface AuthTokens {
  accessToken: string
  user: TestUser
}

/**
 * Generate a valid JWT token for testing
 */
export function generateTestToken(user: { id: string; email: string }): string {
  const secret = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only'
  return jwt.sign(
    {
      userId: user.id,
      email: user.email
    },
    secret,
    { expiresIn: '1h' }
  )
}

/**
 * Generate an expired JWT token for testing
 */
export function generateExpiredToken(user: { id: string; email: string }): string {
  const secret = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only'
  return jwt.sign(
    {
      userId: user.id,
      email: user.email
    },
    secret,
    { expiresIn: '-1h' } // Expired 1 hour ago
  )
}

/**
 * Generate a malformed JWT token for testing
 */
export function generateMalformedToken(): string {
  return 'malformed.jwt.token.invalid'
}

/**
 * Get test user by email
 */
export async function getTestUserByEmail(email: string): Promise<TestUser | null> {
  const user = await testPrisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      username: true,
      name: true
    }
  })
  
  return user
}

/**
 * Get test user by username
 */
export async function getTestUserByUsername(username: string): Promise<TestUser | null> {
  const user = await testPrisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      email: true,
      username: true,
      name: true
    }
  })
  
  return user
}

/**
 * Check if two users are friends
 */
export async function areFriends(userId1: string, userId2: string): Promise<boolean> {
  const friendship = await testPrisma.friendRequest.findFirst({
    where: {
      OR: [
        { senderId: userId1, receiverId: userId2, status: 'ACCEPTED' },
        { senderId: userId2, receiverId: userId1, status: 'ACCEPTED' }
      ]
    }
  })
  
  return !!friendship
}

/**
 * Create a test friend relationship
 */
export async function createFriendship(userId1: string, userId2: string): Promise<void> {
  await testPrisma.friendRequest.create({
    data: {
      senderId: userId1,
      receiverId: userId2,
      status: 'ACCEPTED'
    }
  })
}

/**
 * Clean up test data after tests
 */
export async function cleanupTestData() {
  // Delete in correct order to respect foreign key constraints
  await testPrisma.messageReaction.deleteMany()
  await testPrisma.messageDeliveryStatus.deleteMany()
  await testPrisma.messageMedia.deleteMany()
  await testPrisma.message.deleteMany()
  await testPrisma.conversationParticipant.deleteMany()
  await testPrisma.conversation.deleteMany()
  
  await testPrisma.groupAction.deleteMany()
  await testPrisma.groupApplication.deleteMany()
  await testPrisma.groupInvitation.deleteMany()
  await testPrisma.groupPost.deleteMany()
  await testPrisma.groupMember.deleteMany()
  await testPrisma.group.deleteMany()
  
  await testPrisma.postMedia.deleteMany()
  await testPrisma.comment.deleteMany()
  await testPrisma.reaction.deleteMany()
  await testPrisma.post.deleteMany()
  
  await testPrisma.media.deleteMany()
  await testPrisma.gallery.deleteMany()
  
  await testPrisma.friendRequest.deleteMany()
  await testPrisma.follows.deleteMany()
  
  await testPrisma.hashtag.deleteMany()
  await testPrisma.user.deleteMany()
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, interval))
  }
  
  throw new Error('Timeout waiting for condition')
}

/**
 * Sleep for specified milliseconds
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

