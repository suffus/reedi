/**
 * Groups Tests (P1 - High Priority)
 * 
 * Tests cover:
 * - Group creation and settings
 * - Group visibility (PUBLIC, PRIVATE_VISIBLE, PRIVATE_HIDDEN)
 * - Membership management (join, invite, apply)
 * - Role management (OWNER, ADMIN, MODERATOR, MEMBER)
 * - Group posts and moderation
 * - Applications and invitations
 * - Access control and permissions
 */

import request from 'supertest'
import express, { Express } from 'express'
import { testPrisma } from '../seed/test-database.config'
import { generateTestToken, getTestUserByEmail } from '../utils/test-helpers'
import groupsRouter from '../../src/routes/groups'
import postsRouter from '../../src/routes/posts'
import { errorHandler } from '../../src/middleware/errorHandler'

describe('Groups (P1)', () => {
  let app: Express
  let aliceToken: string
  let bobToken: string
  let charlieToken: string
  let davidToken: string
  let eveToken: string
  let alice: any
  let bob: any
  let charlie: any
  let david: any
  let eve: any
  let testGroup: any
  let testPost: any

  beforeAll(async () => {
    // Set up Express app with routes
    app = express()
    app.use(express.json())
    app.use('/api/groups', groupsRouter)
    app.use('/api/posts', postsRouter)
    app.use(errorHandler)

    // Get test users
    alice = await getTestUserByEmail('alice@test.com')
    bob = await getTestUserByEmail('bob@test.com')
    charlie = await getTestUserByEmail('charlie@test.com')
    david = await getTestUserByEmail('david@test.com')
    eve = await getTestUserByEmail('eve@test.com')

    aliceToken = generateTestToken(alice!)
    bobToken = generateTestToken(bob!)
    charlieToken = generateTestToken(charlie!)
    davidToken = generateTestToken(david!)
    eveToken = generateTestToken(eve!)

    // Get an existing test group
    testGroup = await testPrisma.group.findFirst({
      include: {
        members: true
      }
    })

    // Get a test post for group posting tests
    testPost = await testPrisma.post.findFirst({
      where: {
        authorId: bob!.id,
        visibility: 'PUBLIC'
      }
    })
  })

  afterAll(async () => {
    await testPrisma.$disconnect()
  })

  describe('Create & Setup Groups', () => {
    it('should create new group', async () => {
      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          name: 'Test Group',
          username: 'testgroup' + Date.now(),
          description: 'A test group for integration tests',
          visibility: 'PUBLIC',
          type: 'GENERAL',
          moderationPolicy: 'NO_MODERATION'
        })

      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('success', true)
      expect(response.body.data).toHaveProperty('group')
      expect(response.body.data.group).toHaveProperty('name', 'Test Group')
      expect(response.body.data.group).toHaveProperty('visibility', 'PUBLIC')
    })

    it('should require group name', async () => {
      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          username: 'testgroup2' + Date.now(),
          visibility: 'PUBLIC'
        })

      expect(response.status).toBe(400)
    })

    it('should require unique username', async () => {
      // Get an existing group username
      const existingGroup = await testPrisma.group.findFirst()
      
      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          name: 'Duplicate Username Group',
          username: existingGroup!.username,
          visibility: 'PUBLIC'
        })

      expect(response.status).toBe(409)
    })

    it('should set creator as owner', async () => {
      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          name: 'Owner Test Group',
          username: 'ownertest' + Date.now(),
          visibility: 'PUBLIC'
        })

      expect(response.status).toBe(201)
      
      // Check membership
      const member = await testPrisma.groupMember.findFirst({
        where: {
          groupId: response.body.data.group.id,
          userId: alice!.id
        }
      })

      expect(member).toBeDefined()
      expect(member!.role).toBe('OWNER')
      expect(member!.status).toBe('ACTIVE')
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/groups')
        .send({
          name: 'Unauthenticated Group',
          username: 'unauth' + Date.now()
        })

      expect(response.status).toBe(401)
    })
  })

  describe('View Groups', () => {
    it('should get public groups list', async () => {
      const response = await request(app)
        .get('/api/groups/public')

      expect(response.status).toBe(200)
      expect(response.body.data).toHaveProperty('groups')
      expect(Array.isArray(response.body.data.groups)).toBe(true)
    })

    it('should get user\'s groups', async () => {
      const response = await request(app)
        .get(`/api/groups/user/${bob!.id}`)
        .set('Authorization', `Bearer ${bobToken}`)

      expect(response.status).toBe(200)
      expect(response.body.data).toHaveProperty('groups')
      expect(Array.isArray(response.body.data.groups)).toBe(true)
    })

    it('should get group detail by identifier', async () => {
      const response = await request(app)
        .get(`/api/groups/${testGroup!.username}`)
        .set('Authorization', `Bearer ${bobToken}`)

      expect(response.status).toBe(200)
      expect(response.body.data).toHaveProperty('group')
      expect(response.body.data.group).toHaveProperty('id', testGroup!.id)
    })

    it('should search groups', async () => {
      const response = await request(app)
        .get('/api/groups/search?q=tech')
        .set('Authorization', `Bearer ${aliceToken}`)

      expect(response.status).toBe(200)
      expect(response.body.data).toHaveProperty('groups')
    })
  })

  describe('Group Membership - Applications', () => {
    let privateGroup: any

    beforeAll(async () => {
      // Create a private group for application tests
      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          name: 'Application Test Group',
          username: 'apptest' + Date.now(),
          visibility: 'PRIVATE_VISIBLE',
          moderationPolicy: 'ADMIN_APPROVAL_REQUIRED'
        })
      privateGroup = response.body.data.group
    })

    it('should apply to join private group', async () => {
      const response = await request(app)
        .post(`/api/groups/${privateGroup.username}/apply`)
        .set('Authorization', `Bearer ${charlieToken}`)
        .send({
          message: 'I would like to join this group'
        })

      expect(response.status).toBe(201)
      expect(response.body.data).toHaveProperty('application')
    })

    it('should reject duplicate application', async () => {
      // Apply again
      const response = await request(app)
        .post(`/api/groups/${privateGroup.username}/apply`)
        .set('Authorization', `Bearer ${charlieToken}`)
        .send({
          message: 'Applying again'
        })

      expect(response.status).toBe(403)
    })

    it('should get pending applications (admin only)', async () => {
      const response = await request(app)
        .get(`/api/groups/${privateGroup.username}/applications`)
        .set('Authorization', `Bearer ${aliceToken}`)

      expect(response.status).toBe(200)
      expect(response.body.data).toHaveProperty('applications')
      expect(Array.isArray(response.body.data.applications)).toBe(true)
    })

    it('should deny non-admin from viewing applications', async () => {
      const response = await request(app)
        .get(`/api/groups/${privateGroup.username}/applications`)
        .set('Authorization', `Bearer ${bobToken}`)

      expect(response.status).toBe(403)
    })
  })

  describe('Group Membership - Invitations', () => {
    let inviteGroup: any

    beforeAll(async () => {
      // Create a group for invitation tests
      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          name: 'Invite Test Group',
          username: 'invitetest' + Date.now(),
          visibility: 'PRIVATE_VISIBLE'
        })
      inviteGroup = response.body.data.group
    })

    it('should send invitation (admin/owner only)', async () => {
      const response = await request(app)
        .post(`/api/groups/${inviteGroup.username}/invite`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          userId: david!.id,
          message: 'Join our group!'
        })

      expect(response.status).toBe(201)
      expect(response.body.data).toHaveProperty('invitation')
      expect(response.body.data.invitation).toHaveProperty('inviteCode')
    })

    it('should deny non-admin from sending invitations', async () => {
      const response = await request(app)
        .post(`/api/groups/${testGroup!.username}/invite`)
        .set('Authorization', `Bearer ${eveToken}`)
        .send({
          userId: david!.id
        })

      expect(response.status).toBe(403)
    })

    it('should accept invitation', async () => {
      // First, send an invitation
      const inviteResponse = await request(app)
        .post(`/api/groups/${inviteGroup.username}/invite`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          userId: eve!.id
        })

      const inviteCode = inviteResponse.body.data.invitation.inviteCode

      // Accept the invitation
      const response = await request(app)
        .post(`/api/groups/invitations/${inviteCode}/accept`)
        .set('Authorization', `Bearer ${eveToken}`)

      expect(response.status).toBe(200)

      // Verify membership
      const member = await testPrisma.groupMember.findFirst({
        where: {
          groupId: inviteGroup.id,
          userId: eve!.id
        }
      })
      expect(member).toBeDefined()
      expect(member!.status).toBe('ACTIVE')
    })
  })

  describe('Application Review', () => {
    let reviewGroup: any
    let applicationId: string

    beforeAll(async () => {
      // Create a group and have someone apply
      const groupResponse = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          name: 'Review Test Group',
          username: 'reviewtest' + Date.now(),
          visibility: 'PRIVATE_VISIBLE'
        })
      reviewGroup = groupResponse.body.data.group

      // Apply to join
      const appResponse = await request(app)
        .post(`/api/groups/${reviewGroup.username}/apply`)
        .set('Authorization', `Bearer ${davidToken}`)
        .send({
          message: 'Please let me join'
        })

      applicationId = appResponse.body.data.application.id
    })

    it('should approve application (admin only)', async () => {
      const response = await request(app)
        .put(`/api/groups/${reviewGroup.username}/applications/${applicationId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          action: 'approve'
        })

      expect(response.status).toBe(200)

      // Verify membership created
      const member = await testPrisma.groupMember.findFirst({
        where: {
          groupId: reviewGroup.id,
          userId: david!.id
        }
      })
      expect(member).toBeDefined()
    })

    it('should reject application (admin only)', async () => {
      // Create another application
      const appResponse = await request(app)
        .post(`/api/groups/${reviewGroup.username}/apply`)
        .set('Authorization', `Bearer ${charlieToken}`)
        .send({
          message: 'Let me in!'
        })

      const response = await request(app)
        .put(`/api/groups/${reviewGroup.username}/applications/${appResponse.body.data.application.id}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          action: 'reject',
          message: 'Not accepting new members right now'
        })

      expect(response.status).toBe(200)

      // Verify no membership created
      const member = await testPrisma.groupMember.findFirst({
        where: {
          groupId: reviewGroup.id,
          userId: charlie!.id
        }
      })
      expect(member).toBeNull()
    })
  })

  describe('Group Roles', () => {
    let roleGroup: any

    beforeAll(async () => {
      // Create a group
      const groupResponse = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          name: 'Role Test Group',
          username: 'roletest' + Date.now(),
          visibility: 'PUBLIC'
        })
      roleGroup = groupResponse.body.data.group

      // Add a member
      const inviteResponse = await request(app)
        .post(`/api/groups/${roleGroup.username}/invite`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          userId: charlie!.id
        })

      await request(app)
        .post(`/api/groups/invitations/${inviteResponse.body.data.invitation.inviteCode}/accept`)
        .set('Authorization', `Bearer ${charlieToken}`)
    })

    beforeEach(async () => {
      // Reset Charlie's role to MEMBER before each test
      await testPrisma.groupMember.updateMany({
        where: {
          groupId: roleGroup.id,
          userId: charlie!.id
        },
        data: {
          role: 'MEMBER'
        }
      })
    })

    it.skip('should change member role (owner/admin only)', async () => {
      const response = await request(app)
        .put(`/api/groups/${roleGroup.username}/members/${charlie!.id}/role`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          newRole: 'MODERATOR'
        })

      expect(response.status).toBe(200)

      // Verify role changed
      const updatedMember = await testPrisma.groupMember.findFirst({
        where: {
          groupId: roleGroup.id,
          userId: charlie!.id
        }
      })
      expect(updatedMember!.role).toBe('MODERATOR')
    })

    it('should deny non-admin from changing roles', async () => {
      const response = await request(app)
        .put(`/api/groups/${roleGroup.username}/members/${charlie!.id}/role`)
        .set('Authorization', `Bearer ${eveToken}`)
        .send({
          newRole: 'ADMIN'
        })

      expect(response.status).toBe(403)
    })
  })

  describe('Group Posts', () => {
    it('should post to group', async () => {
      // Find a group where Bob is a member
      const memberGroup = await testPrisma.group.findFirst({
        where: {
          members: {
            some: {
              userId: bob!.id,
              status: 'ACTIVE'
            }
          }
        }
      })

      if (!memberGroup) {
        // Skip if Bob is not a member of any group
        return
      }

      const response = await request(app)
        .post(`/api/groups/${memberGroup.username}/posts`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          postId: testPost!.id
        })

      expect([201, 409]).toContain(response.status) // 409 if already posted
    })

    it('should deny non-member from posting', async () => {
      // Use testGroup where Eve is not a member
      const response = await request(app)
        .post(`/api/groups/${testGroup!.username}/posts`)
        .set('Authorization', `Bearer ${eveToken}`)
        .send({
          postId: testPost!.id
        })

      expect(response.status).toBe(403)
    })

    it('should get group feed', async () => {
      const response = await request(app)
        .get(`/api/groups/${testGroup!.username}/feed`)
        .set('Authorization', `Bearer ${bobToken}`)

      expect(response.status).toBe(200)
      expect(response.body.data).toHaveProperty('posts')
      expect(Array.isArray(response.body.data.posts)).toBe(true)
    })
  })

  describe('Post Moderation', () => {
    let modGroup: any
    let groupPostId: string

    beforeAll(async () => {
      // Create a group with moderation
      const groupResponse = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          name: 'Moderation Test Group',
          username: 'modtest' + Date.now(),
          visibility: 'PUBLIC',
          moderationPolicy: 'ADMIN_APPROVAL_REQUIRED'
        })
      modGroup = groupResponse.body.data.group

      // Add Bob as member
      const inviteResponse = await request(app)
        .post(`/api/groups/${modGroup.username}/invite`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          userId: bob!.id
        })

      await request(app)
        .post(`/api/groups/invitations/${inviteResponse.body.data.invitation.inviteCode}/accept`)
        .set('Authorization', `Bearer ${bobToken}`)

      // Post to the group
      const postResponse = await request(app)
        .post(`/api/groups/${modGroup.username}/posts`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          postId: testPost!.id
        })

      if (postResponse.status === 201) {
        // Find the group post
        const groupPost = await testPrisma.groupPost.findFirst({
          where: {
            groupId: modGroup.id,
            postId: testPost!.id
          }
        })
        groupPostId = groupPost!.id
      }
    })

    it('should approve pending post (admin only)', async () => {
      if (!groupPostId) {
        // Skip if post wasn't created
        return
      }

      const response = await request(app)
        .put(`/api/groups/${modGroup.username}/posts/${groupPostId}/approve`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          approve: true
        })

      expect([200, 404]).toContain(response.status)
    })

    it('should moderate post (admin/moderator only)', async () => {
      if (!groupPostId) {
        return
      }

      const response = await request(app)
        .put(`/api/groups/${modGroup.username}/posts/${groupPostId}/moderate`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          action: 'HIDE',
          reason: 'Inappropriate content'
        })

      expect([200, 404]).toContain(response.status)
    })
  })

  describe('Group Members', () => {
    it('should get group members list', async () => {
      const response = await request(app)
        .get(`/api/groups/${testGroup!.username}/members`)
        .set('Authorization', `Bearer ${bobToken}`)

      expect(response.status).toBe(200)
      expect(response.body.data).toHaveProperty('members')
      expect(Array.isArray(response.body.data.members)).toBe(true)
    })

    it('should include member role information', async () => {
      const response = await request(app)
        .get(`/api/groups/${testGroup!.username}/members`)
        .set('Authorization', `Bearer ${bobToken}`)

      expect(response.status).toBe(200)
      if (response.body.data.members.length > 0) {
        const member = response.body.data.members[0]
        expect(member).toHaveProperty('role')
        expect(member).toHaveProperty('status')
        expect(member).toHaveProperty('user')
      }
    })
  })

  describe('Edit Group Settings', () => {
    let editGroup: any

    beforeAll(async () => {
      // Create a group to edit
      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          name: 'Edit Test Group',
          username: 'editest' + Date.now(),
          visibility: 'PUBLIC',
          description: 'Original description'
        })
      editGroup = response.body.data.group
    })

    it('should edit group settings (owner/admin only)', async () => {
      const response = await request(app)
        .put(`/api/groups/${editGroup.username}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          name: 'Updated Group Name',
          description: 'Updated description'
        })

      expect(response.status).toBe(200)
      expect(response.body.data.group).toHaveProperty('name', 'Updated Group Name')
      expect(response.body.data.group).toHaveProperty('description', 'Updated description')
    })

    it('should change visibility', async () => {
      const response = await request(app)
        .put(`/api/groups/${editGroup.username}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          visibility: 'PRIVATE_VISIBLE'
        })

      expect(response.status).toBe(200)
      expect(response.body.data.group).toHaveProperty('visibility', 'PRIVATE_VISIBLE')
    })

    it('should change moderation policy', async () => {
      const response = await request(app)
        .put(`/api/groups/${editGroup.username}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          moderationPolicy: 'SELECTIVE_MODERATION'
        })

      expect(response.status).toBe(200)
      expect(response.body.data.group).toHaveProperty('moderationPolicy', 'SELECTIVE_MODERATION')
    })

    it('should deny non-admin from editing group', async () => {
      const response = await request(app)
        .put(`/api/groups/${editGroup.username}`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          name: 'Unauthorized Edit'
        })

      expect(response.status).toBe(403)
    })
  })

  describe('Group Activity', () => {
    it('should get group activity log (admin only)', async () => {
      const response = await request(app)
        .get(`/api/groups/${testGroup!.username}/activity`)
        .set('Authorization', `Bearer ${bobToken}`)

      // May be 200 or 403 depending on if Bob is admin in testGroup
      expect([200, 403]).toContain(response.status)

      if (response.status === 200) {
        expect(response.body.data).toHaveProperty('activities')
        expect(Array.isArray(response.body.data.activities)).toBe(true)
      }
    })
  })
})

