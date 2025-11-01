/**
 * Media Deletion Invalidation Integration Tests
 * 
 * Tests cover:
 * - Media deletion removes media from galleries
 * - Media deletion refreshes related queries
 * - Deleting media updates gallery media lists
 * - Removing media from gallery updates media lists
 * - Cascade deletion behavior
 */

import request from 'supertest'
import express, { Express } from 'express'
import { testPrisma } from '../seed/test-database.config'
import { 
  generateTestToken, 
  getTestUserByEmail 
} from '../utils/test-helpers'
import mediaRouter from '../../src/routes/media'
import galleriesRouter from '../../src/routes/galleries'
import { errorHandler } from '../../src/middleware/errorHandler'

describe('Media Deletion Invalidation (Integration)', () => {
  let app: Express
  let aliceToken: string
  let alice: any

  beforeAll(async () => {
    // Set up Express app with routes
    app = express()
    app.use(express.json())
    app.use('/api/media', mediaRouter)
    app.use('/api/galleries', galleriesRouter)
    app.use(errorHandler)
    
    // Get test user and token
    alice = await getTestUserByEmail('alice@test.com')
    aliceToken = generateTestToken(alice!)
  })
  
  afterAll(async () => {
    await testPrisma.$disconnect()
  })

  describe('Delete Media from Gallery', () => {
    it('should remove media from gallery and update gallery media list', async () => {
      // Create a gallery
      const galleryResponse = await request(app)
        .post('/api/galleries')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          name: 'Test Gallery for Deletion',
          description: 'Testing media removal',
          visibility: 'PUBLIC'
        })
        .expect(201)

      const galleryId = galleryResponse.body.data.gallery.id

      // Create media items
      const media1 = await testPrisma.media.create({
        data: {
          url: 'test-data/delete-test1.jpg',
          s3Key: 'uploads/test/delete1.jpg',
          originalFilename: 'delete-test1.jpg',
          mediaType: 'IMAGE',
          processingStatus: 'COMPLETED',
          mimeType: 'image/jpeg',
          size: 100,
          authorId: alice!.id
        }
      })

      const media2 = await testPrisma.media.create({
        data: {
          url: 'test-data/delete-test2.jpg',
          s3Key: 'uploads/test/delete2.jpg',
          originalFilename: 'delete-test2.jpg',
          mediaType: 'IMAGE',
          processingStatus: 'COMPLETED',
          mimeType: 'image/jpeg',
          size: 100,
          authorId: alice!.id
        }
      })

      // Add media to gallery
      await request(app)
        .post(`/api/galleries/${galleryId}/media`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ mediaIds: [media1.id, media2.id] })
        .expect(200)

      // Verify media are in gallery
      const galleryBefore = await request(app)
        .get(`/api/galleries/${galleryId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(200)

      expect(galleryBefore.body.data.gallery.media.length).toBe(2)

      // Remove one media from gallery
      await request(app)
        .delete(`/api/galleries/${galleryId}/media`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ mediaIds: [media1.id] })
        .expect(200)

      // Verify media is removed from gallery
      const galleryAfter = await request(app)
        .get(`/api/galleries/${galleryId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(200)

      expect(galleryAfter.body.data.gallery.media.length).toBe(1)
      expect(galleryAfter.body.data.gallery.media[0].id).toBe(media2.id)

      // Verify media still exists (only removed from gallery, not deleted)
      const mediaStillExists = await testPrisma.media.findUnique({
        where: { id: media1.id }
      })
      expect(mediaStillExists).toBeTruthy()

      // Clean up
      await testPrisma.media.deleteMany({
        where: { id: { in: [media1.id, media2.id] } }
      })
      await request(app)
        .delete(`/api/galleries/${galleryId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
    })

    it('should update user media list after removing media from gallery', async () => {
      // Create a gallery
      const galleryResponse = await request(app)
        .post('/api/galleries')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          name: 'Gallery for Media List Test',
          description: 'Testing',
          visibility: 'PUBLIC'
        })
        .expect(201)

      const galleryId = galleryResponse.body.data.gallery.id

      // Create media item
      const testMedia = await testPrisma.media.create({
        data: {
          url: 'test-data/media-list-test.jpg',
          s3Key: 'uploads/test/media-list-test.jpg',
          originalFilename: 'media-list-test.jpg',
          mediaType: 'IMAGE',
          processingStatus: 'COMPLETED',
          mimeType: 'image/jpeg',
          size: 100,
          authorId: alice!.id
        }
      })

      // Add media to gallery
      await request(app)
        .post(`/api/galleries/${galleryId}/media`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ mediaIds: [testMedia.id] })
        .expect(200)

      // Get user media list before removal
      const mediaListBefore = await request(app)
        .get(`/api/media/user/${alice!.id}?page=1&limit=100`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(200)

      const foundBefore = mediaListBefore.body.data.media.find(
        (m: any) => m.id === testMedia.id && m.galleryId === galleryId
      )
      expect(foundBefore).toBeTruthy()

      // Remove media from gallery
      await request(app)
        .delete(`/api/galleries/${galleryId}/media`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ mediaIds: [testMedia.id] })
        .expect(200)

      // Get user media list after removal
      const mediaListAfter = await request(app)
        .get(`/api/media/user/${alice!.id}?page=1&limit=100`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(200)

      const foundAfter = mediaListAfter.body.data.media.find(
        (m: any) => m.id === testMedia.id
      )
      
      // Media should still exist but galleryId should be null or different
      expect(foundAfter).toBeTruthy()
      expect(foundAfter?.galleryId).not.toBe(galleryId)

      // Clean up
      await testPrisma.media.delete({ where: { id: testMedia.id } })
      await request(app)
        .delete(`/api/galleries/${galleryId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
    })
  })

  describe('Delete Media Entirely', () => {
    it('should remove media from gallery when media is deleted', async () => {
      // Create a gallery
      const galleryResponse = await request(app)
        .post('/api/galleries')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          name: 'Gallery for Cascade Delete Test',
          description: 'Testing',
          visibility: 'PUBLIC'
        })
        .expect(201)

      const galleryId = galleryResponse.body.data.gallery.id

      // Create media item
      const testMedia = await testPrisma.media.create({
        data: {
          url: 'test-data/cascade-delete-test.jpg',
          s3Key: 'uploads/test/cascade-delete-test.jpg',
          originalFilename: 'cascade-delete-test.jpg',
          mediaType: 'IMAGE',
          processingStatus: 'COMPLETED',
          mimeType: 'image/jpeg',
          size: 100,
          authorId: alice!.id
        }
      })

      // Add media to gallery
      await request(app)
        .post(`/api/galleries/${galleryId}/media`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ mediaIds: [testMedia.id] })
        .expect(200)

      // Verify media is in gallery
      const galleryBefore = await request(app)
        .get(`/api/galleries/${galleryId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(200)

      expect(galleryBefore.body.data.gallery.media.length).toBe(1)
      expect(galleryBefore.body.data.gallery.media[0].id).toBe(testMedia.id)

      // Delete the media entirely
      await request(app)
        .delete(`/api/media/${testMedia.id}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(200)

      // Verify media is deleted from database
      const deletedMedia = await testPrisma.media.findUnique({
        where: { id: testMedia.id }
      })
      expect(deletedMedia).toBeNull()

      // Verify media is removed from gallery
      const galleryAfter = await request(app)
        .get(`/api/galleries/${galleryId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(200)

      expect(galleryAfter.body.data.gallery.media.length).toBe(0)

      // Clean up gallery
      await request(app)
        .delete(`/api/galleries/${galleryId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
    })

    it('should remove media from user media list after deletion', async () => {
      // Create media item
      const testMedia = await testPrisma.media.create({
        data: {
          url: 'test-data/user-list-delete-test.jpg',
          s3Key: 'uploads/test/user-list-delete-test.jpg',
          originalFilename: 'user-list-delete-test.jpg',
          mediaType: 'IMAGE',
          processingStatus: 'COMPLETED',
          mimeType: 'image/jpeg',
          size: 100,
          authorId: alice!.id
        }
      })

      // Get user media list before deletion
      const mediaListBefore = await request(app)
        .get(`/api/media/user/${alice!.id}?page=1&limit=100`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(200)

      const foundBefore = mediaListBefore.body.data.media.find(
        (m: any) => m.id === testMedia.id
      )
      expect(foundBefore).toBeTruthy()

      // Delete the media
      await request(app)
        .delete(`/api/media/${testMedia.id}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(200)

      // Get user media list after deletion
      const mediaListAfter = await request(app)
        .get(`/api/media/user/${alice!.id}?page=1&limit=100`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(200)

      const foundAfter = mediaListAfter.body.data.media.find(
        (m: any) => m.id === testMedia.id
      )
      expect(foundAfter).toBeFalsy()
    })

    it('should cascade delete PostMedia relationships when media is deleted', async () => {
      // Create a post
      const post = await testPrisma.post.create({
        data: {
          content: 'Post with media for cascade test',
          authorId: alice!.id,
          visibility: 'PUBLIC'
        }
      })

      // Create media item
      const testMedia = await testPrisma.media.create({
        data: {
          url: 'test-data/cascade-post-media-test.jpg',
          s3Key: 'uploads/test/cascade-post-media-test.jpg',
          originalFilename: 'cascade-post-media-test.jpg',
          mediaType: 'IMAGE',
          processingStatus: 'COMPLETED',
          mimeType: 'image/jpeg',
          size: 100,
          authorId: alice!.id
        }
      })

      // Link media to post
      await testPrisma.postMedia.create({
        data: {
          postId: post.id,
          mediaId: testMedia.id,
          order: 0
        }
      })

      // Verify PostMedia relationship exists
      const postMediaBefore = await testPrisma.postMedia.findFirst({
        where: { mediaId: testMedia.id }
      })
      expect(postMediaBefore).toBeTruthy()

      // Delete the media
      await request(app)
        .delete(`/api/media/${testMedia.id}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(200)

      // Verify PostMedia relationship is cascade deleted
      const postMediaAfter = await testPrisma.postMedia.findFirst({
        where: { mediaId: testMedia.id }
      })
      expect(postMediaAfter).toBeNull()

      // Clean up post
      await testPrisma.post.delete({ where: { id: post.id } })
    })
  })

  describe('Media List Refresh After Operations', () => {
    it('should reflect media deletions in filtered media queries', async () => {
      // Create media with specific tags
      const testMedia = await testPrisma.media.create({
        data: {
          url: 'test-data/filtered-delete-test.jpg',
          s3Key: 'uploads/test/filtered-delete-test.jpg',
          originalFilename: 'filtered-delete-test.jpg',
          mediaType: 'IMAGE',
          processingStatus: 'COMPLETED',
          mimeType: 'image/jpeg',
          size: 100,
          tags: ['test-tag', 'filter-test'],
          authorId: alice!.id
        }
      })

      // Query filtered media by tag
      const filteredBefore = await request(app)
        .get(`/api/media/user/${alice!.id}?tags=test-tag&page=1&limit=100`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(200)

      const foundBefore = filteredBefore.body.data.media.find(
        (m: any) => m.id === testMedia.id
      )
      expect(foundBefore).toBeTruthy()

      // Delete the media
      await request(app)
        .delete(`/api/media/${testMedia.id}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(200)

      // Query filtered media again
      const filteredAfter = await request(app)
        .get(`/api/media/user/${alice!.id}?tags=test-tag&page=1&limit=100`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(200)

      const foundAfter = filteredAfter.body.data.media.find(
        (m: any) => m.id === testMedia.id
      )
      expect(foundAfter).toBeFalsy()
    })

    it('should update gallery count after removing media from gallery', async () => {
      // Create a gallery
      const galleryResponse = await request(app)
        .post('/api/galleries')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          name: 'Gallery for Count Test',
          description: 'Testing',
          visibility: 'PUBLIC'
        })
        .expect(201)

      const galleryId = galleryResponse.body.data.gallery.id

      // Create multiple media items
      const mediaIds: string[] = []
      for (let i = 0; i < 3; i++) {
        const media = await testPrisma.media.create({
          data: {
            url: `test-data/count-test-${i}.jpg`,
            s3Key: `uploads/test/count-test-${i}.jpg`,
            originalFilename: `count-test-${i}.jpg`,
            mediaType: 'IMAGE',
            processingStatus: 'COMPLETED',
            mimeType: 'image/jpeg',
            size: 100,
            authorId: alice!.id
          }
        })
        mediaIds.push(media.id)
      }

      // Add all media to gallery
      await request(app)
        .post(`/api/galleries/${galleryId}/media`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ mediaIds })
        .expect(200)

      // Verify count
      const galleryBefore = await request(app)
        .get(`/api/galleries/${galleryId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(200)

      expect(galleryBefore.body.data.gallery.media.length).toBe(3)

      // Remove one media
      await request(app)
        .delete(`/api/galleries/${galleryId}/media`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ mediaIds: [mediaIds[0]] })
        .expect(200)

      // Verify updated count
      const galleryAfter = await request(app)
        .get(`/api/galleries/${galleryId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(200)

      expect(galleryAfter.body.data.gallery.media.length).toBe(2)

      // Clean up
      await testPrisma.media.deleteMany({
        where: { id: { in: mediaIds } }
      })
      await request(app)
        .delete(`/api/galleries/${galleryId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
    })
  })
})

