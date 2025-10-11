/**
 * Authentication & Authorization Tests (P0 - Critical)
 * 
 * Tests cover:
 * - Login with valid/invalid credentials
 * - JWT token generation and validation
 * - Protected route access
 * - Token expiration handling
 * - Authorization and permissions
 */

import request from 'supertest'
import express, { Express } from 'express'
import { testPrisma } from '../seed/test-database.config'
import { 
  generateTestToken, 
  generateExpiredToken, 
  generateMalformedToken,
  getTestUserByEmail 
} from '../utils/test-helpers'
import authRouter from '../../src/routes/auth'
import postsRouter from '../../src/routes/posts'
import { authMiddleware } from '../../src/middleware/auth'
import { errorHandler } from '../../src/middleware/errorHandler'

describe('Authentication & Authorization (P0)', () => {
  let app: Express
  
  beforeAll(async () => {
    // Set up Express app with routes
    app = express()
    app.use(express.json())
    app.use('/api/auth', authRouter)
    app.use('/api/posts', postsRouter)
    app.use(errorHandler)
  })
  
  afterAll(async () => {
    await testPrisma.$disconnect()
  })
  
  describe('Login & JWT Authentication', () => {
    describe('POST /api/auth/login', () => {
      it('should generate valid JWT token with correct credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'alice@test.com',
            password: 'Test123!'
          })
        
        expect(response.status).toBe(200)
        expect(response.body).toHaveProperty('success', true)
        expect(response.body).toHaveProperty('data')
        expect(response.body.data).toHaveProperty('token')
        expect(response.body.data).toHaveProperty('user')
        expect(response.body.data.user).toHaveProperty('email', 'alice@test.com')
        expect(response.body.data.user).toHaveProperty('username', 'alice_test')
        expect(response.body.data.user).not.toHaveProperty('password') // Password should not be returned
      })
      
      it('should reject login with invalid email', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'nonexistent@test.com',
            password: 'Test123!'
          })
        
        expect(response.status).toBe(401)
        expect(response.body).toHaveProperty('success', false)
        expect(response.body).toHaveProperty('error')
        expect(response.body.error).toMatch(/invalid/i)
      })
      
      it('should reject login with invalid password', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'alice@test.com',
            password: 'WrongPassword123!'
          })
        
        expect(response.status).toBe(401)
        expect(response.body).toHaveProperty('success', false)
        expect(response.body).toHaveProperty('error')
        expect(response.body.error).toMatch(/invalid/i)
      })
      
      it('should reject login with missing credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'alice@test.com'
            // Missing password
          })
        
        expect(response.status).toBe(400)
      })
      
      it('should reject login with malformed email', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'not-an-email',
            password: 'Test123!'
          })
        
        expect(response.status).toBe(400)
      })
    })
    
    describe('JWT Token Validation', () => {
      let validToken: string
      let alice: any
      
      beforeAll(async () => {
        alice = await getTestUserByEmail('alice@test.com')
        validToken = generateTestToken(alice!)
      })
      
      it('should allow access to protected routes with valid JWT token', async () => {
        const response = await request(app)
          .get('/api/posts')
          .set('Authorization', `Bearer ${validToken}`)
        
        // Should not return 401
        expect(response.status).not.toBe(401)
      })
      
      it('should reject access to protected routes without token', async () => {
        const response = await request(app)
          .get('/api/posts/feed') // Use endpoint that requires auth
        
        expect(response.status).toBe(401)
        expect(response.body).toHaveProperty('error')
      })
      
      it('should reject expired JWT tokens', async () => {
        const expiredToken = generateExpiredToken(alice!)
        
        const response = await request(app)
          .get('/api/posts/feed') // Use endpoint that requires auth
          .set('Authorization', `Bearer ${expiredToken}`)
        
        expect(response.status).toBe(401)
        expect(response.body.error).toMatch(/expired|invalid/i)
      })
      
      it('should reject malformed JWT tokens', async () => {
        const malformedToken = generateMalformedToken()
        
        const response = await request(app)
          .get('/api/posts/feed') // Use endpoint that requires auth
          .set('Authorization', `Bearer ${malformedToken}`)
        
        expect(response.status).toBe(401)
        expect(response.body.error).toMatch(/invalid|malformed/i)
      })
      
      it('should reject token with invalid signature', async () => {
        const tokenWithWrongSignature = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0IiwiZW1haWwiOiJ0ZXN0QHRlc3QuY29tIn0.invalid_signature'
        
        const response = await request(app)
          .get('/api/posts/feed') // Use endpoint that requires auth
          .set('Authorization', `Bearer ${tokenWithWrongSignature}`)
        
        expect(response.status).toBe(401)
      })
      
      it('should reject token without Bearer prefix', async () => {
        const response = await request(app)
          .get('/api/posts/feed') // Use endpoint that requires auth
          .set('Authorization', validToken) // Missing "Bearer "
        
        expect(response.status).toBe(401)
      })
    })
  })
  
  describe('Authorization & Permissions', () => {
    let aliceToken: string
    let bobToken: string
    let charlieToken: string
    let alice: any
    let bob: any
    let charlie: any
    
    beforeAll(async () => {
      alice = await getTestUserByEmail('alice@test.com')
      bob = await getTestUserByEmail('bob@test.com')
      charlie = await getTestUserByEmail('charlie@test.com')
      
      aliceToken = generateTestToken(alice!)
      bobToken = generateTestToken(bob!)
      charlieToken = generateTestToken(charlie!)
    })
    
    describe('Private Content Access', () => {
      it('should allow users to access their own private content', async () => {
        // Find Alice's private post
        const privatePost = await testPrisma.post.findFirst({
          where: {
            authorId: alice!.id,
            visibility: 'PRIVATE'
          }
        })
        
        if (privatePost) {
          const response = await request(app)
            .get(`/api/posts/${privatePost.id}`)
            .set('Authorization', `Bearer ${aliceToken}`)
          
          expect(response.status).toBe(200)
          expect(response.body).toHaveProperty('data')
          expect(response.body.data).toHaveProperty('post')
        }
      })
      
      it('should deny access to other users\' private content', async () => {
        // Find Alice's private post
        const privatePost = await testPrisma.post.findFirst({
          where: {
            authorId: alice!.id,
            visibility: 'PRIVATE'
          }
        })
        
        if (privatePost) {
          const response = await request(app)
            .get(`/api/posts/${privatePost.id}`)
            .set('Authorization', `Bearer ${bobToken}`)
          
          expect(response.status).toBe(403)
        }
      })
    })
    
    describe('Friends-Only Content Access', () => {
      it('should allow friends to access FRIENDS_ONLY content', async () => {
        // Find Alice's friends-only post
        const friendsPost = await testPrisma.post.findFirst({
          where: {
            authorId: alice!.id,
            visibility: 'FRIENDS_ONLY'
          }
        })
        
        if (friendsPost) {
          // Bob is Alice's friend
          const response = await request(app)
            .get(`/api/posts/${friendsPost.id}`)
            .set('Authorization', `Bearer ${bobToken}`)
          
          expect(response.status).not.toBe(403) // Should not be forbidden
        }
      })
      
      it('should deny non-friends access to FRIENDS_ONLY content', async () => {
        // Find Alice's friends-only post
        const friendsPost = await testPrisma.post.findFirst({
          where: {
            authorId: alice!.id,
            visibility: 'FRIENDS_ONLY'
          }
        })
        
        if (friendsPost) {
          // Use David who is NOT Alice's friend (Bob is David's friend, not Alice)
          const david = await getTestUserByEmail('david@test.com')
          
          if (david) {
            const davidToken = generateTestToken(david)
            
            const response = await request(app)
              .get(`/api/posts/${friendsPost.id}`)
              .set('Authorization', `Bearer ${davidToken}`)
            
            expect(response.status).toBe(403)
          }
        }
      })
    })
    
    describe('Public Content Access', () => {
      it('should allow all authenticated users to access public content', async () => {
        // Find a public post
        const publicPost = await testPrisma.post.findFirst({
          where: {
            visibility: 'PUBLIC',
            publicationStatus: 'PUBLIC'
          }
        })
        
        if (publicPost) {
          // Any authenticated user can access
          const response = await request(app)
            .get(`/api/posts/${publicPost.id}`)
            .set('Authorization', `Bearer ${bobToken}`)
          
          expect(response.status).toBe(200)
        }
      })
    })
    
    describe('Locked Post Permissions', () => {
      it('should allow users with canPublishLockedMedia to create locked posts', async () => {
        // Charlie has canPublishLockedMedia permission
        const charlieUser = await testPrisma.user.findUnique({
          where: { id: charlie!.id }
        })
        
        expect(charlieUser?.canPublishLockedMedia).toBe(true)
        
        // Try to create a locked post as Charlie
        const response = await request(app)
          .post('/api/posts')
          .set('Authorization', `Bearer ${charlieToken}`)
          .send({
            content: 'Test locked post',
            visibility: 'PUBLIC',
            isLocked: true,
            unlockPrice: 999
          })
        
        // Should be allowed (not 403)
        expect(response.status).not.toBe(403)
      })
      
      it('should deny users without canPublishLockedMedia from creating locked posts', async () => {
        // Alice does NOT have canPublishLockedMedia permission
        const aliceUser = await testPrisma.user.findUnique({
          where: { id: alice!.id }
        })
        
        expect(aliceUser?.canPublishLockedMedia).toBe(false)
        
        // Try to create a locked post as Alice
        const response = await request(app)
          .post('/api/posts')
          .set('Authorization', `Bearer ${aliceToken}`)
          .send({
            content: 'Test locked post',
            visibility: 'PUBLIC',
            isLocked: true,
            unlockPrice: 999
          })
        
        // Should be forbidden
        expect(response.status).toBe(403)
      })
    })
  })
})

