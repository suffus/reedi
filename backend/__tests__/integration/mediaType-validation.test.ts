/**
 * MediaType Validation Tests
 * 
 * Ensures that mediaType is properly returned in all API responses
 * where media is included. This is critical for frontend video detection.
 */

import request from 'supertest'
import express, { Express } from 'express'
import { testPrisma } from '../seed/test-database.config'
import { 
  generateTestToken, 
  getTestUserByEmail 
} from '../utils/test-helpers'
import { 
  expectPostMediaHaveType,
  expectAllMediaHaveType,
  expectMessageMediaHaveType,
  validateMediaType
} from '../utils/validation-schemas'
import postsRouter from '../../src/routes/posts'
import mediaRouter from '../../src/routes/media'
import messagesRouter from '../../src/routes/messages'
import galleriesRouter from '../../src/routes/galleries'
import searchRouter from '../../src/routes/search'
import { errorHandler } from '../../src/middleware/errorHandler'

describe('MediaType Validation Tests', () => {
  let app: Express
  let aliceToken: string
  let bobToken: string
  let alice: any
  let bob: any
  
  beforeAll(async () => {
    // Set up Express app with all routes
    app = express()
    app.use(express.json())
    app.use('/api/posts', postsRouter)
    app.use('/api/media', mediaRouter)
    app.use('/api/messages', messagesRouter)
    app.use('/api/galleries', galleriesRouter)
    app.use('/api/search', searchRouter)
    app.use(errorHandler)
    
    // Get test users and tokens
    alice = await getTestUserByEmail('alice@test.com')
    bob = await getTestUserByEmail('bob@test.com')
    
    aliceToken = generateTestToken(alice!)
    bobToken = generateTestToken(bob!)
  })
  
  afterAll(async () => {
    await testPrisma.$disconnect()
  })

  describe('Posts API - mediaType Validation', () => {
    it('should include mediaType in posts feed', async () => {
      const response = await request(app)
        .get('/api/posts')
        .set('Authorization', `Bearer ${aliceToken}`)
      
      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.posts).toBeDefined()
      
      // Debug: Log the structure of the first post with media
      const postWithMedia = response.body.data.posts.find((p: any) => p.media && p.media.length > 0)
      if (postWithMedia) {
        console.log('Post with media structure:', JSON.stringify(postWithMedia, null, 2))
        console.log('Media item structure:', JSON.stringify(postWithMedia.media[0], null, 2))
      }
      
      // Check that all media items have mediaType
      expectPostMediaHaveType(response.body.data.posts)
    })

    it('should include mediaType in personalized feed', async () => {
      const response = await request(app)
        .get('/api/posts/feed')
        .set('Authorization', `Bearer ${aliceToken}`)
      
      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      
      // Check that all media items have mediaType
      expectPostMediaHaveType(response.body.data.posts)
    })

    it('should include mediaType in user public posts', async () => {
      const response = await request(app)
        .get(`/api/posts/user/${alice!.id}/public`)
        .set('Authorization', `Bearer ${bobToken}`)
      
      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      
      // Check that all media items have mediaType
      expectPostMediaHaveType(response.body.data.posts)
    })

    it('should include mediaType in public posts', async () => {
      const response = await request(app)
        .get('/api/posts')
      
      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      
      // Check that all media items have mediaType
      expectPostMediaHaveType(response.body.data.posts)
    })

    it('should include mediaType in single post', async () => {
      // Find a post with media
      const postWithMedia = await testPrisma.post.findFirst({
        where: {
          media: {
            some: {}
          }
        }
      })

      if (postWithMedia) {
        const response = await request(app)
          .get(`/api/posts/${postWithMedia.id}`)
          .set('Authorization', `Bearer ${aliceToken}`)
        
        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        
        // Check that all media items have mediaType
        expectPostMediaHaveType([response.body.data.post])
      }
    })
  })

  describe('Media API - mediaType Validation', () => {
    it('should include mediaType in user media', async () => {
      const response = await request(app)
        .get(`/api/media/user/${alice!.id}`)
        .set('Authorization', `Bearer ${aliceToken}`)
      
      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      
      // Check that all media items have mediaType
      expectAllMediaHaveType(response.body.data.media)
    })

    it('should include mediaType in public user media', async () => {
      const response = await request(app)
        .get(`/api/media/user/${alice!.id}/public`)
        .set('Authorization', `Bearer ${bobToken}`)
      
      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      
      // Check that all media items have mediaType
      expectAllMediaHaveType(response.body.data.media)
    })

    it('should include mediaType in media search', async () => {
      const response = await request(app)
        .get('/api/search/media/tags?tags=test')
        .set('Authorization', `Bearer ${aliceToken}`)
      
      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      
      // Check that all media items have mediaType
      expectAllMediaHaveType(response.body.data.media)
    })
  })

  describe('Messages API - mediaType Validation', () => {
    it('should include mediaType in conversations', async () => {
      const response = await request(app)
        .get('/api/messages/conversations')
        .set('Authorization', `Bearer ${aliceToken}`)
      
      expect(response.status).toBe(200)
      // Messages endpoints return arrays directly, not wrapped objects
      expect(Array.isArray(response.body)).toBe(true)
      
      // Check that all media items in last messages have mediaType
      response.body.forEach((conversation: any) => {
        if (conversation.lastMessage?.media) {
          expect(conversation.lastMessage.media.mediaType).toBeDefined()
          expect(validateMediaType(conversation.lastMessage.media.mediaType)).toBe(true)
        }
      })
    })

    it('should include mediaType in messages', async () => {
      // Find a conversation with messages
      const conversation = await testPrisma.conversation.findFirst({
        where: {
          messages: {
            some: {}
          }
        }
      })

      if (conversation) {
        const response = await request(app)
          .get(`/api/messages/conversations/${conversation.id}/messages`)
          .set('Authorization', `Bearer ${aliceToken}`)
        
        expect(response.status).toBe(200)
        // Messages endpoints return arrays directly, not wrapped objects
        expect(Array.isArray(response.body)).toBe(true)
        
        // Check that all media items have mediaType
        expectMessageMediaHaveType(response.body)
      }
    })
  })

  describe('Galleries API - mediaType Validation', () => {
    it('should include mediaType in gallery media', async () => {
      // Find a gallery with media
      const gallery = await testPrisma.gallery.findFirst({
        where: {
          media: {
            some: {}
          }
        }
      })

      if (gallery) {
        const response = await request(app)
          .get(`/api/galleries/${gallery.id}/media`)
          .set('Authorization', `Bearer ${aliceToken}`)
        
        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        
        // Check that all media items have mediaType
        expectAllMediaHaveType(response.body.data.media)
      }
    })

    it('should include mediaType in gallery details', async () => {
      // Find a gallery with media
      const gallery = await testPrisma.gallery.findFirst({
        where: {
          media: {
            some: {}
          }
        }
      })

      if (gallery) {
        const response = await request(app)
          .get(`/api/galleries/${gallery.id}`)
          .set('Authorization', `Bearer ${aliceToken}`)
        
        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        
        // Check that all media items have mediaType
        expectAllMediaHaveType(response.body.data.gallery.media)
      }
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle posts with no media gracefully', async () => {
      // Create a post without media
      const response = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          content: 'Post without media',
          visibility: 'PUBLIC'
        })
      
      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.data.post.media).toEqual([])
    })

    it('should validate mediaType values are valid enum values', async () => {
      const response = await request(app)
        .get('/api/posts')
        .set('Authorization', `Bearer ${aliceToken}`)
      
      expect(response.status).toBe(200)
      
      // Check that all mediaType values are valid
      response.body.data.posts.forEach((post: any) => {
        post.media.forEach((mediaItem: any) => {
          expect(mediaItem.mediaType).toBeDefined()
          expect(validateMediaType(mediaItem.mediaType)).toBe(true)
          expect(['IMAGE', 'VIDEO', 'ZIP']).toContain(mediaItem.mediaType)
        })
      })
    })

    it('should handle different media types correctly', async () => {
      const response = await request(app)
        .get(`/api/media/user/${alice!.id}`)
        .set('Authorization', `Bearer ${aliceToken}`)
      
      expect(response.status).toBe(200)
      
      // Verify we have different media types
      const foundTypes = response.body.data.media.map((m: any) => m.mediaType)
      const uniqueTypes = [...new Set(foundTypes)]
      
      // Should have at least one type
      expect(uniqueTypes.length).toBeGreaterThan(0)
      
      // All types should be valid
      uniqueTypes.forEach(type => {
        expect(validateMediaType(type)).toBe(true)
      })
    })

    it('should not have undefined or null mediaType values', async () => {
      const response = await request(app)
        .get('/api/posts')
        .set('Authorization', `Bearer ${aliceToken}`)
      
      expect(response.status).toBe(200)
      
      // Check that no mediaType is undefined or null
      response.body.data.posts.forEach((post: any) => {
        post.media.forEach((mediaItem: any) => {
          expect(mediaItem.mediaType).not.toBeUndefined()
          expect(mediaItem.mediaType).not.toBeNull()
          expect(mediaItem.mediaType).toBeTruthy()
        })
      })
    })
  })

  describe('Performance and Consistency', () => {
    it('should return consistent mediaType across different endpoints', async () => {
      // Get the same post from different endpoints
      const postWithMedia = await testPrisma.post.findFirst({
        where: {
          media: {
            some: {}
          }
        }
      })

      if (postWithMedia) {
        // Get from posts feed
        const feedResponse = await request(app)
          .get('/api/posts')
          .set('Authorization', `Bearer ${aliceToken}`)
        
        // Get from single post endpoint
        const singleResponse = await request(app)
          .get(`/api/posts/${postWithMedia.id}`)
          .set('Authorization', `Bearer ${aliceToken}`)
        
        expect(feedResponse.status).toBe(200)
        expect(singleResponse.status).toBe(200)
        
        // Find the same post in both responses
        const feedPost = feedResponse.body.data.posts.find((p: any) => p.id === postWithMedia.id)
        const singlePost = singleResponse.body.data.post
        
        if (feedPost && singlePost) {
          // Compare mediaType values
          feedPost.media.forEach((feedMediaItem: any, index: number) => {
            const singleMediaItem = singlePost.media[index]
            if (singleMediaItem) {
              expect(feedMediaItem.mediaType).toBe(singleMediaItem.mediaType)
            }
          })
        }
      }
    })
  })
})
