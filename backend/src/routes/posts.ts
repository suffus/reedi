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
        },
        images: {
          include: { image: true },
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
        isPrivate: false
      }
    })
  ])

  // Map images to array of image objects in order
  const postsWithOrderedImages = posts.map(post => ({
    ...post,
    images: post.images.map(pi => pi.image)
  }))

  res.json({
    success: true,
    data: {
      posts: postsWithOrderedImages,
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

  // Get posts from followed users, public posts, and user's own posts (including paused ones)
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
            publicationStatus: 'PUBLIC' // Only public posts from followed users
          },
          {
            isPrivate: false,
            publicationStatus: 'PUBLIC' // Only public posts that are not private
          },
          {
            authorId: userId, // Include user's own posts (including paused ones)
            publicationStatus: {
              in: ['PUBLIC', 'PAUSED'] // Show public and paused posts to the author
            }
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
        _count: {
          select: {
            comments: true,
            reactions: true
          }
        },
        images: {
          include: { image: true },
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
            publicationStatus: 'PUBLIC' // Only public posts from followed users
          },
          {
            isPrivate: false,
            publicationStatus: 'PUBLIC' // Only public posts that are not private
          },
          {
            authorId: userId, // Include user's own posts (including paused ones)
            publicationStatus: {
              in: ['PUBLIC', 'PAUSED'] // Show public and paused posts to the author
            }
          }
        ]
      }
    })
  ])

  // Map images to array of image objects in order
  const postsWithOrderedImages = posts.map(post => ({
    ...post,
    images: post.images.map(pi => pi.image)
  }))

  res.json({
    success: true,
    data: {
      posts: postsWithOrderedImages,
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
  const { title, content, isPrivate, hashtags, mentions, imageIds } = req.body

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  // Validate that all images belong to the user
  if (imageIds && imageIds.length > 0) {
    const userImages = await prisma.image.findMany({
      where: {
        id: { in: imageIds },
        authorId: userId
      },
      select: { id: true }
    })

    if (userImages.length !== imageIds.length) {
      res.status(400).json({
        success: false,
        error: 'Some images do not belong to you or do not exist'
      })
      return
    }
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

  // Create PostImage records with order if images are provided
  if (imageIds && imageIds.length > 0) {
    await prisma.postImage.createMany({
      data: imageIds.map((imageId: string, index: number) => ({
        postId: post.id,
        imageId,
        order: index
      }))
    })
  }

  // Fetch the post with ordered images
  const postWithImages = await prisma.post.findUnique({
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
      images: {
        include: { image: true },
        orderBy: { order: 'asc' }
      }
    }
  })

  // Map images to array of image objects in order
  const postWithOrderedImages = {
    ...postWithImages,
    images: postWithImages?.images.map(pi => pi.image) || []
  }

  res.status(201).json({
    success: true,
    data: { post: postWithOrderedImages },
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
      images: {
        include: { image: true },
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

  if (post.isPrivate && post.authorId !== userId) {
    res.status(403).json({
      success: false,
      error: 'Access denied'
    })
    return
  }

  // Map images to array of image objects in order
  const postWithOrderedImages = {
    ...post,
    images: post.images.map(pi => pi.image)
  }

  res.json({
    success: true,
    data: { post: postWithOrderedImages }
  })
}))

// Update a post
router.put('/:id', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { id } = req.params
  const { title, content, isPrivate, hashtags, imageIds } = req.body

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

  // Validate that all images belong to the user
  if (imageIds && imageIds.length > 0) {
    const userImages = await prisma.image.findMany({
      where: {
        id: { in: imageIds },
        authorId: userId
      },
      select: { id: true }
    })

    if (userImages.length !== imageIds.length) {
      res.status(400).json({
        success: false,
        error: 'Some images do not belong to you or do not exist'
      })
      return
    }
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

  // Update PostImage records with new order
  if (imageIds) {
    // Delete existing PostImage records
    await prisma.postImage.deleteMany({
      where: { postId: id }
    })

    // Create new PostImage records with order
    if (imageIds.length > 0) {
      await prisma.postImage.createMany({
        data: imageIds.map((imageId: string, index: number) => ({
          postId: id,
          imageId,
          order: index
        }))
      })
    }
  }

  // Fetch the post with ordered images
  const postWithImages = await prisma.post.findUnique({
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
      images: {
        include: { image: true },
        orderBy: { order: 'asc' }
      }
    }
  })

  // Map images to array of image objects in order
  const postWithOrderedImages = {
    ...postWithImages,
    images: postWithImages?.images.map(pi => pi.image) || []
  }

  res.json({
    success: true,
    data: { post: postWithOrderedImages },
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

// Reorder images in a post
router.put('/:id/images/reorder', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { id } = req.params
  const { imageIds } = req.body

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
      images: {
        include: { image: true },
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
      error: 'Not authorized to reorder images in this post'
    })
    return
  }

  // Validate that all provided image IDs belong to this post
  const postImageIds = post.images.map(pi => pi.image.id)
  const isValidOrder = imageIds.every((imageId: string) => postImageIds.includes(imageId))
  const hasAllImages = postImageIds.every(imageId => imageIds.includes(imageId))

  if (!isValidOrder || !hasAllImages) {
    res.status(400).json({
      success: false,
      error: 'Invalid image order provided'
    })
    return
  }

  // Update the order of PostImage records
  for (let i = 0; i < imageIds.length; i++) {
    await prisma.postImage.updateMany({
      where: {
        postId: id,
        imageId: imageIds[i]
      },
      data: {
        order: i
      }
    })
  }

  res.json({
    success: true,
    message: 'Image order updated successfully'
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
      images: {
        include: { image: true },
        orderBy: { order: 'asc' }
      }
    }
  })

  // Map images to array of image objects in order
  const postWithOrderedImages = {
    ...updatedPost,
    images: updatedPost.images.map(pi => pi.image)
  }

  res.json({
    success: true,
    data: { post: postWithOrderedImages },
    message: 'Post status updated successfully'
  })
}))

export default router 