import { Router, Request, Response } from 'express'
import { prisma } from '@/index'
import { asyncHandler } from '@/middleware/errorHandler'
import { authMiddleware, optionalAuthMiddleware } from '@/middleware/auth'
import { AuthenticatedRequest } from '@/types'

const router = Router()

// Get all posts (public feed)
router.get('/', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { page = 1, limit = 20 } = req.query
  const offset = (Number(page) - 1) * Number(limit)

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where: {
        publicationStatus: 'PUBLIC',
        visibility: 'PUBLIC'
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true
          }
        },
        reactions: {
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
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        _count: {
          select: {
            comments: true,
            reactions: true
          }
        },
        media: {
          include: { 
            media: {
              select: {
                id: true,
                s3Key: true,
                thumbnailS3Key: true,
                originalFilename: true,
                altText: true,
                caption: true,
                tags: true,
                visibility: true,
                createdAt: true,
                updatedAt: true,
                width: true,
                height: true,
                size: true,
                mimeType: true,
                authorId: true,
                mediaType: true,
                processingStatus: true,
                duration: true,
                codec: true,
                bitrate: true,
                framerate: true,
                videoUrl: true,
                videoS3Key: true
              }
            }
          },
          orderBy: { order: 'asc' }
        }
      },
      skip: offset,
      take: Number(limit),
      orderBy: { createdAt: 'desc' }
    }),
    prisma.post.count({
      where: {
        publicationStatus: 'PUBLIC',
        visibility: 'PUBLIC'
      }
    })
  ])

  // Map media to array of media objects in order
  const postsWithOrderedMedia = posts.map(post => ({
    ...post,
    media: post.media.map(pm => pm.media)
  }))

  res.json({
    success: true,
    data: {
      posts: postsWithOrderedMedia,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
        hasNext: offset + Number(limit) < total,
        hasPrev: Number(page) > 1
      }
    }
  })
}))

// Get user's personalized feed
router.get('/feed', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { page = 1, limit = 20 } = req.query
  const offset = (Number(page) - 1) * Number(limit)

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  // Get posts from followed users, friends, public posts, and user's own posts (including paused ones)
  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where: {
        OR: [
          {
            author: {
              followers: {
                some: {
                  followerId: userId
                }
              }
            },
            publicationStatus: 'PUBLIC',
            visibility: {
              in: ['PUBLIC', 'FRIENDS_ONLY'] // Followers can see public and friends-only posts
            }
          },
          {
            author: {
              OR: [
                {
                  friendRequestsSent: {
                    some: {
                      receiverId: userId,
                      status: 'ACCEPTED'
                    }
                  }
                },
                {
                  friendRequestsReceived: {
                    some: {
                      senderId: userId,
                      status: 'ACCEPTED'
                    }
                  }
                }
              ]
            },
            publicationStatus: 'PUBLIC',
            visibility: {
              in: ['PUBLIC', 'FRIENDS_ONLY'] // Friends can see public and friends-only posts
            }
          },
          {
            visibility: 'PUBLIC', // Only public posts that are not private
            publicationStatus: 'PUBLIC'
          },
          {
            authorId: userId, // Include user's own posts (including paused ones)
            publicationStatus: {
              in: ['PUBLIC', 'PAUSED'] // Show public and paused posts to the author
            }
            // User can see all their own posts regardless of visibility
          }
        ]
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true
          }
        },
        reactions: {
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
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        _count: {
          select: {
            comments: true,
            reactions: true
          }
        },
        media: {
          include: { 
            media: {
              select: {
                id: true,
                s3Key: true,
                thumbnailS3Key: true,
                originalFilename: true,
                altText: true,
                caption: true,
                tags: true,
                visibility: true,
                createdAt: true,
                updatedAt: true,
                width: true,
                height: true,
                size: true,
                mimeType: true,
                authorId: true,
                mediaType: true,
                processingStatus: true,
                duration: true,
                codec: true,
                bitrate: true,
                framerate: true,
                videoUrl: true,
                videoS3Key: true
              }
            }
          },
          orderBy: { order: 'asc' }
        }
      },
      skip: offset,
      take: Number(limit),
      orderBy: { createdAt: 'desc' }
    }),
    prisma.post.count({
      where: {
        OR: [
          {
            author: {
              followers: {
                some: {
                  followerId: userId
                }
              }
            },
            publicationStatus: 'PUBLIC',
            visibility: {
              in: ['PUBLIC', 'FRIENDS_ONLY'] // Followers can see public and friends-only posts
            }
          },
          {
            author: {
              OR: [
                {
                  friendRequestsSent: {
                    some: {
                      receiverId: userId,
                      status: 'ACCEPTED'
                    }
                  }
                },
                {
                  friendRequestsReceived: {
                    some: {
                      senderId: userId,
                      status: 'ACCEPTED'
                    }
                  }
                }
              ]
            },
            publicationStatus: 'PUBLIC',
            visibility: {
              in: ['PUBLIC', 'FRIENDS_ONLY'] // Friends can see public and friends-only posts
            }
          },
          {
            visibility: 'PUBLIC', // Only public posts that are not private
            publicationStatus: 'PUBLIC'
          },
          {
            authorId: userId, // Include user's own posts (including paused ones)
            publicationStatus: {
              in: ['PUBLIC', 'PAUSED'] // Show public and paused posts to the author
            }
            // User can see all their own posts regardless of visibility
          }
        ]
      }
    })
  ])

  // Map media to array of media objects in order
  const postsWithOrderedMedia = posts.map(post => ({
    ...post,
    media: post.media.map(pm => pm.media)
  }))

  res.json({
    success: true,
    data: {
      posts: postsWithOrderedMedia,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
        hasNext: offset + Number(limit) < total,
        hasPrev: Number(page) > 1
      }
    }
  })
}))

// Create a new post
router.post('/', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { title, content, visibility, hashtags, mentions, mediaIds } = req.body

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  // Validate that all media belong to the user
  if (mediaIds && mediaIds.length > 0) {
    const userMedia = await prisma.media.findMany({
      where: {
        id: { in: mediaIds },
        authorId: userId
      },
      select: { id: true }
    })

    if (userMedia.length !== mediaIds.length) {
      res.status(400).json({
        success: false,
        error: 'Some media do not belong to you or do not exist'
      })
      return
    }
  }

  // Use transaction to ensure atomicity and proper connection management
  const postWithMedia = await prisma.$transaction(async (tx) => {
    // Create the post
    const post = await tx.post.create({
      data: {
        title,
        content,
        visibility: visibility || 'PUBLIC',
        authorId: userId,
        hashtags: {
          connectOrCreate: hashtags?.map((tag: string) => ({
            where: { name: tag.toLowerCase() },
            create: { name: tag.toLowerCase() }
          })) || []
        }
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true
          }
        },
        hashtags: true
      }
    })

    // Create PostMedia records with order if media are provided
    if (mediaIds && mediaIds.length > 0) {
      await tx.postMedia.createMany({
        data: mediaIds.map((mediaId: string, index: number) => ({
          postId: post.id,
          mediaId,
          order: index
        }))
      })
    }

    // Fetch the complete post with ordered media
    return await tx.post.findUnique({
      where: { id: post.id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true
          }
        },
        hashtags: true,
        media: {
          include: { media: true },
          orderBy: { order: 'asc' }
        }
      }
    })
  }, {
    maxWait: 5000, // 5 seconds max wait for transaction
    timeout: 10000, // 10 seconds timeout
  })

  // Map media to array of media objects in order
  const postWithOrderedMedia = {
    ...postWithMedia,
    media: postWithMedia?.media.map(pm => pm.media) || []
  }

  res.status(201).json({
    success: true,
    data: { post: postWithOrderedMedia },
    message: 'Post created successfully'
  })
}))

// Get a single post by ID
router.get('/:id', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const userId = req.user?.id

  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true
        }
      },
      comments: {
        include: {
          author: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      },
      reactions: true,
      media: {
        include: { 
          media: {
            select: {
              id: true,
              s3Key: true,
              thumbnailS3Key: true,
              originalFilename: true,
              altText: true,
              caption: true,
              tags: true,
              visibility: true,
              createdAt: true,
              updatedAt: true,
              width: true,
              height: true,
              size: true,
              mimeType: true,
              authorId: true,
              mediaType: true,
              processingStatus: true,
              duration: true,
              codec: true,
              bitrate: true,
              framerate: true,
              videoUrl: true,
              videoS3Key: true
            }
          }
        },
        orderBy: { order: 'asc' }
      },
      hashtags: true
    }
  })

  if (!post) {
    res.status(404).json({
      success: false,
      error: 'Post not found'
    })
    return
  }

  // Check if user can view the post based on publication status and privacy
  if (post.publicationStatus === 'DELETED') {
    res.status(404).json({
      success: false,
      error: 'Post not found'
    })
    return
  }

  if (post.publicationStatus === 'PAUSED' && post.authorId !== userId) {
    res.status(404).json({
      success: false,
      error: 'Post not found'
    })
    return
  }

  if (post.visibility !== 'PUBLIC' && post.authorId !== userId) {
    res.status(403).json({
      success: false,
      error: 'Access denied'
    })
    return
  }

  // Map media to array of media objects in order
  const postWithOrderedMedia = {
    ...post,
    media: post.media.map(pm => pm.media)
  }

  res.json({
    success: true,
    data: { post: postWithOrderedMedia }
  })
}))

// Update a post
router.put('/:id', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { id } = req.params
  const { title, content, visibility, hashtags, mediaIds } = req.body

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  const post = await prisma.post.findUnique({
    where: { id }
  })

  if (!post) {
    res.status(404).json({
      success: false,
      error: 'Post not found'
    })
    return
  }

  if (post.authorId !== userId) {
    res.status(403).json({
      success: false,
      error: 'Not authorized to update this post'
    })
    return
  }

  // Validate that all media belong to the user
  if (mediaIds && mediaIds.length > 0) {
    const userMedia = await prisma.media.findMany({
      where: {
        id: { in: mediaIds },
        authorId: userId
      },
      select: { id: true }
    })

    if (userMedia.length !== mediaIds.length) {
      res.status(400).json({
        success: false,
        error: 'Some media do not belong to you or do not exist'
      })
      return
    }
  }

  const updatedPost = await prisma.post.update({
    where: { id },
    data: {
      title,
      content,
      visibility,
      hashtags: {
        set: [],
        connectOrCreate: hashtags?.map((tag: string) => ({
          where: { name: tag.toLowerCase() },
          create: { name: tag.toLowerCase() }
        })) || []
      }
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true
        }
      },
      hashtags: true
    }
  })

  // Update PostMedia records with new order
  if (mediaIds) {
    // Delete existing PostMedia records
    await prisma.postMedia.deleteMany({
      where: { postId: id }
    })

    // Create new PostMedia records with order
    if (mediaIds.length > 0) {
      await prisma.postMedia.createMany({
        data: mediaIds.map((mediaId: string, index: number) => ({
          postId: id,
          mediaId,
          order: index
        }))
      })
    }
  }

  // Fetch the post with ordered media
  const postWithMedia = await prisma.post.findUnique({
    where: { id },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true
        }
      },
      hashtags: true,
      media: {
        include: { media: true },
        orderBy: { order: 'asc' }
      }
    }
  })

  // Map media to array of media objects in order
  const postWithOrderedMedia = {
    ...postWithMedia,
    media: postWithMedia?.media.map(pm => pm.media) || []
  }

  res.json({
    success: true,
    data: { post: postWithOrderedMedia },
    message: 'Post updated successfully'
  })
}))

// Delete a post
router.delete('/:id', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { id } = req.params

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  const post = await prisma.post.findUnique({
    where: { id }
  })

  if (!post) {
    res.status(404).json({
      success: false,
      error: 'Post not found'
    })
    return
  }

  if (post.authorId !== userId) {
    res.status(403).json({
      success: false,
      error: 'Not authorized to delete this post'
    })
    return
  }

  await prisma.post.delete({
    where: { id }
  })

  res.json({
    success: true,
    message: 'Post deleted successfully'
  })
}))

// Get reactions for a post
router.get('/:postId/reactions', asyncHandler(async (req: Request, res: Response) => {
  const { postId } = req.params

  const reactions = await prisma.reaction.findMany({
    where: { postId },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  res.json({
    success: true,
    data: { reactions }
  })
}))

// Add a reaction to a post
router.post('/:postId/reactions', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { postId } = req.params
  const { type = 'LIKE' } = req.body

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  // Check if post exists
  const post = await prisma.post.findUnique({
    where: { id: postId }
  })

  if (!post) {
    res.status(404).json({
      success: false,
      error: 'Post not found'
    })
    return
  }

  // Check if user already reacted to this post
  const existingReaction = await prisma.reaction.findFirst({
    where: {
      postId,
      authorId: userId
    }
  })

  if (existingReaction) {
    // Update existing reaction
    const updatedReaction = await prisma.reaction.update({
      where: { id: existingReaction.id },
      data: { type },
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
    })

    res.json({
      success: true,
      data: { reaction: updatedReaction },
      message: 'Reaction updated successfully'
    })
    return
  }

  // Create new reaction
  const reaction = await prisma.reaction.create({
    data: {
      type,
      postId,
      authorId: userId
    },
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
  })

  res.status(201).json({
    success: true,
    data: { reaction },
    message: 'Reaction added successfully'
  })
}))

// Remove a reaction from a post
router.delete('/:postId/reactions', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { postId } = req.params

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  // Find and delete the user's reaction to this post
  const reaction = await prisma.reaction.findFirst({
    where: {
      postId,
      authorId: userId
    }
  })

  if (!reaction) {
    res.status(404).json({
      success: false,
      error: 'Reaction not found'
    })
    return
  }

  await prisma.reaction.delete({
    where: { id: reaction.id }
  })

  res.json({
    success: true,
    message: 'Reaction removed successfully'
  })
}))

// Reorder media in a post
router.put('/:id/media/reorder', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { id } = req.params
  const { mediaIds } = req.body

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      media: {
        include: { media: true },
        orderBy: { order: 'asc' }
      }
    }
  })

  if (!post) {
    res.status(404).json({
      success: false,
      error: 'Post not found'
    })
    return
  }

  if (post.authorId !== userId) {
    res.status(403).json({
      success: false,
      error: 'Not authorized to reorder media in this post'
    })
    return
  }

  // Validate that all provided media IDs belong to this post
  const postMediaIds = post.media.map(pm => pm.media.id)
  const isValidOrder = mediaIds.every((mediaId: string) => postMediaIds.includes(mediaId))
  const hasAllMedia = postMediaIds.every(mediaId => mediaIds.includes(mediaId))

  if (!isValidOrder || !hasAllMedia) {
    res.status(400).json({
      success: false,
      error: 'Invalid media order provided'
    })
    return
  }

  // Update the order of PostMedia records
  for (let i = 0; i < mediaIds.length; i++) {
    await prisma.postMedia.updateMany({
      where: {
        postId: id,
        mediaId: mediaIds[i]
      },
      data: {
        order: i
      }
    })
  }

  res.json({
    success: true,
    message: 'Media order updated successfully'
  })
}))
  

// Update post publication status
router.patch('/:id/status', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { id } = req.params
  const { publicationStatus } = req.body

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  // Validate publication status
  const validStatuses = ['PUBLIC', 'PAUSED', 'CONTROLLED', 'DELETED']
  if (!validStatuses.includes(publicationStatus)) {
    res.status(400).json({
      success: false,
      error: 'Invalid publication status'
    })
    return
  }

  const post = await prisma.post.findUnique({
    where: { id }
  })

  if (!post) {
    res.status(404).json({
      success: false,
      error: 'Post not found'
    })
    return
  }

  if (post.authorId !== userId) {
    res.status(403).json({
      success: false,
      error: 'Not authorized to update this post'
    })
    return
  }

  const updatedPost = await prisma.post.update({
    where: { id },
    data: { publicationStatus },
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
        include: { media: true },
        orderBy: { order: 'asc' }
      }
    }
  })

  // Map media to array of media objects in order
  const postWithOrderedMedia = {
    ...updatedPost,
    media: updatedPost.media.map(pm => pm.media)
  }

  res.json({
    success: true,
    data: { post: postWithOrderedMedia },
    message: 'Post status updated successfully'
  })
}))



// Update post visibility
router.patch('/:id/visibility', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { id } = req.params
  const { visibility } = req.body

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  // Validate visibility
  const validVisibilities = ['PUBLIC', 'FRIENDS_ONLY', 'PRIVATE']
  if (!validVisibilities.includes(visibility)) {
    res.status(400).json({
      success: false,
      error: 'Invalid visibility setting'
    })
    return
  }

  const post = await prisma.post.findUnique({
    where: { id }
  })

  if (!post) {
    res.status(404).json({
      success: false,
      error: 'Post not found'
    })
    return
  }

  if (post.authorId !== userId) {
    res.status(403).json({
      success: false,
      error: 'Not authorized to update this post'
    })
    return
  }

  const updatedPost = await prisma.post.update({
    where: { id },
    data: { visibility },
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
        include: { media: true },
        orderBy: { order: 'asc' }
      }
    }
  })

  // Map media to array of media objects in order
  const postWithOrderedMedia = {
    ...updatedPost,
    media: updatedPost.media.map(pm => pm.media)
  }

  res.json({
    success: true,
    data: { post: postWithOrderedMedia },
    message: 'Post visibility updated successfully'
  })
}))

// Get posts for a user's public page, filtered by visibility
router.get('/user/:userId/public', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params
  const viewerId = req.user?.id
  const { page = 1, limit = 20 } = req.query
  const offset = (Number(page) - 1) * Number(limit)

  console.log('Public posts request:', { userId, viewerId, page, limit })

  // Determine which posts the viewer can see
  let visibilityFilter: any[] = [
    { visibility: 'PUBLIC' }
  ]

  if (viewerId) {
    if (viewerId === userId) {
      visibilityFilter = [] // No filter, show all
    } else {
      const isFriend = await prisma.friendRequest.findFirst({
        where: {
          OR: [
            { senderId: viewerId, receiverId: userId, status: 'ACCEPTED' },
            { senderId: userId, receiverId: viewerId, status: 'ACCEPTED' }
          ]
        }
      })
      if (isFriend) {
        visibilityFilter.push({ visibility: 'FRIENDS_ONLY' })
      }
    }
  }

  // First, find the user by username or ID
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { id: userId },
        { username: userId }
      ]
    },
    select: { id: true, username: true }
  })

  if (!user) {
    res.status(404).json({
      success: false,
      error: 'User not found'
    })
    return
  }

  console.log('Found user:', user)

  const where: any = {
    authorId: user.id,
    publicationStatus: 'PUBLIC',
    ...(visibilityFilter.length > 0 ? { OR: visibilityFilter } : {})
  }

  console.log('Query where clause:', where)

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true
          }
        },
        reactions: {
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
        },
        _count: {
          select: {
            comments: true,
            reactions: true
          }
        },
        media: {
          include: { media: true },
          orderBy: { order: 'asc' }
        }
      },
      skip: offset,
      take: Number(limit),
      orderBy: { createdAt: 'desc' }
    }),
    prisma.post.count({ where })
  ])

  console.log('Found posts:', posts.length, 'Total:', total)

  const postsWithOrderedMedia = posts.map(post => ({
    ...post,
    media: (post.media || []).map((pm: any) => pm.media)
  }))

  res.json({
    success: true,
    data: {
      posts: postsWithOrderedMedia,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
        hasNext: offset + Number(limit) < total,
        hasPrev: Number(page) > 1
      }
    }
  })
}))

// Get public posts feed
router.get('/public', asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 20 } = req.query
  const offset = (Number(page) - 1) * Number(limit)

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where: {
        publicationStatus: 'PUBLIC',
        visibility: 'PUBLIC'
      },
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
        hashtags: true,
        _count: {
          select: {
            comments: true,
            reactions: true
          }
        }
      },
      skip: offset,
      take: Number(limit),
      orderBy: { createdAt: 'desc' }
    }),
    prisma.post.count({
      where: {
        publicationStatus: 'PUBLIC',
        visibility: 'PUBLIC'
      }
    })
  ])

  const formattedPosts = posts.map(post => ({
    ...post,
    media: post.media.map(pi => pi.media)
  }))

  res.json({
    success: true,
    data: {
      posts: formattedPosts,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
        hasNext: offset + Number(limit) < total,
        hasPrev: Number(page) > 1
      }
    }
  })
}))

export default router 