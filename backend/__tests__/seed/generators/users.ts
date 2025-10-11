import { testPrisma, testConfig } from '../test-database.config'
import bcrypt from 'bcrypt'

export interface TestUser {
  id: string
  email: string
  username: string
  name: string
  password: string
  bio?: string
  canPublishLockedMedia?: boolean
  isPrivate?: boolean
}

const TEST_USERS = [
  {
    email: 'alice@test.com',
    username: 'alice_test',
    name: 'Alice Test',
    bio: 'Test user Alice - Regular user',
    canPublishLockedMedia: false,
    isPrivate: false
  },
  {
    email: 'bob@test.com',
    username: 'bob_test',
    name: 'Bob Test',
    bio: 'Test user Bob - Alice\'s friend',
    canPublishLockedMedia: false,
    isPrivate: false
  },
  {
    email: 'charlie@test.com',
    username: 'charlie_test',
    name: 'Charlie Test',
    bio: 'Test user Charlie - Content creator',
    canPublishLockedMedia: true,
    isPrivate: false
  },
  {
    email: 'david@test.com',
    username: 'david_test',
    name: 'David Test',
    bio: 'Test user David - Group admin',
    canPublishLockedMedia: false,
    isPrivate: false
  },
  {
    email: 'eve@test.com',
    username: 'eve_test',
    name: 'Eve Test',
    bio: 'Test user Eve - Private profile',
    canPublishLockedMedia: false,
    isPrivate: true
  }
]

// Additional users for comprehensive testing
const EXTENDED_TEST_USERS = [
  {
    email: 'frank@test.com',
    username: 'frank_test',
    name: 'Frank Test',
    bio: 'Test user Frank',
    canPublishLockedMedia: false,
    isPrivate: false
  },
  {
    email: 'grace@test.com',
    username: 'grace_test',
    name: 'Grace Test',
    bio: 'Test user Grace',
    canPublishLockedMedia: false,
    isPrivate: false
  },
  {
    email: 'henry@test.com',
    username: 'henry_test',
    name: 'Henry Test',
    bio: 'Test user Henry',
    canPublishLockedMedia: true,
    isPrivate: false
  },
  {
    email: 'iris@test.com',
    username: 'iris_test',
    name: 'Iris Test',
    bio: 'Test user Iris',
    canPublishLockedMedia: false,
    isPrivate: true
  },
  {
    email: 'jack@test.com',
    username: 'jack_test',
    name: 'Jack Test',
    bio: 'Test user Jack',
    canPublishLockedMedia: false,
    isPrivate: false
  }
]

export async function seedUsers(extended: boolean = false): Promise<TestUser[]> {
  console.log('🌱 Seeding users...')
  
  const usersToSeed = extended ? [...TEST_USERS, ...EXTENDED_TEST_USERS] : TEST_USERS
  const hashedPassword = await bcrypt.hash(testConfig.defaultPassword, 10)
  
  const createdUsers: TestUser[] = []
  
  for (const userData of usersToSeed) {
    const user = await testPrisma.user.create({
      data: {
        email: userData.email,
        username: userData.username,
        name: userData.name,
        password: hashedPassword,
        bio: userData.bio,
        canPublishLockedMedia: userData.canPublishLockedMedia || false,
        isPrivate: userData.isPrivate || false,
        isVerified: true // All test users are verified
      }
    })
    
    createdUsers.push({
      id: user.id,
      email: user.email,
      username: user.username!,
      name: user.name,
      password: testConfig.defaultPassword,
      bio: user.bio || undefined,
      canPublishLockedMedia: user.canPublishLockedMedia,
      isPrivate: user.isPrivate
    })
  }
  
  console.log(`✅ Created ${createdUsers.length} test users`)
  return createdUsers
}

export async function getUserByEmail(email: string): Promise<TestUser | null> {
  const user = await testPrisma.user.findUnique({
    where: { email }
  })
  
  if (!user) return null
  
  return {
    id: user.id,
    email: user.email,
    username: user.username!,
    name: user.name,
    password: testConfig.defaultPassword,
    bio: user.bio || undefined,
    canPublishLockedMedia: user.canPublishLockedMedia,
    isPrivate: user.isPrivate
  }
}

export async function getUserById(id: string): Promise<TestUser | null> {
  const user = await testPrisma.user.findUnique({
    where: { id }
  })
  
  if (!user) return null
  
  return {
    id: user.id,
    email: user.email,
    username: user.username!,
    name: user.name,
    password: testConfig.defaultPassword,
    bio: user.bio || undefined,
    canPublishLockedMedia: user.canPublishLockedMedia,
    isPrivate: user.isPrivate
  }
}

