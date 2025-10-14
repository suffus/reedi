import request from 'supertest'
import express, { Express } from 'express'
import { testPrisma } from '../seed/test-database.config'
import { 
  generateTestToken, 
  getTestUserByEmail
} from '../utils/test-helpers'
import commentsRouter from '../../src/routes/comments'
import postsRouter from '../../src/routes/posts'
import groupsRouter from '../../src/routes/groups'
import { errorHandler } from '../../src/middleware/errorHandler'

describe('Comment Context Isolation', () => {
  let app: Express
  let aliceToken: string
  let bobToken: string
  let aliceId: string
  let bobId: string
  let testPost: any
  let testGroup: any

  beforeAll(async () => {
    // Set up Express app with routes
    app = express()
    app.use(express.json())
    app.use('/api/comments', commentsRouter)
    app.use('/api/posts', postsRouter)
    app.use('/api/groups', groupsRouter)
    app.use(errorHandler)

    // Get test users
    const alice = await getTestUserByEmail('alice@test.com')
    const bob = await getTestUserByEmail('bob@test.com')

    if (!alice || !bob) {
      throw new Error('Test users not found. Run npm run test:seed first')
    }

    aliceId = alice.id
    bobId = bob.id

    // Generate tokens
    aliceToken = generateTestToken(alice)
    bobToken = generateTestToken(bob)

    // Create a test post
    const postResponse = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        title: 'Test Post for Comments',
        content: 'Testing comment context isolation',
        visibility: 'PUBLIC'
      })
    testPost = postResponse.body.data.post

    // Create a test group
    const groupResponse = await request(app)
      .post('/api/groups')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        name: 'Test Comment Group',
        username: 'test-comment-group',
        description: 'Group for testing comments',
        visibility: 'PUBLIC',
        type: 'GENERAL',
        moderationPolicy: 'NO_MODERATION'
      })
    testGroup = groupResponse.body.data.group

    // Bob joins the group
    await request(app)
      .post(`/api/groups/${testGroup.id}/join`)
      .set('Authorization', `Bearer ${bobToken}`)

    // Add post to group
    await request(app)
      .post(`/api/groups/${testGroup.id}/posts`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ postId: testPost.id })
  })

  afterAll(async () => {
    // Cleanup
    if (testPost) {
      await testPrisma.comment.deleteMany({ where: { postId: testPost.id } })
      await testPrisma.groupPost.deleteMany({ where: { postId: testPost.id } })
      await testPrisma.post.delete({ where: { id: testPost.id } })
    }
    if (testGroup) {
      await testPrisma.groupMember.deleteMany({ where: { groupId: testGroup.id } })
      await testPrisma.group.delete({ where: { id: testGroup.id } })
    }
    await testPrisma.$disconnect()
  })

  it('should create comment with GROUP context', async () => {
    const response = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        postId: testPost.id,
        content: 'This is a group comment',
        context: 'GROUP',
        groupId: testGroup.id
      })

    expect(response.status).toBe(201)
    expect(response.body.success).toBe(true)
    expect(response.body.data.comment.context).toBe('GROUP')
    expect(response.body.data.comment.groupId).toBe(testGroup.id)
  })

  it('should create comment with FEED context', async () => {
    const response = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        postId: testPost.id,
        content: 'This is a feed comment',
        context: 'FEED'
      })

    expect(response.status).toBe(201)
    expect(response.body.success).toBe(true)
    expect(response.body.data.comment.context).toBe('FEED')
    expect(response.body.data.comment.groupId).toBeNull()
  })

  it('should only return GROUP comments when fetching with GROUP context', async () => {
    const response = await request(app)
      .get(`/api/comments/post/${testPost.id}?context=GROUP&groupId=${testGroup.id}`)
      .set('Authorization', `Bearer ${bobToken}`)

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    
    // Should only have GROUP context comments
    const comments = response.body.data.comments
    expect(comments.length).toBeGreaterThan(0)
    expect(comments.every((c: any) => c.context === 'GROUP')).toBe(true)
    expect(comments.every((c: any) => c.groupId === testGroup.id)).toBe(true)
  })

  it('should only return FEED comments when fetching with FEED context', async () => {
    const response = await request(app)
      .get(`/api/comments/post/${testPost.id}?context=FEED`)
      .set('Authorization', `Bearer ${bobToken}`)

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    
    // Should only have FEED context comments
    const comments = response.body.data.comments
    expect(comments.length).toBeGreaterThan(0)
    expect(comments.every((c: any) => c.context === 'FEED')).toBe(true)
    expect(comments.every((c: any) => c.groupId === null)).toBe(true)
  })

  it('should not show group comments in feed posts', async () => {
    // Fetch public feed
    const response = await request(app)
      .get('/api/posts')
      .set('Authorization', `Bearer ${bobToken}`)

    expect(response.status).toBe(200)
    
    // Find our test post in the feed
    const posts = response.body.data.posts
    const post = posts.find((p: any) => p.id === testPost.id)
    
    if (post && post.comments) {
      // Should only show FEED context comments, not GROUP comments
      expect(post.comments.every((c: any) => c.context === 'FEED')).toBe(true)
    }
  })

  it('should show group comments in group feed', async () => {
    const response = await request(app)
      .get(`/api/groups/${testGroup.id}/feed`)
      .set('Authorization', `Bearer ${bobToken}`)

    expect(response.status).toBe(200)
    
    const posts = response.body.data.posts
    expect(posts.length).toBeGreaterThan(0)
    
    // Find our test post
    const groupPost = posts.find((gp: any) => gp.post.id === testPost.id)
    
    if (groupPost && groupPost.post.comments) {
      // Should only show GROUP context comments for this group
      expect(groupPost.post.comments.every((c: any) => c.context === 'GROUP')).toBe(true)
      expect(groupPost.post.comments.every((c: any) => c.groupId === testGroup.id)).toBe(true)
    }
  })

  it('should reject GROUP context comment without groupId', async () => {
    const response = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        postId: testPost.id,
        content: 'Invalid group comment',
        context: 'GROUP'
        // Missing groupId
      })

    expect(response.status).toBe(400)
    expect(response.body.success).toBe(false)
  })

  it('should reject comment with invalid context', async () => {
    const response = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        postId: testPost.id,
        content: 'Invalid context comment',
        context: 'INVALID_CONTEXT'
      })

    expect(response.status).toBe(400)
    expect(response.body.success).toBe(false)
  })

  it('should inherit parent comment context for replies', async () => {
    // Create a GROUP context comment
    const parentResponse = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        postId: testPost.id,
        content: 'Parent group comment',
        context: 'GROUP',
        groupId: testGroup.id
      })

    const parentCommentId = parentResponse.body.data.comment.id

    // Reply should inherit GROUP context
    const replyResponse = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        postId: testPost.id,
        content: 'Reply to group comment',
        parentId: parentCommentId,
        context: 'FEED', // Try to set FEED, but should inherit GROUP
        groupId: null
      })

    expect(replyResponse.status).toBe(201)
    expect(replyResponse.body.data.comment.context).toBe('GROUP')
    expect(replyResponse.body.data.comment.groupId).toBe(testGroup.id)
  })
})

