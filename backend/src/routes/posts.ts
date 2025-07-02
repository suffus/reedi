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
        isPublished: true,
        isPrivate: false
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
        isPublished: true,
        isPrivate: false
      }
    })
  ])

  res.json({
    success: true,
    data: {
      posts,
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
    return res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
  }

  // Get posts from followed users, public posts, and user's own posts
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
            }
          },
          {
            isPrivate: false
          },
          {
            authorId: userId // Include user's own posts
          }
        ],
        isPublished: true
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
        OR: [
          {
            author: {
              followers: {
                some: {
                  followerId: userId
                }
              }
            }
          },
          {
            isPrivate: false
          },
          {
            authorId: userId // Include user's own posts
          }
        ],
        isPublished: true
      }
    })
  ])

  res.json({
    success: true,
    data: {
      posts,
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
  const { title, content, isPrivate, hashtags, mentions } = req.body

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
  }

  const post = await prisma.post.create({
    data: {
      title,
      content,
      isPrivate: isPrivate || false,
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

  res.status(201).json({
    success: true,
    data: { post },
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
          avatar: true,
          isPrivate: true
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
      images: true,
      hashtags: true
    }
  })

  if (!post) {
    return res.status(404).json({
      success: false,
      error: 'Post not found'
    })
  }

  // Check if user can view private post
  if (post.isPrivate && post.authorId !== userId) {
    return res.status(403).json({
      success: false,
      error: 'Access denied'
    })
  }

  res.json({
    success: true,
    data: { post }
  })
}))

// Update a post
router.put('/:id', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { id } = req.params
  const { title, content, isPrivate, hashtags } = req.body

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
  }

  const post = await prisma.post.findUnique({
    where: { id }
  })

  if (!post) {
    return res.status(404).json({
      success: false,
      error: 'Post not found'
    })
  }

  if (post.authorId !== userId) {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to update this post'
    })
  }

  const updatedPost = await prisma.post.update({
    where: { id },
    data: {
      title,
      content,
      isPrivate,
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

  res.json({
    success: true,
    data: { post: updatedPost },
    message: 'Post updated successfully'
  })
}))

// Delete a post
router.delete('/:id', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { id } = req.params

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
  }

  const post = await prisma.post.findUnique({
    where: { id }
  })

  if (!post) {
    return res.status(404).json({
      success: false,
      error: 'Post not found'
    })
  }

  if (post.authorId !== userId) {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to delete this post'
    })
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
    return res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
  }

  // Check if post exists
  const post = await prisma.post.findUnique({
    where: { id: postId }
  })

  if (!post) {
    return res.status(404).json({
      success: false,
      error: 'Post not found'
    })
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

    return res.json({
      success: true,
      data: { reaction: updatedReaction },
      message: 'Reaction updated successfully'
    })
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
    return res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
  }

  // Find and delete the user's reaction to this post
  const reaction = await prisma.reaction.findFirst({
    where: {
      postId,
      authorId: userId
    }
  })

  if (!reaction) {
    return res.status(404).json({
      success: false,
      error: 'Reaction not found'
    })
  }

  await prisma.reaction.delete({
    where: { id: reaction.id }
  })

  res.json({
    success: true,
    message: 'Reaction removed successfully'
  })
}))

export default router 