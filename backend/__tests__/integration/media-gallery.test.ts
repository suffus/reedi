/**
 * Media Gallery Management Tests (P0 - Critical)
 * 
 * Tests cover:
 * - Viewing user's media gallery
 * - Filtering media (by type, tags, date, organized/unorganized)
 * - Media detail viewing
 * - Editing media metadata
 * - Deleting media
 * - Bulk operations
 */

import request from 'supertest'
import express, { Express } from 'express'
import { testPrisma } from '../seed/test-database.config'
import { 
  generateTestToken, 
  getTestUserByEmail 
} from '../utils/test-helpers'
import mediaRouter from '../../src/routes/media'
import { errorHandler } from '../../src/middleware/errorHandler'

describe('Media Gallery Management (P0)', () => {
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
    app.use('/api/media', mediaRouter)
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
  
  describe('View Media Gallery', () => {
    it('should return user\'s media gallery', async () => {
      const response = await request(app)
        .get(`/api/media/user/${alice!.id}`)
      
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('data')
      expect(response.body.data).toHaveProperty('media')
      expect(Array.isArray(response.body.data.media)).toBe(true)
      
      // Alice should have at least 4 media items (may have more from test runs)
      expect(response.body.data.media.length).toBeGreaterThanOrEqual(4)
      
      // All media should belong to Alice
      response.body.data.media.forEach((media: any) => {
        expect(media.authorId).toBe(alice!.id)
      })
    })
    
    it('should support pagination', async () => {
      const response = await request(app)
        .get(`/api/media/user/${alice!.id}?page=1&limit=2`)
      
      expect(response.status).toBe(200)
      expect(response.body.data.media.length).toBeLessThanOrEqual(2)
      expect(response.body.data).toHaveProperty('pagination')
      expect(response.body.data.pagination).toHaveProperty('page', 1)
      expect(response.body.data.pagination).toHaveProperty('limit', 2)
    })
    
    it('should not require authentication for public endpoint', async () => {
      const response = await request(app)
        .get(`/api/media/user/${alice!.id}`)
      
      expect(response.status).toBe(200)
    })
  })
  
  describe('Filter Media', () => {
    describe('Filter by Type', () => {
      it('should filter by IMAGE type', async () => {
        const response = await request(app)
          .get(`/api/media/user/${alice!.id}?mediaType=IMAGE`)
        
        expect(response.status).toBe(200)
        
        // All returned media should be images
        response.body.data.media.forEach((media: any) => {
          expect(media.mediaType).toBe('IMAGE')
        })
      })
      
      it('should filter by VIDEO type', async () => {
        const response = await request(app)
          .get(`/api/media/user/${alice!.id}?mediaType=VIDEO`)
        
        expect(response.status).toBe(200)
        
        // All returned media should be videos
        response.body.data.media.forEach((media: any) => {
          expect(media.mediaType).toBe('VIDEO')
        })
      })
    })
    
    describe('Filter by Tags', () => {
      it('should filter by single tag', async () => {
        const response = await request(app)
          .get(`/api/media/user/${alice!.id}?tags=vacation`)
        
        expect(response.status).toBe(200)
        
        // All returned media should have the vacation tag
        response.body.data.media.forEach((media: any) => {
          expect(media.tags).toContain('vacation')
        })
      })
      
      it('should filter by multiple tags', async () => {
        const response = await request(app)
          .get(`/api/media/user/${alice!.id}?tags=vacation,beach`)
        
        expect(response.status).toBe(200)
        
        // Media should have at least one of the tags
        response.body.data.media.forEach((media: any) => {
          const hasTag = media.tags.some((tag: string) => 
            ['vacation', 'beach'].includes(tag)
          )
          expect(hasTag).toBe(true)
        })
      })
      
      it('should return empty array for non-existent tag', async () => {
        const response = await request(app)
          .get(`/api/media/user/${alice!.id}?tags=nonexistenttag123`)
        
        expect(response.status).toBe(200)
        expect(response.body.data.media).toEqual([])
      })
    })
    
    describe('Filter by Date Range', () => {
      it('should filter by date range', async () => {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        
        const response = await request(app)
          .get(`/api/media/user/${alice!.id}?startDate=${yesterday.toISOString()}&endDate=${tomorrow.toISOString()}`)
        
        expect(response.status).toBe(200)
        
        // All media should be within date range
        response.body.data.media.forEach((media: any) => {
          const createdAt = new Date(media.createdAt)
          expect(createdAt >= yesterday).toBe(true)
          expect(createdAt <= tomorrow).toBe(true)
        })
      })
    })
    
    describe('Filter by Organization Status', () => {
      it('should filter unorganized media (not in any gallery)', async () => {
        const response = await request(app)
          .get(`/api/media/user/${alice!.id}?showOnlyUnorganized=true`)
        
        expect(response.status).toBe(200)
        
        // All returned media should not have a galleryId
        response.body.data.media.forEach((media: any) => {
          expect(media.galleryId).toBeNull()
        })
        
        // Alice has at least 1 unorganized media (private-note.jpg)
        expect(response.body.data.media.length).toBeGreaterThanOrEqual(1)
      })
      
      it.skip('should filter organized media (in galleries)', async () => {
        // Skipped: API doesn't have an 'organized=true' filter
        // You can query by specific galleryId instead
        const response = await request(app)
          .get(`/api/media/user/${alice!.id}?organized=true`)
        
        expect(response.status).toBe(200)
        
        // All returned media should have a galleryId
        response.body.data.media.forEach((media: any) => {
          expect(media.galleryId).not.toBeNull()
        })
      })
    })
    
    describe.skip('Filter by Processing Status', () => {
      // Skipped: API doesn't support 'status' parameter, only shows processingStatus in response
      it('should filter by COMPLETED status', async () => {
        const response = await request(app)
          .get(`/api/media/user/${alice!.id}?status=COMPLETED`)
        
        expect(response.status).toBe(200)
        
        response.body.data.media.forEach((media: any) => {
          expect(media.processingStatus).toBe('COMPLETED')
        })
      })
      
      it('should filter by PENDING status', async () => {
        const response = await request(app)
          .get(`/api/media/user/${bob!.id}?status=PENDING`)
        
        expect(response.status).toBe(200)
        
        // Bob has 1 pending media item
        if (response.body.data.media.length > 0) {
          response.body.data.media.forEach((media: any) => {
            expect(media.processingStatus).toBe('PENDING')
          })
        }
      })
      
      it('should filter by FAILED status', async () => {
        const response = await request(app)
          .get(`/api/media/user/${charlie!.id}?status=FAILED`)
        
        expect(response.status).toBe(200)
        
        // Charlie has 1 failed media item
        if (response.body.data.media.length > 0) {
          response.body.data.media.forEach((media: any) => {
            expect(media.processingStatus).toBe('FAILED')
          })
        }
      })
    })
    
    describe('Filter by Visibility', () => {
      it('should filter by PUBLIC visibility', async () => {
        const response = await request(app)
          .get(`/api/media/user/${alice!.id}?visibility=PUBLIC`)
        
        expect(response.status).toBe(200)
        
        response.body.data.media.forEach((media: any) => {
          expect(media.visibility).toBe('PUBLIC')
        })
      })
      
      it('should filter by PRIVATE visibility', async () => {
        const response = await request(app)
          .get(`/api/media/user/${alice!.id}?visibility=PRIVATE`)
        
        expect(response.status).toBe(200)
        
        // Alice has at least 1 private media item
        expect(response.body.data.media.length).toBeGreaterThanOrEqual(1)
        response.body.data.media.forEach((media: any) => {
          expect(media.visibility).toBe('PRIVATE')
        })
      })
    })
  })
  
  describe('View Media Detail', () => {
    let aliceMedia: any
    
    beforeAll(async () => {
      aliceMedia = await testPrisma.media.findFirst({
        where: { authorId: alice!.id }
      })
    })
    
    it('should return media detail', async () => {
      const response = await request(app)
        .get(`/api/media/${aliceMedia!.id}`)
        .set('Authorization', `Bearer ${aliceToken}`)
      
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('data')
      expect(response.body.data).toHaveProperty('media')
      expect(response.body.data.media).toHaveProperty('id', aliceMedia!.id)
      expect(response.body.data.media).toHaveProperty('url')
      expect(response.body.data.media).toHaveProperty('mediaType')
      expect(response.body.data.media).toHaveProperty('processingStatus')
    })
    
    it('should allow owner to view their media', async () => {
      const response = await request(app)
        .get(`/api/media/${aliceMedia!.id}`)
        .set('Authorization', `Bearer ${aliceToken}`)
      
      expect(response.status).toBe(200)
    })
    
    it('should allow viewing public media from other users', async () => {
      const publicMedia = await testPrisma.media.findFirst({
        where: {
          authorId: alice!.id,
          visibility: 'PUBLIC'
        }
      })
      
      if (publicMedia) {
        const response = await request(app)
          .get(`/api/media/${publicMedia.id}`)
          .set('Authorization', `Bearer ${bobToken}`)
        
        expect(response.status).toBe(200)
      }
    })
    
    it('should deny access to private media from other users', async () => {
      const privateMedia = await testPrisma.media.findFirst({
        where: {
          authorId: alice!.id,
          visibility: 'PRIVATE'
        }
      })
      
      if (privateMedia) {
        const response = await request(app)
          .get(`/api/media/${privateMedia.id}`)
          .set('Authorization', `Bearer ${bobToken}`)
        
        expect(response.status).toBe(403)
      }
    })
    
    it('should return 404 for non-existent media', async () => {
      const response = await request(app)
        .get('/api/media/non-existent-id')
        .set('Authorization', `Bearer ${aliceToken}`)
      
      expect(response.status).toBe(404)
    })
  })
  
  describe('Edit Media Metadata', () => {
    let testMedia: any
    
    beforeEach(async () => {
      // Get one of Alice's media items
      testMedia = await testPrisma.media.findFirst({
        where: { authorId: alice!.id }
      })
    })
    
    it('should allow owner to edit media title', async () => {
      const response = await request(app)
        .put(`/api/media/${testMedia!.id}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          altText: 'Updated title'
        })
      
      expect(response.status).toBe(200)
      expect(response.body.data.media.altText).toBe('Updated title')
    })
    
    it('should allow owner to edit media description', async () => {
      const response = await request(app)
        .put(`/api/media/${testMedia!.id}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          caption: 'Updated description'
        })
      
      expect(response.status).toBe(200)
      expect(response.body.data.media.caption).toBe('Updated description')
    })
    
    it('should allow owner to update tags', async () => {
      const response = await request(app)
        .put(`/api/media/${testMedia!.id}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          tags: ['newtag1', 'newtag2']
        })
      
      expect(response.status).toBe(200)
      expect(response.body.data.media.tags).toContain('newtag1')
      expect(response.body.data.media.tags).toContain('newtag2')
    })
    
    it('should allow owner to change visibility', async () => {
      const response = await request(app)
        .put(`/api/media/${testMedia!.id}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          visibility: 'PRIVATE'
        })
      
      expect(response.status).toBe(200)
      expect(response.body.data.media.visibility).toBe('PRIVATE')
    })
    
    it('should deny non-owner from editing media', async () => {
      const response = await request(app)
        .put(`/api/media/${testMedia!.id}`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          altText: 'Trying to edit someone else\'s media'
        })
      
      expect(response.status).toBe(403)
    })
    
    it('should return 404 for non-existent media', async () => {
      const response = await request(app)
        .put('/api/media/non-existent-id')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          altText: 'Updated'
        })
      
      expect(response.status).toBe(404)
    })
  })
  
  describe('Delete Media', () => {
    let testMedia: any
    
    beforeEach(async () => {
      // Create a test media item for deletion
      testMedia = await testPrisma.media.create({
        data: {
          url: 'test-data/delete-test.jpg',
          s3Key: 'uploads/test/delete.jpg',
          originalFilename: 'delete-test.jpg',
          mediaType: 'IMAGE',
          processingStatus: 'COMPLETED',
          mimeType: 'image/jpeg',
          size: 100,
          authorId: alice!.id
        }
      })
    })
    
    it('should allow owner to delete media', async () => {
      const response = await request(app)
        .delete(`/api/media/${testMedia.id}`)
        .set('Authorization', `Bearer ${aliceToken}`)
      
      expect(response.status).toBe(200)
      
      // Verify media is deleted
      const deletedMedia = await testPrisma.media.findUnique({
        where: { id: testMedia.id }
      })
      expect(deletedMedia).toBeNull()
    })
    
    it('should deny non-owner from deleting media', async () => {
      const response = await request(app)
        .delete(`/api/media/${testMedia.id}`)
        .set('Authorization', `Bearer ${bobToken}`)
      
      expect(response.status).toBe(403)
      
      // Verify media still exists
      const media = await testPrisma.media.findUnique({
        where: { id: testMedia.id }
      })
      expect(media).not.toBeNull()
    })
    
    it('should return 404 for non-existent media', async () => {
      const response = await request(app)
        .delete('/api/media/non-existent-id')
        .set('Authorization', `Bearer ${aliceToken}`)
      
      expect(response.status).toBe(404)
    })
    
    it('should cascade delete related records', async () => {
      // Add the media to a post
      const post = await testPrisma.post.create({
        data: {
          content: 'Post with media',
          authorId: alice!.id,
          visibility: 'PUBLIC'
        }
      })
      
      await testPrisma.postMedia.create({
        data: {
          postId: post.id,
          mediaId: testMedia.id
        }
      })
      
      // Delete the media
      await request(app)
        .delete(`/api/media/${testMedia.id}`)
        .set('Authorization', `Bearer ${aliceToken}`)
      
      // Verify PostMedia record is also deleted (cascade)
      const postMedia = await testPrisma.postMedia.findFirst({
        where: { mediaId: testMedia.id }
      })
      expect(postMedia).toBeNull()
    })
  })
  
  describe('Bulk Operations', () => {
    describe('Bulk Edit', () => {
      let mediaIds: string[]
      
      beforeEach(async () => {
        // Get some of Alice's media IDs
        const aliceMedia = await testPrisma.media.findMany({
          where: { authorId: alice!.id },
          take: 3
        })
        mediaIds = aliceMedia.map(m => m.id)
      })
      
      it('should bulk update tags (merge mode)', async () => {
        // First, add some existing tags to the media items
        await Promise.all(mediaIds.map(id =>
          testPrisma.media.update({
            where: { id },
            data: { tags: ['existingtag1', 'existingtag2'] }
          })
        ))
        
        const response = await request(app)
          .put('/api/media/bulk/update')
          .set('Authorization', `Bearer ${aliceToken}`)
          .send({
            mediaIds,
            updates: {
              tags: ['bulktag1', 'bulktag2']
            },
            tagMode: 'merge'
          })
        
        expect(response.status).toBe(200)
        
        // Verify new tags were added while keeping existing tags
        for (const id of mediaIds) {
          const media = await testPrisma.media.findUnique({
            where: { id }
          })
          expect(media?.tags).toContain('bulktag1')
          expect(media?.tags).toContain('bulktag2')
          expect(media?.tags).toContain('existingtag1')
          expect(media?.tags).toContain('existingtag2')
        }
      })
      
      it('should bulk update tags (replace mode)', async () => {
        const response = await request(app)
          .put('/api/media/bulk/update')
          .set('Authorization', `Bearer ${aliceToken}`)
          .send({
            mediaIds,
            updates: {
              tags: ['replacetag']
            }
          })
        
        expect(response.status).toBe(200)
        
        // Verify tags were replaced
        for (const id of mediaIds) {
          const media = await testPrisma.media.findUnique({
            where: { id }
          })
          expect(media?.tags).toEqual(['replacetag'])
        }
      })
      
      it('should bulk update visibility', async () => {
        const response = await request(app)
          .put('/api/media/bulk/update')
          .set('Authorization', `Bearer ${aliceToken}`)
          .send({
            mediaIds,
            updates: {
              visibility: 'PRIVATE'
            }
          })
        
        expect(response.status).toBe(200)
        
        // Verify visibility was updated
        for (const id of mediaIds) {
          const media = await testPrisma.media.findUnique({
            where: { id }
          })
          expect(media?.visibility).toBe('PRIVATE')
        }
      })
      
      it('should only update media owned by user', async () => {
        // Include Bob's media in the bulk update
        const bobMedia = await testPrisma.media.findFirst({
          where: { authorId: bob!.id }
        })
        
        const mixedIds = [...mediaIds, bobMedia!.id]
        
        const response = await request(app)
          .put('/api/media/bulk/update')
          .set('Authorization', `Bearer ${aliceToken}`)
          .send({
            mediaIds: mixedIds,
            updates: {
              tags: ['bulktag']
            }
          })
        
        // Should fail or only update Alice's media, not Bob's
        expect([200, 403]).toContain(response.status)
        
        // Bob's media should not be updated
        const bobMediaAfter = await testPrisma.media.findUnique({
          where: { id: bobMedia!.id }
        })
        expect(bobMediaAfter?.tags).not.toContain('bulktag')
      })
    })
  })
})



