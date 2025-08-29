import { Router, Request, Response } from 'express'
import { prisma } from '@/index'
import { asyncHandler } from '@/middleware/errorHandler'
import { authMiddleware } from '@/middleware/auth'
import { AuthenticatedRequest } from '@/types'
import { z } from 'zod'
import multer from 'multer'


const router = Router()

// Configure multer for group image uploads
const storage = multer.memoryStorage()
const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Only image files are allowed'))
    }
  }
})

// Validation schemas
const createGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(100, 'Group name too long'),
  username: z.string().min(3, 'Username must be at least 3 characters').max(30, 'Username too long'),
  description: z.string().max(500, 'Description too long').optional(),
  rules: z.string().max(2000, 'Rules too long').optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE_VISIBLE', 'PRIVATE_HIDDEN']).default('PRIVATE_VISIBLE'),
  type: z.enum(['GENERAL', 'SOCIAL_LEARNING', 'GAMING', 'JOBS', 'BUY_SELL', 'PARENTING', 'WORK']).default('GENERAL'),
  moderationPolicy: z.enum(['NO_MODERATION', 'ADMIN_APPROVAL_REQUIRED', 'AI_FILTER', 'SELECTIVE_MODERATION']).default('NO_MODERATION')
})

const updateGroupSchema = createGroupSchema.partial().omit({ username: true })

const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email').optional(),
  userId: z.string().optional(),
  message: z.string().max(500, 'Message too long').optional()
})

const applicationSchema = z.object({
  message: z.string().max(500, 'Message too long').optional()
})

const applicationReviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
  message: z.string().max(500, 'Message too long').optional()
})

const postToGroupSchema = z.object({
  postId: z.string().min(1, 'Post ID is required'),
  isPriority: z.boolean().default(false)
})

// Helper function to check if user has permission
async function hasGroupPermission(userId: string, groupId: string, requiredRole: 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER'): Promise<boolean> {
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } }
  })
  
  if (!member || member.status !== 'ACTIVE') return false
  
  const roleHierarchy = { OWNER: 4, ADMIN: 3, MODERATOR: 2, MEMBER: 1 }
  return roleHierarchy[member.role as keyof typeof roleHierarchy] >= roleHierarchy[requiredRole]
}

// Helper function to log group action
async function logGroupAction(groupId: string, userId: string, actionType: string, description: string, metadata?: any) {
  await prisma.groupAction.create({
    data: {
      groupId,
      userId,
      actionType: actionType as any,
      description,
      metadata
    }
  })
}

// Create a new group
router.post('/', authMiddleware, upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'coverPhoto', maxCount: 1 }
]), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  if (!userId) {
    return res.status(401).json({ success: false, error: 'User not authenticated' })
  }

  // Extract form data from req.body (text fields)
  console.log('Received form data:', req.body)
  console.log('Received files:', req.files)
  
  const formData = {
    name: req.body.name,
    username: req.body.username,
    description: req.body.description,
    rules: req.body.rules,
    visibility: req.body.visibility,
    type: req.body.type,
    moderationPolicy: req.body.moderationPolicy
  }
  
  console.log('Processed form data:', formData)

  const validatedData = createGroupSchema.parse(formData)
  
  // Check if username is available
  const existingGroup = await prisma.group.findUnique({
    where: { username: validatedData.username }
  })
  
  if (existingGroup) {
    return res.status(409).json({ success: false, error: 'Group username already taken' })
  }

  // Handle file uploads if provided
  let avatarMediaId: string | undefined
  let coverPhotoMediaId: string | undefined

  if (req.files) {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] }
    
    // Handle avatar upload
    if (files.avatar && files.avatar[0]) {
      try {
        const avatarFile = files.avatar[0]
        
        // Upload original image to S3 first
        const { uploadToS3 } = await import('@/utils/s3Service')
        const s3Key = await uploadToS3(
          avatarFile.buffer,
          avatarFile.originalname,
          avatarFile.mimetype,
          userId
        )
        
        // Create Media record for avatar with PENDING status
        const avatarMedia = await prisma.media.create({
          data: {
            url: s3Key,
            s3Key: s3Key,
            originalFilename: avatarFile.originalname,
            altText: `${validatedData.name} avatar`,
            caption: `Avatar for ${validatedData.name}`,
            size: Math.ceil(avatarFile.size / 1024), // Convert bytes to kilobytes
            mimeType: avatarFile.mimetype,
            mediaType: 'IMAGE',
            processingStatus: 'PENDING',
            authorId: userId,
            visibility: 'PUBLIC'
          }
        })
        
        avatarMediaId = avatarMedia.id
        console.log('Avatar uploaded and Media record created:', avatarMediaId)
        
        // Queue image processing job
        const imageProcessingService = req.app.locals.imageProcessingService
        if (imageProcessingService) {
          try {
            await imageProcessingService.requestImageProcessing(
              avatarMedia.id,
              userId,
              s3Key,
              avatarFile.originalname
            )
            console.log(`Avatar processing job queued for media ${avatarMedia.id}`)
          } catch (error) {
            console.error(`Failed to queue avatar processing job for media ${avatarMedia.id}:`, error)
            // Don't fail the group creation, just log the error
          }
        } else {
          console.warn('Image processing service not available, avatar will not be processed')
        }
      } catch (error) {
        console.error('Error uploading avatar:', error)
        return res.status(500).json({ success: false, error: 'Failed to upload avatar' })
      }
    }

    // Handle cover photo upload
    if (files.coverPhoto && files.coverPhoto[0]) {
      try {
        const coverFile = files.coverPhoto[0]
        
        // Upload original image to S3 first
        const { uploadToS3 } = await import('@/utils/s3Service')
        const s3Key = await uploadToS3(
          coverFile.buffer,
          coverFile.originalname,
          coverFile.mimetype,
          userId
        )
        
        // Create Media record for cover photo with PENDING status
        const coverPhotoMedia = await prisma.media.create({
          data: {
            url: s3Key,
            s3Key: s3Key,
            originalFilename: coverFile.originalname,
            altText: `${validatedData.name} cover photo`,
            caption: `Cover photo for ${validatedData.name}`,
            size: Math.ceil(coverFile.size / 1024), // Convert bytes to kilobytes
            mimeType: coverFile.mimetype,
            mediaType: 'IMAGE',
            processingStatus: 'PENDING',
            authorId: userId,
            visibility: 'PUBLIC'
          }
        })
        
        coverPhotoMediaId = coverPhotoMedia.id
        console.log('Cover photo uploaded and Media record created:', coverPhotoMediaId)
        
        // Queue image processing job
        const imageProcessingService = req.app.locals.imageProcessingService
        if (imageProcessingService) {
          try {
            await imageProcessingService.requestImageProcessing(
              coverPhotoMedia.id,
              userId,
              s3Key,
              coverFile.originalname
            )
            console.log(`Cover photo processing job queued for media ${coverPhotoMedia.id}`)
          } catch (error) {
            console.error(`Failed to queue cover photo processing job for media ${coverPhotoMedia.id}:`, error)
            // Don't fail the group creation, just log the error
          }
        } else {
          console.warn('Image processing service not available, cover photo will not be processed')
        }
      } catch (error) {
        console.error('Error uploading cover photo:', error)
        return res.status(500).json({ success: false, error: 'Failed to upload cover photo' })
      }
    }
  }

  // Create group and add creator as owner
  const group = await prisma.$transaction(async (tx) => {
    const newGroup = await tx.group.create({
      data: {
        ...validatedData,
        avatarId: avatarMediaId,
        coverPhotoId: coverPhotoMediaId,
        members: {
          create: {
            userId,
            role: 'OWNER',
            status: 'ACTIVE'
          }
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true
              }
            }
          }
        }
      }
    })

    // Log the action
    await tx.groupAction.create({
      data: {
        groupId: newGroup.id,
        userId,
        actionType: 'GROUP_CREATED',
        description: `Group "${newGroup.name}" created`,
        metadata: { groupName: newGroup.name, visibility: newGroup.visibility }
      }
    })

    return newGroup
  })

  res.status(201).json({
    success: true,
    data: { group },
    message: 'Group created successfully'
  })
}))

// Get user's groups
router.get('/user/:userId', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params
  const requestingUserId = req.user?.id

  if (!requestingUserId) {
    return res.status(401).json({ success: false, error: 'User not authenticated' })
  }

  // Users can only see their own groups
  if (requestingUserId !== userId) {
    return res.status(403).json({ success: false, error: 'Access denied' })
  }

  const userGroups = await prisma.group.findMany({
    where: {
      members: {
        some: {
          userId: requestingUserId,
          status: 'ACTIVE'
        }
      }
    },
    include: {
      avatarMedia: {
        select: {
          id: true
        }
      },
      coverPhotoMedia: {
        select: {
          id: true
        }
      },
      _count: {
        select: {
          members: { where: { status: 'ACTIVE' } },
          posts: { where: { status: 'APPROVED' } }
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  // Map the response to include avatar and coverPhoto fields
  const groupsWithImages = userGroups.map(group => ({
    ...group,
    avatar: group.avatarMedia?.id,
    coverPhoto: group.coverPhotoMedia?.id
  }))

  res.json({
    success: true,
    data: { groups: groupsWithImages }
  })
}))

// Get group by username or ID
router.get('/:identifier', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { identifier } = req.params
  const userId = req.user?.id

  // Try to find by username first, then by ID
  const group = await prisma.group.findFirst({
    where: {
      OR: [
        { username: identifier },
        { id: identifier }
      ]
    },
    include: {
      members: {
        where: { status: 'ACTIVE' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true
            }
          }
        }
      },
      avatarMedia: {
        select: {
          id: true,
          url: true,
          s3Key: true
        }
      },
      coverPhotoMedia: {
        select: {
          id: true,
          url: true,
          s3Key: true
        }
      },
      _count: {
        select: {
          members: { where: { status: 'ACTIVE' } },
          posts: { where: { status: 'APPROVED' } }
        }
      }
    }
  })

  if (!group) {
    return res.status(404).json({ success: false, error: 'Group not found' })
  }

  // Check if user can see the group
  const isMember = userId ? await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId } }
  }) : null

  const canView = group.visibility === 'PUBLIC' || 
                  group.visibility === 'PRIVATE_VISIBLE' || 
                  (group.visibility === 'PRIVATE_HIDDEN' && isMember)



  if (!canView) {
    return res.status(404).json({ success: false, error: 'Group not found' })
  }

  // Always include members but filter based on permissions
  const responseGroup = {
    id: group.id,
    name: group.name,
    username: group.username,
    description: group.description,
    type: group.type,
    visibility: group.visibility,
    avatar: group.avatarMedia?.id,
    coverPhoto: group.coverPhotoMedia?.id,
    createdAt: group.createdAt,
    _count: group._count,
    members: group.members // Always include members
  }

  if (isMember) {
    // Member can see everything
    res.json({
      success: true,
      data: { 
        group: {
          ...responseGroup,
          rules: group.rules,
          moderationPolicy: group.moderationPolicy,
          updatedAt: group.updatedAt
        }
      }
    })
  } else {
    // Non-member can see public info and members
    res.json({
      success: true,
      data: { group: responseGroup }
    })
  }
}))

// Update group (owner/admin only)
router.put('/:groupIdentifier', authMiddleware, upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'coverPhoto', maxCount: 1 }
]), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { groupIdentifier } = req.params
  
  if (!userId) {
    return res.status(401).json({ success: false, error: 'User not authenticated' })
  }

  // Find the group by identifier
  const group = await prisma.group.findFirst({
    where: { 
      OR: [
        { id: groupIdentifier },
        { username: groupIdentifier }
      ]
    }
  })

  if (!group) {
    return res.status(404).json({ success: false, error: 'Group not found' })
  }

  // Check permissions
  if (!(await hasGroupPermission(userId, group.id, 'ADMIN'))) {
    return res.status(403).json({ success: false, error: 'Insufficient permissions' })
  }

  const validatedData = updateGroupSchema.parse(req.body)
  
  // Handle file uploads if provided
  let avatarMediaId: string | undefined
  let coverPhotoMediaId: string | undefined

  if (req.files) {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] }
    
    // Handle avatar upload
    if (files.avatar && files.avatar[0]) {
      const avatarFile = files.avatar[0]
      const avatarKey = `groups/${group.id}/avatar/${Date.now()}-${avatarFile.originalname}`
      
      // Upload to S3
      const { uploadImageToS3 } = await import('@/utils/s3Service')
      await uploadImageToS3(avatarFile.buffer, avatarKey, avatarFile.mimetype)
      
      // Create media record
      const avatarMedia = await prisma.media.create({
        data: {
          url: `${process.env.IDRIVE_ENDPOINT}/${process.env.IDRIVE_BUCKET_NAME}/${avatarKey}`,
          s3Key: avatarKey,
          mimeType: avatarFile.mimetype,
          mediaType: 'IMAGE',
          processingStatus: 'COMPLETED',
          authorId: userId,
          visibility: 'PUBLIC'
        }
      })
      
      avatarMediaId = avatarMedia.id
    }
    
    // Handle cover photo upload
    if (files.coverPhoto && files.coverPhoto[0]) {
      const coverFile = files.coverPhoto[0]
      const coverKey = `groups/${group.id}/cover/${Date.now()}-${coverFile.originalname}`
      
      // Upload to S3
      const { uploadImageToS3 } = await import('@/utils/s3Service')
      await uploadImageToS3(coverFile.buffer, coverKey, coverFile.mimetype)
      
      // Create media record
      const coverMedia = await prisma.media.create({
        data: {
          url: `${process.env.IDRIVE_ENDPOINT}/${process.env.IDRIVE_BUCKET_NAME}/${coverKey}`,
          s3Key: coverKey,
          mimeType: coverFile.mimetype,
          mediaType: 'IMAGE',
          processingStatus: 'COMPLETED',
          authorId: userId,
          visibility: 'PUBLIC'
        }
      })
      
      coverPhotoMediaId = coverMedia.id
    }
  }
  
  const updatedGroup = await prisma.$transaction(async (tx) => {
    // Prepare update data
    const updateData: any = { ...validatedData }
    
    if (avatarMediaId) {
      updateData.avatarId = avatarMediaId
    }
    if (coverPhotoMediaId) {
      updateData.coverPhotoId = coverPhotoMediaId
    }
    
    const result = await tx.group.update({
      where: { id: group.id },
      data: updateData,
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true
              }
            }
          }
        }
      }
    })

    // Log the action
    await tx.groupAction.create({
      data: {
        groupId: group.id,
        userId,
        actionType: 'GROUP_UPDATED',
        description: 'Group settings updated',
        metadata: { 
          updatedFields: Object.keys(validatedData),
          filesUpdated: {
            avatar: !!avatarMediaId,
            coverPhoto: !!coverPhotoMediaId
          }
        }
      }
    })

    return result
  })

  res.json({
    success: true,
    data: { group: updatedGroup },
    message: 'Group updated successfully'
  })
}))

// Get group feed (posts)
router.get('/:groupIdentifier/feed', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { groupIdentifier } = req.params
  const { page = 1, limit = 20 } = req.query
  const userId = req.user?.id
  
  const offset = (Number(page) - 1) * Number(limit)

  // Check if group exists and user can access it
  const group = await prisma.group.findFirst({
    where: { 
      OR: [
        { id: groupIdentifier },
        { username: groupIdentifier }
      ]
    }
  })

  if (!group) {
    return res.status(404).json({ success: false, error: 'Group not found' })
  }

  const isMember = userId ? await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId } }
  }) : null

  const canView = group.visibility === 'PUBLIC' || 
                  group.visibility === 'PRIVATE_VISIBLE' || 
                  (group.visibility === 'PRIVATE_HIDDEN' && isMember)

  if (!canView) {
    return res.status(403).json({ success: false, error: 'Access denied' })
  }

  // Get posts based on user permissions
  let whereClause: any = null

  // Check group visibility and user membership
  if (group.visibility === 'PRIVATE_HIDDEN' && !isMember) {
    // Private hidden groups: no posts visible to non-members
    whereClause = { groupId: group.id, id: 'NO_ACCESS' } // This will return no results
    console.log(`Non-member ${userId} cannot see posts in private hidden group`)
  } else if (group.visibility === 'PRIVATE_VISIBLE' && !isMember) {
    // Private visible groups: no posts visible to non-members
    whereClause = { groupId: group.id, id: 'NO_ACCESS' } // This will return no results
    console.log(`Non-member ${userId} cannot see posts in private visible group`)
  } else if (isMember && (isMember.role === 'ADMIN' || isMember.role === 'OWNER')) {
    // Admins/Owners can see all posts (approved + pending)
    whereClause = {
      groupId: group.id,
      OR: [
        { status: 'APPROVED' },
        { status: 'PENDING_APPROVAL' }
      ]
    }
    console.log(`Admin/Owner ${userId} can see all posts including pending`)
  } else if (isMember) {
    // Regular members can see approved posts plus their own pending posts
    whereClause = {
      groupId: group.id,
      OR: [
        { status: 'APPROVED' },
        {
          AND: [
            { status: 'PENDING_APPROVAL' },
            { post: { authorId: userId } }
          ]
        }
      ]
    }
    console.log(`Regular member ${userId} can see approved posts plus their own pending`)
  } else {
    // Public groups: non-members can see approved posts only
    whereClause = {
      groupId: group.id,
      status: 'APPROVED'
    }
    console.log(`Non-member ${userId} can see approved posts in public group`)
  }

  const [posts, total] = await Promise.all([
    prisma.groupPost.findMany({
      where: whereClause,
      include: {
        post: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true
              }
            },
            media: {
              include: {
                media: true
              },
              orderBy: { order: 'asc' }
            },
            _count: {
              select: {
                comments: true,
                reactions: true
              }
            }
          }
        }
      },
      orderBy: [
        { isPriority: 'desc' },
        { post: { createdAt: 'desc' } }
      ],
      skip: offset,
      take: Number(limit)
    }),
    prisma.groupPost.count({ where: whereClause })
  ])

  // Map media to array of media objects in order, maintaining the structure PostMediaDisplay expects
  const postsWithOrderedMedia = posts.map(groupPost => ({
    ...groupPost,
    post: {
      ...groupPost.post,
      media: groupPost.post.media.map(pm => ({
        id: pm.media.id, // Use the actual Media.id, not PostMedia.id
        order: pm.order,
        isLocked: pm.isLocked,
        media: pm.media // Keep the nested media structure
      }))
    }
  }))

  res.json({
    success: true,
    data: {
      posts: postsWithOrderedMedia,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  })
}))

// Approve or reject a group post (admin/owner only)
router.put('/:groupIdentifier/posts/:postId/approve', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { groupIdentifier, postId } = req.params
  const { action, reason } = req.body // action: 'approve' | 'reject'
  
  if (!userId) {
    return res.status(401).json({ success: false, error: 'User not authenticated' })
  }

  // Find the group by identifier
  const group = await prisma.group.findFirst({
    where: { 
      OR: [
        { id: groupIdentifier },
        { username: groupIdentifier }
      ]
    }
  })

  if (!group) {
    return res.status(404).json({ success: false, error: 'Group not found' })
  }

  // Check if user is admin or owner
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId } }
  })

  if (!membership || membership.status !== 'ACTIVE' || (membership.role !== 'ADMIN' && membership.role !== 'OWNER')) {
    return res.status(403).json({ success: false, error: 'Insufficient permissions' })
  }

  // Find the group post
  const groupPost = await prisma.groupPost.findUnique({
    where: { groupId_postId: { groupId: group.id, postId } }
  })

  if (!groupPost) {
    return res.status(404).json({ success: false, error: 'Post not found in group' })
  }

  if (groupPost.status !== 'PENDING_APPROVAL') {
    return res.status(400).json({ success: false, error: 'Post is not pending approval' })
  }

  // Update post status
  const updateData: any = {}
  
  if (action === 'approve') {
    updateData.status = 'APPROVED'
    updateData.approvedAt = new Date()
    updateData.approvedBy = userId
    updateData.rejectedAt = null
    updateData.rejectedBy = null
    updateData.rejectionReason = null
  } else if (action === 'reject') {
    updateData.status = 'REJECTED'
    updateData.rejectedAt = new Date()
    updateData.rejectedBy = userId
    updateData.rejectionReason = reason
    updateData.approvedAt = null
    updateData.approvedBy = null
  }

  const updatedGroupPost = await prisma.$transaction(async (tx) => {
    const post = await tx.groupPost.update({
      where: { groupId_postId: { groupId: group.id, postId } },
      data: updateData,
      include: {
        post: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true
              }
            },
            media: {
              include: {
                media: true
              }
            },
            _count: {
              select: {
                comments: true,
                reactions: true
              }
            }
          }
        }
      }
    })

    // Log the action
    const actionType = action === 'approve' ? 'POST_APPROVED' : 'POST_REJECTED'
    
    await tx.groupAction.create({
      data: {
        groupId: group.id,
        userId,
        actionType: actionType as any,
        description: `Post ${action}d${reason ? `: ${reason}` : ''}`,
        metadata: { postId, action, reason }
      }
    })

    return post
  })

  res.json({
    success: true,
    data: { groupPost: updatedGroupPost },
    message: `Post ${action}d successfully`
  })
}))

// Post to group
router.post('/:groupIdentifier/posts', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { groupIdentifier } = req.params
  
  if (!userId) {
    return res.status(401).json({ success: false, error: 'User not authenticated' })
  }

  // Find the group by identifier
  const group = await prisma.group.findFirst({
    where: { 
      OR: [
        { id: groupIdentifier },
        { username: groupIdentifier }
      ]
    }
  })

  if (!group) {
    return res.status(404).json({ success: false, error: 'Group not found' })
  }

  const validatedData = postToGroupSchema.parse(req.body)

  // Check if user is a member
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId } }
  })

  if (!membership || membership.status !== 'ACTIVE') {
    return res.status(403).json({ success: false, error: 'Must be an active member to post' })
  }

  // Check if post exists and belongs to user
  const post = await prisma.post.findFirst({
    where: {
      id: validatedData.postId,
      authorId: userId
    }
  })

  if (!post) {
    return res.status(404).json({ success: false, error: 'Post not found or access denied' })
  }

  // Check if post is already in this group
  const existingGroupPost = await prisma.groupPost.findUnique({
    where: { groupId_postId: { groupId: group.id, postId: validatedData.postId } }
  })

  if (existingGroupPost) {
    return res.status(409).json({ success: false, error: 'Post already exists in this group' })
  }

  // Determine post status based on moderation policy
  let postStatus: 'APPROVED' | 'PENDING_APPROVAL' = 'APPROVED'
  
  if (group.moderationPolicy === 'ADMIN_APPROVAL_REQUIRED') {
    postStatus = 'PENDING_APPROVAL'
  } else if (group.moderationPolicy === 'SELECTIVE_MODERATION' && membership.role === 'MEMBER') {
    postStatus = 'PENDING_APPROVAL'
  }

  // Create group post
  const groupPost = await prisma.groupPost.create({
    data: {
      groupId: group.id,
      postId: validatedData.postId,
      status: postStatus,
      isPriority: validatedData.isPriority
    },
    include: {
      post: {
        include: {
          author: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true
            }
          }
        }
      }
    }
  })

  // Log the action
  await logGroupAction(group.id, userId, 'POST_APPROVED', `Posted to group: ${post.title || 'Untitled post'}`)

  res.status(201).json({
    success: true,
    data: { groupPost },
    message: postStatus === 'APPROVED' ? 'Post added to group' : 'Post submitted for approval'
  })
}))

// Apply to join group
router.post('/:groupIdentifier/apply', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { groupIdentifier } = req.params
  
  if (!userId) {
    return res.status(401).json({ success: false, error: 'User not authenticated' })
  }

  const validatedData = applicationSchema.parse(req.body)

  // Check if group exists and accepts applications
  const group = await prisma.group.findFirst({
    where: { 
      OR: [
        { id: groupIdentifier },
        { username: groupIdentifier }
      ]
    }
  })

  if (!group) {
    return res.status(404).json({ success: false, error: 'Group not found' })
  }

  if (group.visibility === 'PUBLIC') {
    return res.status(400).json({ success: false, error: 'Public groups do not require applications' })
  }

  // Check if user is already a member
  const existingMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId } }
  })

  if (existingMember) {
    return res.status(409).json({ success: false, error: 'Already a member of this group' })
  }

  // Check if user already has a pending application
  const existingApplication = await prisma.groupApplication.findUnique({
    where: { groupId_applicantId: { groupId: group.id, applicantId: userId } }
  })

  if (existingApplication) {
    return res.status(409).json({ success: false, error: 'Application already submitted' })
  }

  // Create application
  const application = await prisma.groupApplication.create({
    data: {
      groupId: group.id,
      applicantId: userId,
      message: validatedData.message
    },
    include: {
      applicant: {
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true
        }
      }
    }
  })

  res.status(201).json({
    success: true,
    data: { application },
    message: 'Application submitted successfully'
  })
}))

// Get pending applications (admin/owner only)
router.get('/:groupIdentifier/applications', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { groupIdentifier } = req.params
  
  if (!userId) {
    return res.status(401).json({ success: false, error: 'User not authenticated' })
  }

  // Find group by ID or username
  const group = await prisma.group.findFirst({
    where: { 
      OR: [
        { id: groupIdentifier },
        { username: groupIdentifier }
      ]
    }
  })

  if (!group) {
    return res.status(404).json({ success: false, error: 'Group not found' })
  }

  // Check if user is admin or owner
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId } }
  })

  if (!member || (member.role !== 'ADMIN' && member.role !== 'OWNER')) {
    return res.status(403).json({ success: false, error: 'Insufficient permissions' })
  }

  // Get pending applications with applicant history
  const applications = await Promise.all(
    (await prisma.groupApplication.findMany({
      where: {
        groupId: group.id,
        status: 'PENDING'
      },
      include: {
        applicant: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    })).map(async (application) => {
      // Get applicant's group history
      const groupActions = await prisma.groupAction.findMany({
        where: {
          groupId: group.id,
          userId: application.applicantId
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 10 // Get last 10 actions
      })

      // Check if user was previously a member
      const previousMembership = await prisma.groupMember.findFirst({
        where: {
          groupId: group.id,
          userId: application.applicantId
        },
        orderBy: {
          joinedAt: 'desc'
        }
      })

      // Get user's overall activity stats
      const [totalPosts, totalComments] = await Promise.all([
        prisma.post.count({
          where: {
            authorId: application.applicantId
          }
        }),
        prisma.comment.count({
          where: {
            authorId: application.applicantId
          }
        })
      ])

      return {
        ...application,
        applicantHistory: {
          groupActions,
          previousMembership,
          totalPosts,
          totalComments
        }
      }
    })
  )

  res.json({
    success: true,
    data: { applications }
  })
}))

// Invite member to group (admin/owner only)
router.post('/:groupIdentifier/invite', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { groupIdentifier } = req.params
  
  if (!userId) {
    return res.status(401).json({ success: false, error: 'User not authenticated' })
  }

  // Find the group by identifier
  const group = await prisma.group.findFirst({
    where: { 
      OR: [
        { id: groupIdentifier },
        { username: groupIdentifier }
      ]
    }
  })

  if (!group) {
    return res.status(404).json({ success: false, error: 'Group not found' })
  }

  // Check permissions
  if (!(await hasGroupPermission(userId, group.id, 'ADMIN'))) {
    return res.status(403).json({ success: false, error: 'Insufficient permissions' })
  }

  const validatedData = inviteMemberSchema.parse(req.body)

  if (!validatedData.email && !validatedData.userId) {
    return res.status(400).json({ success: false, error: 'Email or user ID required' })
  }

  // Generate invite code
  const inviteCode = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  // Create invitation
  const invitation = await prisma.groupInvitation.create({
    data: {
      groupId: group.id,
      inviterId: userId,
      inviteeEmail: validatedData.email,
      inviteeUserId: validatedData.userId,
      inviteCode,
      expiresAt
    }
  })

  // Log the action
  await logGroupAction(group.id, userId, 'MEMBER_JOINED', `Invited ${validatedData.email || validatedData.userId} to group`)

  res.status(201).json({
    success: true,
    data: { invitation },
    message: 'Invitation sent successfully'
  })
}))

// Update member role (admin/owner only)
router.put('/:groupIdentifier/members/:memberId/role', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { groupIdentifier, memberId } = req.params
  const { newRole } = req.body
  
  if (!userId) {
    return res.status(401).json({ success: false, error: 'User not authenticated' })
  }

  // Find group by ID or username
  const group = await prisma.group.findFirst({
    where: { 
      OR: [
        { id: groupIdentifier },
        { username: groupIdentifier }
      ]
    }
  })

  if (!group) {
    return res.status(404).json({ success: false, error: 'Group not found' })
  }

  // Check if user is admin or owner
  const currentMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId } }
  })

  if (!currentMember || (currentMember.role !== 'ADMIN' && currentMember.role !== 'OWNER')) {
    return res.status(403).json({ success: false, error: 'Insufficient permissions' })
  }

  // Get the member to update
  const targetMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId: memberId } }
  })

  if (!targetMember) {
    return res.status(404).json({ success: false, error: 'Member not found' })
  }

  // Role hierarchy checks
  if (currentMember.role === 'ADMIN') {
    // Admins can only promote/demote regular members
    if (targetMember.role !== 'MEMBER' && newRole !== 'MEMBER') {
      return res.status(403).json({ success: false, error: 'Admins can only promote/demote regular members' })
    }
  } else if (currentMember.role === 'OWNER') {
    // Owners can promote/demote anyone except themselves
    if (userId === memberId) {
      return res.status(400).json({ success: false, error: 'Owners cannot change their own role' })
    }
  }

  // Update the member's role
  const updatedMember = await prisma.groupMember.update({
    where: { groupId_userId: { groupId: group.id, userId: memberId } },
    data: { role: newRole },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true
        }
      }
    }
  })

  // Log the action
  await logGroupAction(group.id, userId, 'ROLE_CHANGED', `Changed ${targetMember.userId}'s role from ${targetMember.role} to ${newRole}`)

  res.json({
    success: true,
    data: { member: updatedMember },
    message: 'Member role updated successfully'
  })
}))

// Review application (admin/owner only)
router.put('/:groupIdentifier/applications/:applicationId', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { groupIdentifier, applicationId } = req.params
  
  if (!userId) {
    return res.status(401).json({ success: false, error: 'User not authenticated' })
  }

  // Validate request body
  console.log('Application review request body:', req.body)
  const validatedData = applicationReviewSchema.parse(req.body)
  const { action, message } = validatedData
  console.log('Validated data:', { action, message })

  // Find group by ID or username
  const group = await prisma.group.findFirst({
    where: { 
      OR: [
        { id: groupIdentifier },
        { username: groupIdentifier }
      ]
    }
  })

  if (!group) {
    return res.status(404).json({ success: false, error: 'Group not found' })
  }

  // Check if user is admin or owner
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId } }
  })

  if (!member || (member.role !== 'ADMIN' && member.role !== 'OWNER')) {
    return res.status(403).json({ success: false, error: 'Insufficient permissions' })
  }

  // Get the application
  const application = await prisma.groupApplication.findUnique({
    where: { id: applicationId }
  })

  if (!application || application.groupId !== group.id) {
    return res.status(404).json({ success: false, error: 'Application not found' })
  }

  if (application.status !== 'PENDING') {
    return res.status(400).json({ success: false, error: 'Application has already been processed' })
  }

  if (action === 'approve') {
    // Add user to group
    await prisma.$transaction(async (tx) => {
      await tx.groupMember.create({
        data: {
          groupId: group.id,
          userId: application.applicantId,
          role: 'MEMBER',
          status: 'ACTIVE'
        }
      })

      await tx.groupApplication.update({
        where: { id: applicationId },
        data: {
          status: 'ACCEPTED',
          reviewedAt: new Date(),
          reviewedBy: userId
        }
      })
    })

    // Log the action
    await logGroupAction(group.id, userId, 'MEMBER_JOINED', `Approved application from ${application.applicantId}`)

    res.json({
      success: true,
      message: 'Application approved successfully'
    })
  } else if (action === 'reject') {
    // Reject the application
    await prisma.groupApplication.update({
      where: { id: applicationId },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        reviewedBy: userId
      }
    })

    // Log the action
    await logGroupAction(group.id, userId, 'SETTINGS_CHANGED', `Rejected application from ${application.applicantId}`)

    res.json({
      success: true,
      message: 'Application rejected successfully'
    })
  } else {
    res.status(400).json({ success: false, error: 'Invalid action' })
  }
}))

// Accept group invitation
router.post('/invitations/:inviteCode/accept', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { inviteCode } = req.params
  
  if (!userId) {
    return res.status(401).json({ success: false, error: 'User not authenticated' })
  }

  // Find invitation
  const invitation = await prisma.groupInvitation.findUnique({
    where: { inviteCode },
    include: { group: true }
  })

  if (!invitation) {
    return res.status(404).json({ success: false, error: 'Invalid invitation code' })
  }

  if (invitation.expiresAt < new Date()) {
    return res.status(400).json({ success: false, error: 'Invitation has expired' })
  }

  if (invitation.acceptedAt) {
    return res.status(400).json({ success: false, error: 'Invitation already accepted' })
  }

  // Check if user is already a member
  const existingMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: invitation.groupId, userId } }
  })

  if (existingMember) {
    return res.status(409).json({ success: false, error: 'Already a member of this group' })
  }

  // Accept invitation and add member
  await prisma.$transaction(async (tx) => {
    await tx.groupMember.create({
      data: {
        groupId: invitation.groupId,
        userId,
        role: 'MEMBER',
        status: 'ACTIVE'
      }
    })

    await tx.groupInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() }
    })

    // Log the action
    await tx.groupAction.create({
      data: {
        groupId: invitation.groupId,
        userId,
        actionType: 'MEMBER_JOINED',
        description: `Joined group via invitation`,
        metadata: { inviterId: invitation.inviterId }
      }
    })
  })

  res.json({
    success: true,
    message: 'Successfully joined group'
  })
}))

// Get group members with detailed stats (admin/member only)
router.get('/:groupIdentifier/members', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { groupIdentifier } = req.params
  const { page = 1, limit = 50, detailed = false } = req.query
  const userId = req.user?.id
  
  const offset = (Number(page) - 1) * Number(limit)

  // Check if group exists
  const group = await prisma.group.findFirst({
    where: { 
      OR: [
        { id: groupIdentifier },
        { username: groupIdentifier }
      ]
    }
  })

  if (!group) {
    return res.status(404).json({ success: false, error: 'Group not found' })
  }

  // Check if user can view members
  const isMember = userId ? await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId } }
  }) : null

  // Users can view members if:
  // 1. Group is public, OR
  // 2. User is a member, OR  
  // 3. User is authenticated (for private groups, show limited info)
  const canView = group.visibility === 'PUBLIC' || isMember || userId



  if (!canView) {
    return res.status(403).json({ success: false, error: 'Access denied' })
  }

  // Get basic member info
  const [members, total] = await Promise.all([
    prisma.groupMember.findMany({
      where: { 
        groupId: group.id,
        status: 'ACTIVE'
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true
          }
        }
      },
      orderBy: [
        { role: 'desc' },
        { joinedAt: 'asc' }
      ],
      skip: offset,
      take: Number(limit)
    }),
    prisma.groupMember.count({
      where: { 
        groupId: group.id,
        status: 'ACTIVE'
      }
    })
  ])

  // If detailed stats are requested and user is admin/owner, get additional data
  if (detailed === 'true' && isMember && (isMember.role === 'ADMIN' || isMember.role === 'OWNER')) {
    const membersWithStats = await Promise.all(
      members.map(async (member) => {
        const ninetyDaysAgo = new Date()
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

        // Get post counts
        const [totalPosts, recentPosts] = await Promise.all([
          prisma.post.count({
            where: {
              authorId: member.userId,
              groupPosts: {
                some: {
                  groupId: group.id,
                  status: 'APPROVED'
                }
              }
            }
          }),
          prisma.post.count({
            where: {
              authorId: member.userId,
              groupPosts: {
                some: {
                  groupId: group.id,
                  status: 'APPROVED'
                }
              },
              createdAt: {
                gte: ninetyDaysAgo
              }
            }
          })
        ])

        // Get comment counts
        const [totalComments, recentComments] = await Promise.all([
          prisma.comment.count({
            where: {
              authorId: member.userId,
              post: {
                groupPosts: {
                  some: {
                    groupId: group.id,
                    status: 'APPROVED'
                  }
                }
              }
            }
          }),
          prisma.comment.count({
            where: {
              authorId: member.userId,
              post: {
                groupPosts: {
                  some: {
                    groupId: group.id,
                    status: 'APPROVED'
                  }
                }
              },
              createdAt: {
                gte: ninetyDaysAgo
              }
            }
          })
        ])

        // Get reaction stats
        const [reactionsGiven, reactionsReceived] = await Promise.all([
          prisma.reaction.count({
            where: {
              authorId: member.userId,
              post: {
                groupPosts: {
                  some: {
                    groupId: group.id,
                    status: 'APPROVED'
                  }
                }
              }
            }
          }),
          prisma.reaction.count({
            where: {
              post: {
                authorId: member.userId,
                groupPosts: {
                  some: {
                    groupId: group.id,
                    status: 'APPROVED'
                  }
                }
              }
            }
          })
        ])

        return {
          ...member,
          stats: {
            totalPosts,
            recentPosts,
            totalComments,
            recentComments,
            reactionsGiven,
            reactionsReceived
          }
        }
      })
    )

    return res.json({
      success: true,
      data: {
        members: membersWithStats,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    })
  }

  res.json({
    success: true,
    data: {
      members,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  })
}))

// Moderate group post (admin/moderator only)
router.put('/:groupIdentifier/posts/:postId/moderate', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { groupIdentifier, postId } = req.params
  const { action, reason } = req.body // action: 'approve' | 'reject' | 'delete'
  
  if (!userId) {
    return res.status(401).json({ success: false, error: 'User not authenticated' })
  }

  // Find the group by identifier
  const group = await prisma.group.findFirst({
    where: { 
      OR: [
        { id: groupIdentifier },
        { username: groupIdentifier }
      ]
    }
  })

  if (!group) {
    return res.status(404).json({ success: false, error: 'Group not found' })
  }

  // Check permissions
  if (!(await hasGroupPermission(userId, group.id, 'MODERATOR'))) {
    return res.status(403).json({ success: false, error: 'Insufficient permissions' })
  }

  // Find group post
  const groupPost = await prisma.groupPost.findUnique({
    where: { groupId_postId: { groupId: group.id, postId } }
  })

  if (!groupPost) {
    return res.status(404).json({ success: false, error: 'Post not found in group' })
  }

  // Update post status
  const updateData: any = {}
  
  if (action === 'approve') {
    updateData.status = 'APPROVED'
    updateData.approvedAt = new Date()
    updateData.approvedBy = userId
    updateData.rejectedAt = null
    updateData.rejectedBy = null
    updateData.rejectionReason = null
  } else if (action === 'reject') {
    updateData.status = 'REJECTED'
    updateData.rejectedAt = new Date()
    updateData.rejectedBy = userId
    updateData.rejectionReason = reason
    updateData.approvedAt = null
    updateData.approvedBy = null
  } else if (action === 'delete') {
    updateData.status = 'DELETED'
  }

  const updatedGroupPost = await prisma.$transaction(async (tx) => {
    const post = await tx.groupPost.update({
      where: { groupId_postId: { groupId: group.id, postId } },
      data: updateData,
      include: {
        post: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                username: true
              }
            }
          }
        }
      }
    })

    // Log the action
    const actionType = action === 'approve' ? 'POST_APPROVED' : 
                      action === 'reject' ? 'POST_REJECTED' : 'POST_DELETED'
    
    await tx.groupAction.create({
      data: {
        groupId: group.id,
        userId,
        actionType: actionType as any,
        description: `Post ${action}d${reason ? `: ${reason}` : ''}`,
        metadata: { postId, action, reason }
      }
    })

    return post
  })

  res.json({
    success: true,
    data: { groupPost: updatedGroupPost },
    message: `Post ${action}d successfully`
  })
}))

// Search groups
router.get('/search', asyncHandler(async (req: Request, res: Response) => {
  const { q, type, visibility, page = 1, limit = 20 } = req.query
  const offset = (Number(page) - 1) * Number(limit)

  const whereClause: any = {
    isActive: true
  }

  if (q) {
    whereClause.OR = [
      { name: { contains: q as string, mode: 'insensitive' } },
      { description: { contains: q as string, mode: 'insensitive' } }
    ]
  }

  if (type) {
    whereClause.type = type
  }

  if (visibility) {
    whereClause.visibility = visibility
  } else {
    // Only show public and private visible groups in search
    whereClause.visibility = { in: ['PUBLIC', 'PRIVATE_VISIBLE'] }
  }

  const [groups, total] = await Promise.all([
    prisma.group.findMany({
      where: whereClause,
      include: {
        avatarMedia: {
          select: {
            id: true
          }
        },
        coverPhotoMedia: {
          select: {
            id: true
          }
        },
        _count: {
          select: {
            members: { where: { status: 'ACTIVE' } },
            posts: { where: { status: 'APPROVED' } }
          }
        }
      },
      orderBy: [
        { createdAt: 'desc' }
      ],
      skip: offset,
      take: Number(limit)
    }),
    prisma.group.count({ where: whereClause })
  ])

  // Map the response to include avatar and coverPhoto fields
  const groupsWithImages = groups.map(group => ({
    ...group,
    avatar: group.avatarMedia?.id,
    coverPhoto: group.coverPhotoMedia?.id
  }))

  res.json({
    success: true,
    data: {
      groups: groupsWithImages,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  })
}))

// Get recent group activity (admin/owner only)
router.get('/:groupIdentifier/activity', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { groupIdentifier } = req.params
  const { limit = 20 } = req.query
  
  if (!userId) {
    return res.status(401).json({ success: false, error: 'User not authenticated' })
  }

  // Find the group by identifier
  const group = await prisma.group.findFirst({
    where: { 
      OR: [
        { id: groupIdentifier },
        { username: groupIdentifier }
      ]
    }
  })

  if (!group) {
    return res.status(404).json({ success: false, error: 'Group not found' })
  }

  // Check permissions
  if (!(await hasGroupPermission(userId, group.id, 'ADMIN'))) {
    return res.status(403).json({ success: false, error: 'Insufficient permissions' })
  }

  // Get recent group actions
  const recentActions = await prisma.groupAction.findMany({
    where: {
      groupId: group.id
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: Number(limit)
  })

  // Get recent post submissions and approvals
  const recentPosts = await prisma.groupPost.findMany({
    where: {
      groupId: group.id,
      status: { in: ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'] }
    },
    include: {
      post: {
        select: {
          id: true,
          title: true,
          content: true,
          authorId: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: Number(limit)
  })

  // Combine and sort activities by date
  const activities = [
    ...recentActions.map(action => ({
      type: 'action' as const,
      id: action.id,
      timestamp: action.createdAt,
      actionType: action.actionType,
      description: action.description,
      user: action.user,
      metadata: action.metadata
    })),
    ...recentPosts.map(groupPost => ({
      type: 'post' as const,
      id: groupPost.id,
      timestamp: groupPost.createdAt,
      status: groupPost.status,
      post: groupPost.post,
      metadata: {
        postId: groupPost.postId,
        isPriority: groupPost.isPriority
      }
    }))
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  res.json({
    success: true,
    data: { activities: activities.slice(0, Number(limit)) }
  })
}))

export default router 