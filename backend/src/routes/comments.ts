import { Router, Request, Response } from 'express'
import { prisma } from '@/db'
import { asyncHandler } from '@/middleware/errorHandler'
import { authMiddleware, optionalAuthMiddleware } from '@/middleware/auth'
import { AuthenticatedRequest } from '@/types'
import { getAuthContext } from '@/middleware/authContext'
import {
  canViewCommentsOnPost,
  canViewCommentsOnMedia,
  canCommentOnPost,
  canCommentOnMedia,
  canUpdateComment,
  canDeleteComment
} from '@/auth/comments'
import { safePermissionCheck, auditPermission } from '@/lib/permissions'

const router = Router()

// Get comments for a post
router.get('/post/:postId', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const auth = getAuthContext(req)
  const { postId } = req.params
  const { page = 1, limit = 20, context, groupId } = req.query
  const offset = (Number(page) - 1) * Number(limit)

  // Validate context (default to FEED for backward compatibility)
  const commentContext = (context as string) || 'FEED'
  const validContexts = ['FEED', 'GROUP', 'USER_PAGE']
  
  if (!validContexts.includes(commentContext)) {
    res.status(400).json({
      success: false,
      error: 'Invalid context. Must be one of: FEED, GROUP, USER_PAGE'
    })
    return
  }

  // Check if user can view this post (and thus its comments)
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { author: true }
  })

  if (!post) {
    res.status(404).json({
      success: false,
      error: 'Post not found'
    })
    return
  }

  const canView = await safePermissionCheck(
    () => canViewCommentsOnPost(auth, post as any),
    'comment-view-post'
  )

  if (!canView.granted) {
    res.status(403).json({
      success: false,
      error: canView.reason
    })
    return
  }

  // Build where clause with context filtering
  const whereClause: any = {
    postId,
    parentId: null, // Only top-level comments
    context: commentContext
  }

  // Add groupId filter if context is GROUP
  if (commentContext === 'GROUP') {
    if (!groupId) {
      res.status(400).json({
        success: false,
        error: 'groupId is required when context is GROUP'
      })
      return
    }
    whereClause.groupId = groupId as string
  }

  const [comments, total] = await Promise.all([
    prisma.comment.findMany({
      where: whereClause,
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
      where: whereClause
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
router.get('/media/:mediaId', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const auth = getAuthContext(req)
  const { mediaId } = req.params
  const { page = 1, limit = 20 } = req.query
  const offset = (Number(page) - 1) * Number(limit)

  // Check if user can view this media (and thus its comments)
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    include: { author: true }
  })

  if (!media) {
    res.status(404).json({
      success: false,
      error: 'Media not found'
    })
    return
  }

  const canView = await safePermissionCheck(
    () => canViewCommentsOnMedia(auth, media as any),
    'comment-view-media'
  )

  if (!canView.granted) {
    res.status(403).json({
      success: false,
      error: canView.reason
    })
    return
  }

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
  const auth = getAuthContext(req)
  const userId = req.user?.id
  const { content, postId, mediaId, parentId, context, groupId } = req.body

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

  // Validate context (default to FEED for backward compatibility)
  const commentContext = context || 'FEED'
  const validContexts = ['FEED', 'GROUP', 'USER_PAGE']
  
  if (!validContexts.includes(commentContext)) {
    res.status(400).json({
      success: false,
      error: 'Invalid context. Must be one of: FEED, GROUP, USER_PAGE'
    })
    return
  }

  // If context is GROUP, groupId is required
  if (commentContext === 'GROUP' && !groupId) {
    res.status(400).json({
      success: false,
      error: 'groupId is required when context is GROUP'
    })
    return
  }

  // Validate group exists and post is in that group
  if (commentContext === 'GROUP' && groupId) {
    const group = await prisma.group.findUnique({
      where: { id: groupId }
    })

    if (!group) {
      res.status(404).json({
        success: false,
        error: 'Group not found'
      })
      return
    }

    // Verify post exists in this group
    if (postId) {
      const groupPost = await prisma.groupPost.findUnique({
        where: { groupId_postId: { groupId, postId } }
      })

      if (!groupPost) {
        res.status(400).json({
          success: false,
          error: 'Post does not exist in this group'
        })
        return
      }
    }
  }

  // Check permission to comment on post or media
  if (postId) {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: { author: true }
    })

    if (!post) {
      res.status(404).json({
        success: false,
        error: 'Post not found'
      })
      return
    }

    const canComment = await safePermissionCheck(
      () => canCommentOnPost(auth, post as any),
      'comment-create-post'
    )

    if (!canComment.granted) {
      res.status(403).json({
        success: false,
        error: canComment.reason
      })
      return
    }
  }

  if (mediaId) {
    const media = await prisma.media.findUnique({
      where: { id: mediaId },
      include: { author: true }
    })

    if (!media) {
      res.status(404).json({
        success: false,
        error: 'Media not found'
      })
      return
    }

    const canComment = await safePermissionCheck(
      () => canCommentOnMedia(auth, media as any),
      'comment-create-media'
    )

    if (!canComment.granted) {
      res.status(403).json({
        success: false,
        error: canComment.reason
      })
      return
    }
  }

  // If this is a reply, inherit parent comment's context and groupId
  let finalContext = commentContext
  let finalGroupId = groupId

  if (parentId) {
    const parentComment = await prisma.comment.findUnique({
      where: { id: parentId },
      select: { context: true, groupId: true }
    })

    if (parentComment) {
      finalContext = parentComment.context
      finalGroupId = parentComment.groupId
    }
  }

  const comment = await prisma.comment.create({
    data: {
      content,
      postId,
      mediaId,
      parentId,
      authorId: userId,
      context: finalContext,
      groupId: finalGroupId
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
  const auth = getAuthContext(req)
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

  // Check permission to update
  const canUpdate = await safePermissionCheck(
    () => canUpdateComment(auth, comment as any),
    'comment-update'
  )

  if (!canUpdate.granted) {
    res.status(403).json({
      success: false,
      error: canUpdate.reason
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
  const auth = getAuthContext(req)
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
    where: { id },
    include: {
      post: {
        select: { authorId: true }
      },
      media: {
        select: { authorId: true }
      }
    }
  })

  if (!comment) {
    res.status(404).json({
      success: false,
      error: 'Comment not found'
    })
    return
  }

  // Determine parent author ID (post or media author)
  const parentAuthorId = comment.post?.authorId || comment.media?.authorId

  // Check permission to delete
  const canDelete = await safePermissionCheck(
    () => canDeleteComment(auth, comment as any, parentAuthorId),
    'comment-delete'
  )

  await auditPermission(canDelete, auth, 'COMMENT', {
    shouldAudit: true,
    auditSensitive: false,
    asyncAudit: true
  })

  if (!canDelete.granted) {
    res.status(403).json({
      success: false,
      error: canDelete.reason
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