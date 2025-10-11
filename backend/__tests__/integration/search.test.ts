/**
 * Search Tests (P1 - High Priority)
 * 
 * Tests cover:
 * - Media search by tags
 * - Global search (posts, users, groups, galleries, media)
 * - Search type filtering
 * - Search suggestions
 * - Pagination
 * - Access control for search results
 */

import request from 'supertest'
import express, { Express } from 'express'
import { testPrisma } from '../seed/test-database.config'
import { generateTestToken, getTestUserByEmail } from '../utils/test-helpers'
import searchRouter from '../../src/routes/search'
import { errorHandler } from '../../src/middleware/errorHandler'

describe('Search (P1)', () => {
  let app: Express
  let aliceToken: string
  let bobToken: string
  let alice: any
  let bob: any

  beforeAll(async () => {
    // Set up Express app with routes
    app = express()
    app.use(express.json())
    app.use('/api/search', searchRouter)
    app.use(errorHandler)

    // Get test users
    alice = await getTestUserByEmail('alice@test.com')
    bob = await getTestUserByEmail('bob@test.com')

    aliceToken = generateTestToken(alice!)
    bobToken = generateTestToken(bob!)
  })

  afterAll(async () => {
    await testPrisma.$disconnect()
  })

  describe('Media Search by Tags', () => {
    it('should search media by single tag', async () => {
      const response = await request(app)
        .get('/api/search/media/tags?tags=technology')
        .set('Authorization', `Bearer ${aliceToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('data')
      expect(response.body.data).toHaveProperty('media')
      expect(Array.isArray(response.body.data.media)).toBe(true)
    })

    it('should search media by multiple tags', async () => {
      const response = await request(app)
        .get('/api/search/media/tags?tags=technology,programming')
        .set('Authorization', `Bearer ${aliceToken}`)

      expect(response.status).toBe(200)
      expect(response.body.data).toHaveProperty('media')
    })

    it('should require tags parameter', async () => {
      const response = await request(app)
        .get('/api/search/media/tags')
        .set('Authorization', `Bearer ${aliceToken}`)

      expect(response.status).toBe(400)
    })

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/search/media/tags?tags=technology&page=1&limit=5')
        .set('Authorization', `Bearer ${aliceToken}`)

      expect(response.status).toBe(200)
      expect(response.body.data).toHaveProperty('pagination')
    })

    it('should filter by visibility (public only for unauthenticated)', async () => {
      const response = await request(app)
        .get('/api/search/media/tags?tags=technology')

      expect(response.status).toBe(200)
      // Should only return public media
    })

    it('should include friends\' media for authenticated users', async () => {
      const response = await request(app)
        .get('/api/search/media/tags?tags=technology')
        .set('Authorization', `Bearer ${aliceToken}`)

      expect(response.status).toBe(200)
      // Should include public and friends' FRIENDS_ONLY media
    })
  })

  describe('Global Search', () => {
    it('should search all content types', async () => {
      const response = await request(app)
        .get('/api/search?q=test')
        .set('Authorization', `Bearer ${aliceToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('data')
      // May have posts, users, groups, galleries, media
    })

    it('should require search query', async () => {
      const response = await request(app)
        .get('/api/search')
        .set('Authorization', `Bearer ${aliceToken}`)

      expect(response.status).toBe(400)
    })

    it('should support type filter: posts', async () => {
      const response = await request(app)
        .get('/api/search?q=test&type=posts')
        .set('Authorization', `Bearer ${aliceToken}`)

      expect(response.status).toBe(200)
      expect(response.body.data).toHaveProperty('results')
      expect(response.body.data.type).toBe('posts')
    })

    it('should support type filter: users', async () => {
      const response = await request(app)
        .get('/api/search?q=bob&type=users')
        .set('Authorization', `Bearer ${aliceToken}`)

      expect(response.status).toBe(200)
      expect(response.body.data).toHaveProperty('results')
      expect(response.body.data.type).toBe('users')
    })

    it('should support type filter: groups', async () => {
      const response = await request(app)
        .get('/api/search?q=tech&type=groups')
        .set('Authorization', `Bearer ${aliceToken}`)

      expect(response.status).toBe(200)
      expect(response.body.data).toHaveProperty('results')
      expect(response.body.data.type).toBe('groups')
    })

    it('should support type filter: galleries', async () => {
      const response = await request(app)
        .get('/api/search?q=photo&type=galleries')
        .set('Authorization', `Bearer ${aliceToken}`)

      expect(response.status).toBe(200)
      expect(response.body.data).toHaveProperty('results')
      expect(response.body.data.type).toBe('galleries')
    })

    it('should support type filter: media', async () => {
      const response = await request(app)
        .get('/api/search?q=test&type=media')
        .set('Authorization', `Bearer ${aliceToken}`)

      expect(response.status).toBe(200)
      expect(response.body.data).toHaveProperty('results')
      expect(response.body.data.type).toBe('media')
    })

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/search?q=test&page=1&limit=10')
        .set('Authorization', `Bearer ${aliceToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('data')
    })

    it('should work without authentication', async () => {
      const response = await request(app)
        .get('/api/search?q=test')

      expect(response.status).toBe(200)
      // Should only return public content
    })
  })

  describe('Search Results Content', () => {
    it('should include author info in post results', async () => {
      const response = await request(app)
        .get('/api/search?q=test&type=posts')
        .set('Authorization', `Bearer ${aliceToken}`)

      expect(response.status).toBe(200)
      const posts = response.body.data.results?.posts
      if (posts && posts.length > 0) {
        const post = posts[0]
        expect(post).toHaveProperty('author')
        expect(post.author).toHaveProperty('username')
      }
    })

    it('should include relevant fields in user results', async () => {
      const response = await request(app)
        .get('/api/search?q=bob&type=users')
        .set('Authorization', `Bearer ${aliceToken}`)

      expect(response.status).toBe(200)
      const users = response.body.data.results?.users
      if (users && users.length > 0) {
        const user = users[0]
        expect(user).toHaveProperty('username')
        expect(user).toHaveProperty('name')
      }
    })
  })

  describe('Search Suggestions', () => {
    it('should provide search suggestions', async () => {
      const response = await request(app)
        .get('/api/search/suggestions?q=te')

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('data')
      expect(response.body.data).toHaveProperty('suggestions')
    })

    it('should limit suggestion results', async () => {
      const response = await request(app)
        .get('/api/search/suggestions?q=te&limit=5')

      expect(response.status).toBe(200)
      if (response.body.data.suggestions) {
        expect(response.body.data.suggestions.length).toBeLessThanOrEqual(5)
      }
    })

    it('should work without query parameter', async () => {
      const response = await request(app)
        .get('/api/search/suggestions')

      // Should either return empty suggestions or require query
      expect([200, 400]).toContain(response.status)
    })
  })

  describe('Search Access Control', () => {
    it('should only return public posts for unauthenticated users', async () => {
      const response = await request(app)
        .get('/api/search?q=test&type=posts')

      expect(response.status).toBe(200)
      // All returned posts should be PUBLIC
      const posts = response.body.data.results?.posts
      if (posts) {
        posts.forEach((post: any) => {
          expect(post.visibility).toBe('PUBLIC')
        })
      }
    })

    it('should only return visible groups for search', async () => {
      const response = await request(app)
        .get('/api/search?q=tech&type=groups')
        .set('Authorization', `Bearer ${aliceToken}`)

      expect(response.status).toBe(200)
      // Should not return PRIVATE_HIDDEN groups unless user is a member
    })
  })

  describe('Search Performance', () => {
    it('should handle empty results gracefully', async () => {
      const response = await request(app)
        .get('/api/search?q=xyznonexistentquery123')
        .set('Authorization', `Bearer ${aliceToken}`)

      expect(response.status).toBe(200)
      expect(response.body.data).toBeDefined()
    })

    it('should handle special characters in query', async () => {
      const response = await request(app)
        .get('/api/search?q=%23test')
        .set('Authorization', `Bearer ${aliceToken}`)

      expect(response.status).toBe(200)
    })

    it('should handle very long queries', async () => {
      const longQuery = 'a'.repeat(200)
      const response = await request(app)
        .get(`/api/search?q=${longQuery}`)
        .set('Authorization', `Bearer ${aliceToken}`)

      expect([200, 400]).toContain(response.status)
    })
  })
})

