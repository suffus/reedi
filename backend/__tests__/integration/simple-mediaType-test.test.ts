/**
 * Simple MediaType Validation Tests
 * 
 * Basic tests to ensure mediaType is present in API responses
 * without complex Zod validation that might be too strict.
 */

import request from 'supertest'
import express, { Express } from 'express'
import { testPrisma } from '../seed/test-database.config'
import { 
  generateTestToken, 
  getTestUserByEmail 
} from '../utils/test-helpers'
import postsRouter from '../../src/routes/posts'
import mediaRouter from '../../src/routes/media'
import messagesRouter from '../../src/routes/messages'
import galleriesRouter from '../../src/routes/galleries'
import searchRouter from '../../src/routes/search'
import { errorHandler } from '../../src/middleware/errorHandler'

describe('Simple MediaType Validation Tests', () => {
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

  describe('Posts API - mediaType Presence', () => {
    it('should include mediaType in posts feed when media exists', async () => {
      const response = await request(app)
        .get('/api/posts')
        .set('Authorization', `Bearer ${aliceToken}`)
      
      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      
      // Find posts with media and check mediaType
      const postsWithMedia = response.body.data.posts.filter((post: any) => 
        post.media && Array.isArray(post.media) && post.media.length > 0
      )
      
      if (postsWithMedia.length > 0) {
        postsWithMedia.forEach((post: any) => {
          post.media.forEach((mediaItem: any) => {
            if (mediaItem.media) {
              expect(mediaItem.media.mediaType).toBeDefined()
              expect(['IMAGE', 'VIDEO', 'ZIP']).toContain(mediaItem.media.mediaType)
            }
          })
        })
      }
    })

    it('should include mediaType in personalized feed when media exists', async () => {
      const response = await request(app)
        .get('/api/posts/feed')
        .set('Authorization', `Bearer ${aliceToken}`)
      
      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      
      // Find posts with media and check mediaType
      const postsWithMedia = response.body.data.posts.filter((post: any) => 
        post.media && Array.isArray(post.media) && post.media.length > 0
      )
      
      if (postsWithMedia.length > 0) {
        postsWithMedia.forEach((post: any) => {
          post.media.forEach((mediaItem: any) => {
            if (mediaItem.media) {
              expect(mediaItem.media.mediaType).toBeDefined()
              expect(['IMAGE', 'VIDEO', 'ZIP']).toContain(mediaItem.media.mediaType)
            }
          })
        })
      }
    })

    it('should include mediaType in user public posts when media exists', async () => {
      const response = await request(app)
        .get(`/api/posts/user/${alice!.id}/public`)
        .set('Authorization', `Bearer ${bobToken}`)
      
      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      
      // Find posts with media and check mediaType
      const postsWithMedia = response.body.data.posts.filter((post: any) => 
        post.media && Array.isArray(post.media) && post.media.length > 0
      )
      
      if (postsWithMedia.length > 0) {
        postsWithMedia.forEach((post: any) => {
          post.media.forEach((mediaItem: any) => {
            if (mediaItem.media) {
              expect(mediaItem.media.mediaType).toBeDefined()
              expect(['IMAGE', 'VIDEO', 'ZIP']).toContain(mediaItem.media.mediaType)
            }
          })
        })
      }
    })

    it('should include mediaType in single post when media exists', async () => {
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
        if (response.body.data.post.media && Array.isArray(response.body.data.post.media)) {
          response.body.data.post.media.forEach((mediaItem: any) => {
            if (mediaItem.media) {
              expect(mediaItem.media.mediaType).toBeDefined()
              expect(['IMAGE', 'VIDEO', 'ZIP']).toContain(mediaItem.media.mediaType)
            }
          })
        }
      }
    })
  })

  describe('Media API - mediaType Presence', () => {
    it('should include mediaType in user media', async () => {
      const response = await request(app)
        .get(`/api/media/user/${alice!.id}`)
        .set('Authorization', `Bearer ${aliceToken}`)
      
      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      
      // Check that all media items have mediaType
      if (response.body.data.media && Array.isArray(response.body.data.media)) {
        response.body.data.media.forEach((media: any) => {
          expect(media.mediaType).toBeDefined()
          expect(['IMAGE', 'VIDEO', 'ZIP']).toContain(media.mediaType)
        })
      }
    })

    it('should include mediaType in public user media', async () => {
      const response = await request(app)
        .get(`/api/media/user/${alice!.id}/public`)
        .set('Authorization', `Bearer ${bobToken}`)
      
      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      
      // Check that all media items have mediaType
      if (response.body.data.media && Array.isArray(response.body.data.media)) {
        response.body.data.media.forEach((media: any) => {
          expect(media.mediaType).toBeDefined()
          expect(['IMAGE', 'VIDEO', 'ZIP']).toContain(media.mediaType)
        })
      }
    })
  })

  describe('Messages API - mediaType Presence', () => {
    it('should include mediaType in conversations when media exists', async () => {
      const response = await request(app)
        .get('/api/messages/conversations')
        .set('Authorization', `Bearer ${aliceToken}`)
      
      expect(response.status).toBe(200)
      
      // Check that all media items in last messages have mediaType
      if (response.body.data && response.body.data.conversations) {
        response.body.data.conversations.forEach((conversation: any) => {
          if (conversation.lastMessage?.media) {
            expect(conversation.lastMessage.media.mediaType).toBeDefined()
            expect(['IMAGE', 'VIDEO', 'ZIP']).toContain(conversation.lastMessage.media.mediaType)
          }
        })
      }
    })

    it('should include mediaType in messages when media exists', async () => {
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
        
        // Check that all media items have mediaType
        if (response.body.data && response.body.data.messages) {
          response.body.data.messages.forEach((message: any) => {
            if (message.media) {
              expect(message.media.mediaType).toBeDefined()
              expect(['IMAGE', 'VIDEO', 'ZIP']).toContain(message.media.mediaType)
            }
            
            if (message.mediaItems && Array.isArray(message.mediaItems)) {
              message.mediaItems.forEach((mediaItem: any) => {
                if (mediaItem.media) {
                  expect(mediaItem.media.mediaType).toBeDefined()
                  expect(['IMAGE', 'VIDEO', 'ZIP']).toContain(mediaItem.media.mediaType)
                }
              })
            }
          })
        }
      }
    })
  })

  describe('Galleries API - mediaType Presence', () => {
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
        if (response.body.data.media && Array.isArray(response.body.data.media)) {
          response.body.data.media.forEach((media: any) => {
            expect(media.mediaType).toBeDefined()
            expect(['IMAGE', 'VIDEO', 'ZIP']).toContain(media.mediaType)
          })
        }
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
        if (response.body.data.gallery && response.body.data.gallery.media) {
          response.body.data.gallery.media.forEach((media: any) => {
            expect(media.mediaType).toBeDefined()
            expect(['IMAGE', 'VIDEO', 'ZIP']).toContain(media.mediaType)
          })
        }
      }
    })
  })

  describe('Edge Cases', () => {
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

    it('should not have undefined or null mediaType values', async () => {
      const response = await request(app)
        .get('/api/posts')
        .set('Authorization', `Bearer ${aliceToken}`)
      
      expect(response.status).toBe(200)
      
      // Check that no mediaType is undefined or null
      response.body.data.posts.forEach((post: any) => {
        if (post.media && Array.isArray(post.media)) {
          post.media.forEach((mediaItem: any) => {
            if (mediaItem.media) {
              expect(mediaItem.media.mediaType).not.toBeUndefined()
              expect(mediaItem.media.mediaType).not.toBeNull()
              expect(mediaItem.media.mediaType).toBeTruthy()
            }
          })
        }
      })
    })
  })
})
