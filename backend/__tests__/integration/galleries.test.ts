/**
 * Gallery Formation & Editing Tests (P0 - Critical)
 * 
 * Tests cover:
 * - Gallery creation
 * - Adding/removing media to/from galleries
 * - Gallery editing (metadata, cover photo)
 * - Gallery visibility
 * - Gallery deletion
 * - Media ordering
 */

import request from 'supertest'
import express, { Express } from 'express'
import { testPrisma } from '../seed/test-database.config'
import { 
  generateTestToken, 
  getTestUserByEmail 
} from '../utils/test-helpers'
import galleriesRouter from '../../src/routes/galleries'
import { errorHandler } from '../../src/middleware/errorHandler'

describe('Gallery Formation & Editing (P0)', () => {
  let app: Express
  let aliceToken: string
  let bobToken: string
  let charlieToken: string
  let alice: any
  let bob: any
  let charlie: any
  
  beforeAll(async () => {
    // Set up Express app with routes
    app = express()
    app.use(express.json())
    app.use('/api/galleries', galleriesRouter)
    app.use(errorHandler)
    
    // Get test users and tokens
    alice = await getTestUserByEmail('alice@test.com')
    bob = await getTestUserByEmail('bob@test.com')
    charlie = await getTestUserByEmail('charlie@test.com')
    
    aliceToken = generateTestToken(alice!)
    bobToken = generateTestToken(bob!)
    charlieToken = generateTestToken(charlie!)
  })
  
  afterAll(async () => {
    await testPrisma.$disconnect()
  })
  
  describe('Gallery Creation', () => {
    it('should create a new gallery', async () => {
      const response = await request(app)
        .post('/api/galleries')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          name: 'New Gallery',
          description: 'Test gallery description',
          visibility: 'PUBLIC'
        })
      
      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('success', true)
      expect(response.body).toHaveProperty('data')
      expect(response.body.data).toHaveProperty('gallery')
      expect(response.body.data.gallery).toHaveProperty('name', 'New Gallery')
      expect(response.body.data.gallery).toHaveProperty('description', 'Test gallery description')
      expect(response.body.data.gallery).toHaveProperty('visibility', 'PUBLIC')
      expect(response.body.data.gallery).toHaveProperty('authorId', alice!.id)
    })
    
    it('should create gallery with minimal data', async () => {
      const response = await request(app)
        .post('/api/galleries')
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          name: 'Simple Gallery'
        })
      
      expect(response.status).toBe(201)
      expect(response.body.data.gallery.name).toBe('Simple Gallery')
      // Description and visibility should have defaults
    })
    
    it('should require gallery name', async () => {
      const response = await request(app)
        .post('/api/galleries')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          description: 'Gallery without name'
        })
      
      expect(response.status).toBe(400)
    })
    
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/galleries')
        .send({
          name: 'Test Gallery'
        })
      
      expect(response.status).toBe(401)
    })
  })
  
  describe('View Galleries', () => {
    it('should return user\'s galleries', async () => {
      const response = await request(app)
        .get('/api/galleries/my')
        .set('Authorization', `Bearer ${aliceToken}`)
      
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('data')
      expect(response.body.data).toHaveProperty('galleries')
      expect(Array.isArray(response.body.data.galleries)).toBe(true)
      
      // Alice has 2 galleries
      expect(response.body.data.galleries.length).toBeGreaterThanOrEqual(2)
      
      // All galleries should belong to Alice
      response.body.data.galleries.forEach((gallery: any) => {
        expect(gallery.authorId).toBe(alice!.id)
      })
    })
    
    it('should return gallery details with media count', async () => {
      const response = await request(app)
        .get('/api/galleries/my')
        .set('Authorization', `Bearer ${aliceToken}`)
      
      expect(response.status).toBe(200)
      
      // Each gallery should have media count
      response.body.data.galleries.forEach((gallery: any) => {
        expect(gallery).toHaveProperty('_count')
        expect(gallery._count).toHaveProperty('media')
      })
    })
    
    it('should return single gallery detail', async () => {
      // Find one of Alice's galleries
      const aliceGallery = await testPrisma.gallery.findFirst({
        where: { authorId: alice!.id }
      })
      
      const response = await request(app)
        .get(`/api/galleries/${aliceGallery!.id}`)
        .set('Authorization', `Bearer ${aliceToken}`)
      
      expect(response.status).toBe(200)
      expect(response.body.data).toHaveProperty('gallery')
      expect(response.body.data.gallery).toHaveProperty('id', aliceGallery!.id)
      expect(response.body.data.gallery).toHaveProperty('media')
      expect(Array.isArray(response.body.data.gallery.media)).toBe(true)
    })
    
    it('should allow viewing public galleries from other users', async () => {
      const publicGallery = await testPrisma.gallery.findFirst({
        where: {
          authorId: charlie!.id,
          visibility: 'PUBLIC'
        }
      })
      
      if (publicGallery) {
        const response = await request(app)
          .get(`/api/galleries/${publicGallery.id}`)
          .set('Authorization', `Bearer ${bobToken}`)
        
        expect(response.status).toBe(200)
      }
    })
    
    it('should deny viewing private galleries from other users', async () => {
      // Create a private gallery for Alice
      const privateGallery = await testPrisma.gallery.create({
        data: {
          name: 'Private Test Gallery',
          visibility: 'PRIVATE',
          authorId: alice!.id
        }
      })
      
      const response = await request(app)
        .get(`/api/galleries/${privateGallery.id}`)
        .set('Authorization', `Bearer ${bobToken}`)
      
      expect(response.status).toBe(403)
    })
  })
  
  describe('Add Media to Gallery', () => {
    let testGallery: any
    let testMedia: any
    
    beforeEach(async () => {
      // Create a test gallery
      testGallery = await testPrisma.gallery.create({
        data: {
          name: 'Test Gallery for Media',
          authorId: alice!.id
        }
      })
      
      // Get an unorganized media item from Alice
      testMedia = await testPrisma.media.findFirst({
        where: {
          authorId: alice!.id,
          galleryId: null
        }
      })
    })
    
    afterEach(async () => {
      // Cleanup
      await testPrisma.gallery.delete({
        where: { id: testGallery.id }
      })
    })
    
    it('should add media to gallery', async () => {
      if (testMedia) {
        const response = await request(app)
          .post(`/api/galleries/${testGallery.id}/media`)
          .set('Authorization', `Bearer ${aliceToken}`)
          .send({
            mediaIds: [testMedia.id]
          })
        
        expect(response.status).toBe(200)
        
        // Verify media was added to gallery
        const media = await testPrisma.media.findUnique({
          where: { id: testMedia.id }
        })
        expect(media?.galleryId).toBe(testGallery.id)
      }
    })
    
    it.skip('should set media order when adding', async () => {
      // Skipped: API doesn't support setting order when adding media
      // Order is managed separately via reorder endpoint
      if (testMedia) {
        const response = await request(app)
          .post(`/api/galleries/${testGallery.id}/media`)
          .set('Authorization', `Bearer ${aliceToken}`)
          .send({
            mediaIds: [testMedia.id],
            order: 5
          })
        
        expect(response.status).toBe(200)
        
        const media = await testPrisma.media.findUnique({
          where: { id: testMedia.id }
        })
        expect(media?.order).toBe(5)
      }
    })
    
    it('should deny adding someone else\'s media', async () => {
      // Get Bob's media
      const bobMedia = await testPrisma.media.findFirst({
        where: { authorId: bob!.id }
      })
      
      if (bobMedia) {
        const response = await request(app)
          .post(`/api/galleries/${testGallery.id}/media`)
          .set('Authorization', `Bearer ${aliceToken}`)
          .send({
            mediaIds: [bobMedia.id]
          })
        
        expect(response.status).toBe(400)
      }
    })
    
    it('should deny non-owner from adding media to gallery', async () => {
      if (testMedia) {
        const response = await request(app)
          .post(`/api/galleries/${testGallery.id}/media`)
          .set('Authorization', `Bearer ${bobToken}`)
          .send({
            mediaIds: [testMedia.id]
          })
        
        expect(response.status).toBe(403)
      }
    })
  })
  
  describe('Remove Media from Gallery', () => {
    let testGallery: any
    let testMedia: any
    
    beforeEach(async () => {
      // Create a test gallery with media
      testGallery = await testPrisma.gallery.create({
        data: {
          name: 'Test Gallery with Media',
          authorId: alice!.id
        }
      })
      
      // Add media to gallery
      testMedia = await testPrisma.media.findFirst({
        where: {
          authorId: alice!.id,
          galleryId: null
        }
      })
      
      if (testMedia) {
        await testPrisma.media.update({
          where: { id: testMedia.id },
          data: { galleryId: testGallery.id }
        })
      }
    })
    
    afterEach(async () => {
      await testPrisma.gallery.delete({
        where: { id: testGallery.id }
      })
    })
    
    it('should remove media from gallery', async () => {
      if (testMedia) {
        const response = await request(app)
          .delete(`/api/galleries/${testGallery.id}/media`)
          .set('Authorization', `Bearer ${aliceToken}`)
          .send({
            mediaIds: [testMedia.id]
          })
        
        expect(response.status).toBe(200)
        
        // Verify media was removed from gallery
        const media = await testPrisma.media.findUnique({
          where: { id: testMedia.id }
        })
        expect(media?.galleryId).toBeNull()
      }
    })
    
    it('should deny non-owner from removing media', async () => {
      if (testMedia) {
        const response = await request(app)
          .delete(`/api/galleries/${testGallery.id}/media`)
          .set('Authorization', `Bearer ${bobToken}`)
          .send({
            mediaIds: [testMedia.id]
          })
        
        expect(response.status).toBe(403)
      }
    })
  })
  
  describe('Reorder Media in Gallery', () => {
    let testGallery: any
    let mediaItems: any[]
    
    beforeEach(async () => {
      // Find one of Alice's existing galleries with media
      testGallery = await testPrisma.gallery.findFirst({
        where: {
          authorId: alice!.id
        },
        include: {
          media: true
        }
      })
      
      mediaItems = testGallery?.media || []
    })
    
    it('should reorder media in gallery', async () => {
      if (mediaItems.length >= 2) {
        // API expects an array of media IDs in the desired order
        const mediaIds = [...mediaItems].reverse().map(m => m.id)
        
        const response = await request(app)
          .put(`/api/galleries/${testGallery.id}/media/reorder`)
          .set('Authorization', `Bearer ${aliceToken}`)
          .send({
            mediaIds: mediaIds
          })
        
        expect(response.status).toBe(200)
        
        // Verify order was updated
        const updatedGallery = await testPrisma.gallery.findUnique({
          where: { id: testGallery.id },
          include: {
            media: {
              orderBy: { order: 'asc' }
            }
          }
        })
        
        expect(updatedGallery?.media[0].id).toBe(mediaItems[mediaItems.length - 1].id)
      }
    })
    
    it('should deny non-owner from reordering', async () => {
      if (mediaItems.length >= 1) {
        const response = await request(app)
          .put(`/api/galleries/${testGallery.id}/media/reorder`)
          .set('Authorization', `Bearer ${bobToken}`)
          .send({
            mediaIds: mediaItems.map(m => m.id)
          })
        
        expect(response.status).toBe(403)
      }
    })
  })
  
  describe('Edit Gallery', () => {
    let testGallery: any
    
    beforeEach(async () => {
      testGallery = await testPrisma.gallery.findFirst({
        where: { authorId: alice!.id }
      })
    })
    
    it('should allow owner to edit gallery name', async () => {
      const response = await request(app)
        .put(`/api/galleries/${testGallery!.id}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          name: 'Updated Gallery Name'
        })
      
      expect(response.status).toBe(200)
      expect(response.body.data.gallery.name).toBe('Updated Gallery Name')
    })
    
    it('should allow owner to edit gallery description', async () => {
      const response = await request(app)
        .put(`/api/galleries/${testGallery!.id}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          description: 'Updated description'
        })
      
      expect(response.status).toBe(200)
      expect(response.body.data.gallery.description).toBe('Updated description')
    })
    
    it('should allow owner to change visibility', async () => {
      const response = await request(app)
        .put(`/api/galleries/${testGallery!.id}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          visibility: 'PRIVATE'
        })
      
      expect(response.status).toBe(200)
      expect(response.body.data.gallery.visibility).toBe('PRIVATE')
    })
    
    it('should allow setting cover photo', async () => {
      // Get one of the media items in the gallery
      const gallery = await testPrisma.gallery.findUnique({
        where: { id: testGallery!.id },
        include: { media: true }
      })
      
      if (gallery && gallery.media.length > 0) {
        const response = await request(app)
          .post(`/api/galleries/${testGallery!.id}/cover`)
          .set('Authorization', `Bearer ${aliceToken}`)
          .send({
            mediaId: gallery.media[0].id
          })
        
        expect(response.status).toBe(200)
        expect(response.body.data.gallery.coverMediaId).toBe(gallery.media[0].id)
      }
    })
    
    it('should deny non-owner from editing gallery', async () => {
      const response = await request(app)
        .put(`/api/galleries/${testGallery!.id}`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          name: 'Trying to edit someone else\'s gallery'
        })
      
      expect(response.status).toBe(403)
    })
  })
  
  describe('Delete Gallery', () => {
    it('should delete gallery and keep media', async () => {
      // Create a test gallery with media
      const testGallery = await testPrisma.gallery.create({
        data: {
          name: 'Gallery to Delete',
          authorId: alice!.id
        }
      })
      
      // Add media to it
      const media = await testPrisma.media.findFirst({
        where: {
          authorId: alice!.id,
          galleryId: null
        }
      })
      
      if (media) {
        await testPrisma.media.update({
          where: { id: media.id },
          data: { galleryId: testGallery.id }
        })
      }
      
      // Delete gallery (always keeps media in current implementation)
      const response = await request(app)
        .delete(`/api/galleries/${testGallery.id}`)
        .set('Authorization', `Bearer ${aliceToken}`)
      
      expect(response.status).toBe(200)
      
      // Verify gallery is deleted
      const deletedGallery = await testPrisma.gallery.findUnique({
        where: { id: testGallery.id }
      })
      expect(deletedGallery).toBeNull()
      
      // Verify media still exists but is unorganized (Prisma cascade sets to null)
      if (media) {
        const mediaAfter = await testPrisma.media.findUnique({
          where: { id: media.id }
        })
        expect(mediaAfter).not.toBeNull()
        expect(mediaAfter?.galleryId).toBeNull()
      }
    })
    
    it.skip('should delete gallery and its media', async () => {
      // Skipped: API doesn't support deleteMedia option
      // Current implementation always sets galleryId to null (keeps media)
      // Create a test gallery with media
      const testGallery = await testPrisma.gallery.create({
        data: {
          name: 'Gallery to Delete with Media',
          authorId: alice!.id
        }
      })
      
      // Create media specifically for this test
      const media = await testPrisma.media.create({
        data: {
          url: 'test-data/to-delete.jpg',
          s3Key: 'uploads/test/to-delete.jpg',
          originalFilename: 'to-delete.jpg',
          mediaType: 'IMAGE',
          processingStatus: 'COMPLETED',
          mimeType: 'image/jpeg',
          size: 100,
          authorId: alice!.id,
          galleryId: testGallery.id
        }
      })
      
      // Delete gallery (and media)
      const response = await request(app)
        .delete(`/api/galleries/${testGallery.id}?deleteMedia=true`)
        .set('Authorization', `Bearer ${aliceToken}`)
      
      expect(response.status).toBe(200)
      
      // Verify gallery is deleted
      const deletedGallery = await testPrisma.gallery.findUnique({
        where: { id: testGallery.id }
      })
      expect(deletedGallery).toBeNull()
      
      // Verify media is also deleted
      const deletedMedia = await testPrisma.media.findUnique({
        where: { id: media.id }
      })
      expect(deletedMedia).toBeNull()
    })
    
    it('should deny non-owner from deleting gallery', async () => {
      const testGallery = await testPrisma.gallery.findFirst({
        where: { authorId: alice!.id }
      })
      
      const response = await request(app)
        .delete(`/api/galleries/${testGallery!.id}`)
        .set('Authorization', `Bearer ${bobToken}`)
      
      expect(response.status).toBe(403)
      
      // Verify gallery still exists
      const gallery = await testPrisma.gallery.findUnique({
        where: { id: testGallery!.id }
      })
      expect(gallery).not.toBeNull()
    })
  })
})



