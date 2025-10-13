/**
 * Comments & Reactions Tests (P1 - High Priority)
 * 
 * Tests cover:
 * - Commenting on posts and media
 * - Nested comments (replies)
 * - Editing and deleting comments
 * - Reactions on posts and comments
 * - Access control and permissions
 */

import request from 'supertest'
import express, { Express } from 'express'
import { testPrisma } from '../seed/test-database.config'
import { generateTestToken, getTestUserByEmail } from '../utils/test-helpers'
import commentsRouter from '../../src/routes/comments'
import postsRouter from '../../src/routes/posts'
import { authMiddleware } from '../../src/middleware/auth'
import { errorHandler } from '../../src/middleware/errorHandler'

describe('Comments & Reactions (P1)', () => {
  let app: Express
  let aliceToken: string
  let bobToken: string
  let charlieToken: string
  let davidToken: string
  let alice: any
  let bob: any
  let charlie: any
  let david: any
  let testPost: any
  let testMedia: any

  beforeAll(async () => {
    // Set up Express app with routes
    app = express()
    app.use(express.json())
    app.use('/api/comments', commentsRouter)
    app.use('/api/posts', postsRouter)
    app.use(errorHandler)

    // Get test users
    alice = await getTestUserByEmail('alice@test.com')
    bob = await getTestUserByEmail('bob@test.com')
    charlie = await getTestUserByEmail('charlie@test.com')
    david = await getTestUserByEmail('david@test.com')

    aliceToken = generateTestToken(alice!)
    bobToken = generateTestToken(bob!)
    charlieToken = generateTestToken(charlie!)
    davidToken = generateTestToken(david!)

    // Get a test post and media for comments
    testPost = await testPrisma.post.findFirst({
      where: {
        authorId: alice!.id,
        visibility: 'PUBLIC'
      }
    })

    testMedia = await testPrisma.media.findFirst({
      where: { 
        authorId: alice!.id,
        visibility: 'PUBLIC'
      }
    })
  })

  afterAll(async () => {
    await testPrisma.$disconnect()
  })

  describe('Comment on Posts', () => {
    it('should create comment on post', async () => {
      const response = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          content: 'Great post!',
          postId: testPost!.id
        })

      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('success', true)
      expect(response.body.data).toHaveProperty('comment')
      expect(response.body.data.comment).toHaveProperty('content', 'Great post!')
      expect(response.body.data.comment).toHaveProperty('postId', testPost!.id)
      expect(response.body.data.comment).toHaveProperty('authorId', bob!.id)
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/comments')
        .send({
          content: 'Test comment',
          postId: testPost!.id
        })

      expect(response.status).toBe(401)
    })

    it('should reject comment without content', async () => {
      const response = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          postId: testPost!.id
        })

      expect(response.status).toBe(400)
    })

    it('should reject comment without postId or mediaId', async () => {
      const response = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          content: 'Test comment'
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toMatch(/postId or mediaId/i)
    })

    it('should reject comment with both postId and mediaId', async () => {
      const response = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          content: 'Test comment',
          postId: testPost!.id,
          mediaId: testMedia!.id
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toMatch(/both post and media/i)
    })
  })

  describe('Reply to Comments (Nested)', () => {
    let parentComment: any

    beforeEach(async () => {
      // Create a parent comment
      const response = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          content: 'Parent comment',
          postId: testPost!.id
        })
      parentComment = response.body.data.comment
    })

    it('should create reply to comment', async () => {
      const response = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          content: 'Reply to comment',
          postId: testPost!.id,
          parentId: parentComment.id
        })

      expect(response.status).toBe(201)
      expect(response.body.data.comment).toHaveProperty('content', 'Reply to comment')
      expect(response.body.data.comment).toHaveProperty('parentId', parentComment.id)
      expect(response.body.data.comment).toHaveProperty('postId', testPost!.id)
    })

    it('should include replies when fetching comments', async () => {
      // Create a reply
      await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          content: 'Reply to comment',
          postId: testPost!.id,
          parentId: parentComment.id
        })

      // Fetch comments
      const response = await request(app)
        .get(`/api/comments/post/${testPost!.id}`)

      expect(response.status).toBe(200)
      const comment = response.body.data.comments.find((c: any) => c.id === parentComment.id)
      expect(comment.replies).toBeDefined()
      expect(comment.replies.length).toBeGreaterThan(0)
    })
  })

  describe('Comment on Media', () => {
    it('should create comment on media', async () => {
      const response = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          content: 'Nice photo!',
          mediaId: testMedia!.id
        })

      expect(response.status).toBe(201)
      expect(response.body.data.comment).toHaveProperty('content', 'Nice photo!')
      expect(response.body.data.comment).toHaveProperty('mediaId', testMedia!.id)
    })

    it('should get comments for media', async () => {
      // Create a comment first
      await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          content: 'Test comment on media',
          mediaId: testMedia!.id
        })

      const response = await request(app)
        .get(`/api/comments/media/${testMedia!.id}`)

      expect(response.status).toBe(200)
      expect(response.body.data).toHaveProperty('comments')
      expect(Array.isArray(response.body.data.comments)).toBe(true)
    })
  })

  describe('View Comments', () => {
    let testPostForComments: any

    beforeEach(async () => {
      // Create a fresh post for these tests to avoid conflicts
      testPostForComments = await testPrisma.post.create({
        data: {
          content: 'Test post for comments',
          authorId: alice!.id,
          visibility: 'PUBLIC',
          publicationStatus: 'PUBLIC'
        }
      })

      // Create some test comments
      for (let i = 0; i < 5; i++) {
        await testPrisma.comment.create({
          data: {
            content: `Test comment ${i}`,
            postId: testPostForComments.id,
            authorId: bob!.id
          }
        })
      }
    })

    it('should get post comments with pagination', async () => {
      const response = await request(app)
        .get(`/api/comments/post/${testPostForComments.id}?page=1&limit=3`)

      expect(response.status).toBe(200)
      expect(response.body.data).toHaveProperty('comments')
      expect(response.body.data).toHaveProperty('pagination')
      expect(response.body.data.comments.length).toBe(3)
      expect(response.body.data.pagination).toHaveProperty('page', 1)
      expect(response.body.data.pagination).toHaveProperty('limit', 3)
      expect(response.body.data.pagination).toHaveProperty('total', 5)
    })

    it('should include author information', async () => {
      const response = await request(app)
        .get(`/api/comments/post/${testPostForComments.id}`)

      expect(response.status).toBe(200)
      const comment = response.body.data.comments[0]
      expect(comment).toHaveProperty('author')
      expect(comment.author).toHaveProperty('id')
      expect(comment.author).toHaveProperty('name')
      expect(comment.author).toHaveProperty('username')
      expect(comment.author).not.toHaveProperty('password')
    })

    it('should include reaction counts', async () => {
      const response = await request(app)
        .get(`/api/comments/post/${testPostForComments.id}`)

      expect(response.status).toBe(200)
      const comment = response.body.data.comments[0]
      expect(comment).toHaveProperty('_count')
      expect(comment._count).toHaveProperty('reactions')
      expect(comment._count).toHaveProperty('replies')
    })
  })

  describe('Edit Comments', () => {
    let testComment: any

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          content: 'Original comment',
          postId: testPost!.id
        })
      testComment = response.body.data.comment
    })

    it('should edit own comment', async () => {
      const response = await request(app)
        .put(`/api/comments/${testComment.id}`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          content: 'Updated comment'
        })

      expect(response.status).toBe(200)
      expect(response.body.data.comment).toHaveProperty('content', 'Updated comment')
    })

    it('should deny editing others\' comments', async () => {
      const response = await request(app)
        .put(`/api/comments/${testComment.id}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          content: 'Trying to edit someone else\'s comment'
        })

      expect(response.status).toBe(403)
    })

    it('should return 404 for non-existent comment', async () => {
      const response = await request(app)
        .put('/api/comments/nonexistent')
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          content: 'Updated'
        })

      expect(response.status).toBe(404)
    })
  })

  describe('Delete Comments', () => {
    let testComment: any

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          content: 'Comment to delete',
          postId: testPost!.id
        })
      testComment = response.body.data.comment
    })

    it('should delete own comment', async () => {
      const response = await request(app)
        .delete(`/api/comments/${testComment.id}`)
        .set('Authorization', `Bearer ${bobToken}`)

      expect(response.status).toBe(200)

      // Verify deletion
      const getResponse = await request(app)
        .get(`/api/comments/post/${testPost!.id}`)

      const deletedComment = getResponse.body.data.comments.find(
        (c: any) => c.id === testComment.id
      )
      expect(deletedComment).toBeUndefined()
    })

    it('should deny deleting others\' comments', async () => {
      const response = await request(app)
        .delete(`/api/comments/${testComment.id}`)
        .set('Authorization', `Bearer ${davidToken}`)

      expect(response.status).toBe(403)
    })

    it('should return 404 for non-existent comment', async () => {
      const response = await request(app)
        .delete('/api/comments/nonexistent')
        .set('Authorization', `Bearer ${bobToken}`)

      expect(response.status).toBe(404)
    })
  })

  describe('Reactions on Posts', () => {
    beforeEach(async () => {
      // Clean up any existing reactions from Bob on testPost
      await testPrisma.reaction.deleteMany({
        where: {
          postId: testPost!.id,
          authorId: bob!.id
        }
      })
    })

    it('should add reaction to post', async () => {
      const response = await request(app)
        .post(`/api/posts/${testPost!.id}/reactions`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          type: 'LIKE'
        })

      expect(response.status).toBe(201)
      expect(response.body.data.reaction).toHaveProperty('type', 'LIKE')
      expect(response.body.data.reaction).toHaveProperty('postId', testPost!.id)
      expect(response.body.data.reaction).toHaveProperty('authorId', bob!.id)
    })

    it('should change existing reaction', async () => {
      // Add initial reaction
      await request(app)
        .post(`/api/posts/${testPost!.id}/reactions`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          type: 'LIKE'
        })

      // Change to different reaction
      const response = await request(app)
        .post(`/api/posts/${testPost!.id}/reactions`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          type: 'LOVE'
        })

      expect(response.status).toBe(200)
      expect(response.body.data.reaction).toHaveProperty('type', 'LOVE')
    })

    it('should remove reaction from post', async () => {
      // Add reaction first
      await request(app)
        .post(`/api/posts/${testPost!.id}/reactions`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          type: 'LIKE'
        })

      // Remove reaction
      const response = await request(app)
        .delete(`/api/posts/${testPost!.id}/reactions`)
        .set('Authorization', `Bearer ${bobToken}`)

      expect(response.status).toBe(200)
    })

    it('should get reactions for post', async () => {
      // Add some reactions
      await request(app)
        .post(`/api/posts/${testPost!.id}/reactions`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          type: 'LIKE'
        })

      const response = await request(app)
        .get(`/api/posts/${testPost!.id}/reactions`)

      expect(response.status).toBe(200)
      expect(response.body.data).toHaveProperty('reactions')
      expect(Array.isArray(response.body.data.reactions)).toBe(true)
    })

    it('should include author information in reactions', async () => {
      // Add reaction
      await request(app)
        .post(`/api/posts/${testPost!.id}/reactions`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          type: 'LIKE'
        })

      const response = await request(app)
        .get(`/api/posts/${testPost!.id}/reactions`)

      expect(response.status).toBe(200)
      const reaction = response.body.data.reactions[0]
      expect(reaction).toHaveProperty('author')
      expect(reaction.author).toHaveProperty('name')
      expect(reaction.author).toHaveProperty('username')
    })
  })

  describe('Access Control', () => {
    let privatePost: any
    let friendsOnlyPost: any

    beforeAll(async () => {
      // Create private post
      privatePost = await testPrisma.post.create({
        data: {
          content: 'Private test post',
          authorId: alice!.id,
          visibility: 'PRIVATE',
          publicationStatus: 'PUBLIC'
        }
      })

      // Create friends-only post
      friendsOnlyPost = await testPrisma.post.create({
        data: {
          content: 'Friends only test post',
          authorId: alice!.id,
          visibility: 'FRIENDS_ONLY',
          publicationStatus: 'PUBLIC'
        }
      })
    })

    it('should allow owner to comment on own private post', async () => {
      const response = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          content: 'Comment on my private post',
          postId: privatePost.id
        })

      expect(response.status).toBe(201)
    })

    it('should allow friends to comment on friends-only post', async () => {
      // Bob is Alice's friend
      const response = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          content: 'Comment from friend',
          postId: friendsOnlyPost.id
        })

      expect(response.status).toBe(201)
    })

    it('should deny non-friends from commenting on private post', async () => {
      // David is not Alice's friend
      const response = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${davidToken}`)
        .send({
          content: 'Trying to comment',
          postId: privatePost.id
        })

      expect(response.status).toBe(403)
    })

    it('should allow anyone to comment on public post', async () => {
      const response = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${davidToken}`)
        .send({
          content: 'Comment on public post',
          postId: testPost!.id
        })

      expect(response.status).toBe(201)
    })
  })
})

