import { Router, Request, Response } from 'express'
import { prisma } from '@/index'
import { asyncHandler } from '@/middleware/errorHandler'
import { authMiddleware } from '@/middleware/auth'
import { AuthenticatedRequest } from '@/types'

const router = Router()

// Get comments for a post
router.get('/post/:postId', asyncHandler(async (req: Request, res: Response) => {
  const { postId } = req.params
  const { page = 1, limit = 20 } = req.query
  const offset = (Number(page) - 1) * Number(limit)

  const [comments, total] = await Promise.all([
    prisma.comment.findMany({
      where: { 
        postId,
        parentId: null // Only top-level comments
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
        replies: {
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
            replies: true,
            reactions: true
          }
        }
      },
      skip: offset,
      take: Number(limit),
      orderBy: { createdAt: 'desc' }
    }),
    prisma.comment.count({
      where: { 
        postId,
        parentId: null
      }
    })
  ])

  res.json({
    success: true,
    data: {
      comments,
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

// Get comments for media
router.get('/media/:mediaId', asyncHandler(async (req: Request, res: Response) => {
  const { mediaId } = req.params
  const { page = 1, limit = 20 } = req.query
  const offset = (Number(page) - 1) * Number(limit)

  const [comments, total] = await Promise.all([
    prisma.comment.findMany({
      where: { 
        mediaId,
        parentId: null // Only top-level comments
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
        replies: {
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
            replies: true,
            reactions: true
          }
        }
      },
      skip: offset,
      take: Number(limit),
      orderBy: { createdAt: 'desc' }
    }),
    prisma.comment.count({
      where: { 
        mediaId,
        parentId: null
      }
    })
  ])

  res.json({
    success: true,
    data: {
      comments,
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

// Create a comment
router.post('/', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { content, postId, mediaId, parentId } = req.body

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  // Validate that either postId or mediaId is provided, but not both
  if (!postId && !mediaId) {
    res.status(400).json({
      success: false,
      error: 'Either postId or mediaId is required'
    })
    return
  }

  if (postId && mediaId) {
    res.status(400).json({
      success: false,
      error: 'Cannot comment on both post and media simultaneously'
    })
    return
  }

  // Check if user can comment on the post/image
  if (postId) {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: true
      }
    })

    if (!post) {
      res.status(404).json({
        success: false,
        error: 'Post not found'
      })
      return
    }

    // Allow commenting if:
    // 1. User is the post author
    // 2. User is a friend of the post author
    // 3. Post is public and not private
    const isAuthor = post.authorId === userId
    const isFriend = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: userId, receiverId: post.authorId, status: 'ACCEPTED' },
          { senderId: post.authorId, receiverId: userId, status: 'ACCEPTED' }
        ]
      }
    })
    const isPublicPost = post.visibility === 'PUBLIC'

    if (!isAuthor && !isFriend && !isPublicPost) {
      res.status(403).json({
        success: false,
        error: 'You can only comment on your own posts, friends\' posts, or public posts'
      })
      return
    }
  }

  if (mediaId) {
    const media = await prisma.media.findUnique({
      where: { id: mediaId },
      include: {
        author: true
      }
    })

    if (!media) {
      res.status(404).json({
        success: false,
        error: 'Media not found'
      })
      return
    }

    // Allow commenting if:
    // 1. User is the media author
    // 2. User is a friend of the media author
    // 3. Media is public (no privacy check for media currently)
    const isAuthor = media.authorId === userId
    const isFriend = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: userId, receiverId: media.authorId, status: 'ACCEPTED' },
          { senderId: media.authorId, receiverId: userId, status: 'ACCEPTED' }
        ]
      }
    })

    if (!isAuthor && !isFriend) {
      res.status(403).json({
        success: false,
        error: 'You can only comment on your own media or friends\' media'
      })
      return
    }
  }

  const comment = await prisma.comment.create({
    data: {
      content,
      postId,
              mediaId,
      parentId,
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
    data: { comment },
    message: 'Comment created successfully'
  })
}))

// Update a comment
router.put('/:id', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { id } = req.params
  const { content } = req.body

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  const comment = await prisma.comment.findUnique({
    where: { id }
  })

  if (!comment) {
    res.status(404).json({
      success: false,
      error: 'Comment not found'
    })
    return
  }

  if (comment.authorId !== userId) {
    res.status(403).json({
      success: false,
      error: 'Not authorized to update this comment'
    })
    return
  }

  const updatedComment = await prisma.comment.update({
    where: { id },
    data: { content },
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
    data: { comment: updatedComment },
    message: 'Comment updated successfully'
  })
}))

// Delete a comment
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

  const comment = await prisma.comment.findUnique({
    where: { id }
  })

  if (!comment) {
    res.status(404).json({
      success: false,
      error: 'Comment not found'
    })
    return
  }

  if (comment.authorId !== userId) {
    res.status(403).json({
      success: false,
      error: 'Not authorized to delete this comment'
    })
    return
  }

  await prisma.comment.delete({
    where: { id }
  })

  res.json({
    success: true,
    message: 'Comment deleted successfully'
  })
}))

export default router 