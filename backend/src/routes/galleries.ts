import { Router, Request, Response } from 'express'
import { prisma } from '@/index'
import { asyncHandler } from '@/middleware/errorHandler'
import { authMiddleware, optionalAuthMiddleware } from '@/middleware/auth'
import { AuthenticatedRequest } from '@/types'


const router = Router()

// Shared function to get galleries with image/video counts
async function getGalleriesWithCounts(userId: string, page: number, limit: number, whereClause: any) {
  const offset = (page - 1) * limit

  const [galleries, total] = await Promise.all([
    prisma.gallery.findMany({
      where: whereClause,
      include: {
        _count: {
          select: {
            media: true
          }
        },
        coverMedia: {
          select: {
            id: true,
            s3Key: true,
            thumbnailS3Key: true,
            altText: true,
            caption: true
          }
        }
      },
      skip: offset,
      take: limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.gallery.count({ where: whereClause })
  ])

  // Get image and video counts for each gallery
  const galleriesWithCounts = await Promise.all(
    galleries.map(async (gallery) => {
      const [imageCount, videoCount] = await Promise.all([
        prisma.media.count({
          where: {
            galleryId: gallery.id,
            mediaType: 'IMAGE'
          }
        }),
        prisma.media.count({
          where: {
            galleryId: gallery.id,
            mediaType: 'VIDEO'
          }
        })
      ])

      return {
        ...gallery,
        _count: {
          ...gallery._count,
          images: imageCount,
          videos: videoCount
        }
      }
    })
  )

  return {
    galleries: galleriesWithCounts,
    total,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: offset + limit < total,
      hasPrev: page > 1
    }
  }
}

// Get user's galleries with visibility filtering
router.get('/user/:userId', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params
  const viewerId = req.user?.id
  const { page = 1, limit = 20 } = req.query

  // Determine which galleries the viewer can see
  let visibilityFilter: any[] = [
    { visibility: 'PUBLIC' }
  ]

  if (viewerId) {
    if (viewerId === userId) {
      visibilityFilter = [] // Show all
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

  const where: any = {
    authorId: userId,
    ...(visibilityFilter.length > 0 ? { OR: visibilityFilter } : {})
  }

  const result = await getGalleriesWithCounts(userId, Number(page), Number(limit), where)

  res.json({
    success: true,
    data: result
  })
}))

// Get user's own galleries (authenticated)
router.get('/my', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { page = 1, limit = 20 } = req.query

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  const result = await getGalleriesWithCounts(userId, Number(page), Number(limit), { authorId: userId })

  res.json({
    success: true,
    data: result
  })
}))

// Create a gallery
router.post('/', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { name, description, visibility = 'PUBLIC' } = req.body

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({
      success: false,
      error: 'Gallery name is required'
    })
    return
  }

  const gallery = await prisma.gallery.create({
    data: {
      name: name.trim(),
      description: description?.trim(),
      visibility,
      authorId: userId
    },
    include: {
      _count: {
        select: {
          media: true
        }
      }
    }
  })

  res.status(201).json({
    success: true,
    data: { gallery },
    message: 'Gallery created successfully'
  })
}))

// Get media by gallery ID
router.get('/:id/media', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const viewerId = req.user?.id
  const { page = 1, limit = 20 } = req.query
  const offset = (Number(page) - 1) * Number(limit)

  const gallery = await prisma.gallery.findUnique({
    where: { id },
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

  if (!gallery) {
    res.status(404).json({
      success: false,
      error: 'Gallery not found'
    })
    return
  }

  // Check visibility
  if (gallery.visibility === 'PRIVATE' && gallery.authorId !== viewerId) {
    res.status(403).json({
      success: false,
      error: 'Gallery is private'
    })
    return
  }

  if (gallery.visibility === 'FRIENDS_ONLY' && gallery.authorId !== viewerId) {
    if (!viewerId) {
      res.status(403).json({
        success: false,
        error: 'Gallery is friends only'
      })
      return
    }

    const isFriend = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: viewerId, receiverId: gallery.authorId, status: 'ACCEPTED' },
          { senderId: gallery.authorId, receiverId: viewerId, status: 'ACCEPTED' }
        ]
      }
    })

    if (!isFriend) {
      res.status(403).json({
        success: false,
        error: 'Gallery is friends only'
      })
      return
    }
  }

  // Build visibility filter for media
  let whereClause: any = {
    galleryId: id
  }

  if (viewerId) {
    if (viewerId === gallery.authorId) {
      // Gallery owner can see all media - no visibility filter needed
      whereClause = {
        galleryId: id
      }
    } else {
      // Non-owner can only see public and friends-only media
      whereClause = {
        galleryId: id,
        OR: [
          { visibility: 'PUBLIC' },
          { visibility: 'FRIENDS_ONLY' }
        ]
      }
    }
  } else {
    // No viewer - only show public media
    whereClause = {
      galleryId: id,
      visibility: 'PUBLIC'
    }
  }



  const [media, total] = await Promise.all([
    prisma.media.findMany({
      where: whereClause,
      skip: offset,
      take: Number(limit),
      orderBy: [
        { order: 'asc' },
        { createdAt: 'asc' }
      ],
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
        order: true,
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
        videoS3Key: true,
      }
    }),
    prisma.media.count({
      where: whereClause
    })
  ])

  res.json({
    success: true,
    data: {
      media,
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

// Get gallery by ID with visibility check
router.get('/:id', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const viewerId = req.user?.id

  const gallery = await prisma.gallery.findUnique({
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
      media: {
        orderBy: [
          { order: 'asc' },
          { createdAt: 'asc' }
        ],
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
          order: true,
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
      },
      coverMedia: {
        select: {
          id: true,
          s3Key: true,
          thumbnailS3Key: true,
          altText: true,
          caption: true
        }
      },
      _count: {
        select: {
          media: true
        }
      }
    }
  })

  if (!gallery) {
    res.status(404).json({
      success: false,
      error: 'Gallery not found'
    })
    return
  }

  // Check visibility
  if (gallery.visibility === 'PRIVATE' && gallery.authorId !== viewerId) {
    res.status(403).json({
      success: false,
      error: 'Gallery is private'
    })
    return
  }

  if (gallery.visibility === 'FRIENDS_ONLY' && gallery.authorId !== viewerId) {
    if (!viewerId) {
      res.status(403).json({
        success: false,
        error: 'Gallery is friends only'
      })
      return
    }

    const isFriend = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: viewerId, receiverId: gallery.authorId, status: 'ACCEPTED' },
          { senderId: gallery.authorId, receiverId: viewerId, status: 'ACCEPTED' }
        ]
      }
    })

    if (!isFriend) {
      res.status(403).json({
        success: false,
        error: 'Gallery is friends only'
      })
      return
    }
  }

  // Filter media based on visibility
  const visibleMedia = gallery.media.filter(media => {
    if (media.visibility === 'PUBLIC') return true
    if (gallery.authorId === viewerId) return true
    if (media.visibility === 'FRIENDS_ONLY' && viewerId) {
      // We already checked friendship above, so if we got here, they're friends
      return true
    }
    return false
  })

  res.json({
    success: true,
    data: { 
      gallery: {
        ...gallery,
        media: visibleMedia
      }
    }
  })
}))

// Update gallery
router.put('/:id', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { id } = req.params
  const { name, description, visibility } = req.body

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  const gallery = await prisma.gallery.findUnique({
    where: { id }
  })

  if (!gallery) {
    res.status(404).json({
      success: false,
      error: 'Gallery not found'
    })
    return
  }

  if (gallery.authorId !== userId) {
    res.status(403).json({
      success: false,
      error: 'Not authorized to update this gallery'
    })
    return
  }

  const updateData: any = {}
  if (name !== undefined) updateData.name = name.trim()
  if (description !== undefined) updateData.description = description?.trim()
  if (visibility !== undefined) updateData.visibility = visibility

  const updatedGallery = await prisma.gallery.update({
    where: { id },
    data: updateData,
    include: {
      _count: {
        select: {
          media: true
        }
      },
      coverMedia: {
        select: {
          id: true,
          s3Key: true,
          thumbnailS3Key: true,
          altText: true,
          caption: true
        }
      }
    }
  })

  res.json({
    success: true,
    data: { gallery: updatedGallery },
    message: 'Gallery updated successfully'
  })
}))

// Set gallery cover image
router.post('/:id/cover', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { id } = req.params
  const { mediaId } = req.body

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  const gallery = await prisma.gallery.findUnique({
    where: { id }
  })

  if (!gallery) {
    res.status(404).json({
      success: false,
      error: 'Gallery not found'
    })
    return
  }

  if (gallery.authorId !== userId) {
    res.status(403).json({
      success: false,
      error: 'Not authorized to update this gallery'
    })
    return
  }

  // Verify the media exists and belongs to the user
  if (mediaId) {
    const media = await prisma.media.findUnique({
      where: { id: mediaId }
    })

    if (!media || media.authorId !== userId) {
      res.status(400).json({
        success: false,
        error: 'Invalid media ID'
      })
      return
    }
  }

  const updatedGallery = await prisma.gallery.update({
    where: { id },
    data: {
      coverMediaId: mediaId || null
    },
    include: {
      coverMedia: {
        select: {
          id: true,
          s3Key: true,
          thumbnailS3Key: true,
          altText: true,
          caption: true
        }
      }
    }
  })

  res.json({
    success: true,
    data: { gallery: updatedGallery },
    message: 'Gallery cover image updated successfully'
  })
}))

// Add media to gallery
router.post('/:id/media', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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

  if (!mediaIds || !Array.isArray(mediaIds) || mediaIds.length === 0) {
    res.status(400).json({
      success: false,
      error: 'Media IDs array is required'
    })
    return
  }

  const gallery = await prisma.gallery.findUnique({
    where: { id }
  })

  if (!gallery) {
    res.status(404).json({
      success: false,
      error: 'Gallery not found'
    })
    return
  }

  if (gallery.authorId !== userId) {
    res.status(403).json({
      success: false,
      error: 'Not authorized to modify this gallery'
    })
    return
  }

  // Verify that all media belong to the user
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

  // Add media to gallery
  await prisma.media.updateMany({
    where: {
      id: { in: mediaIds }
    },
    data: {
      galleryId: id
    }
  })

  res.json({
    success: true,
    message: 'Media added to gallery successfully'
  })
}))

// Remove media from gallery
router.delete('/:id/media', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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

  if (!mediaIds || !Array.isArray(mediaIds) || mediaIds.length === 0) {
    res.status(400).json({
      success: false,
      error: 'Media IDs array is required'
    })
    return
  }

  const gallery = await prisma.gallery.findUnique({
    where: { id }
  })

  if (!gallery) {
    res.status(404).json({
      success: false,
      error: 'Gallery not found'
    })
    return
  }

  if (gallery.authorId !== userId) {
    res.status(403).json({
      success: false,
      error: 'Not authorized to modify this gallery'
    })
    return
  }

  // Remove media from gallery
  await prisma.media.updateMany({
    where: {
      id: { in: mediaIds },
      galleryId: id
    },
    data: {
      galleryId: null
    }
  })

  res.json({
    success: true,
    message: 'Media removed from gallery successfully'
  })
}))

// Add endpoint for reordering media in a gallery:
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

  const gallery = await prisma.gallery.findUnique({
    where: { id },
    include: {
      media: true
    }
  })

  if (!gallery) {
    res.status(404).json({
      success: false,
      error: 'Gallery not found'
    })
    return
  }

  if (gallery.authorId !== userId) {
    res.status(403).json({
      success: false,
      error: 'Not authorized to reorder media in this gallery'
    })
    return
  }

  // Validate that all provided media IDs belong to this gallery
  const galleryMediaIds = gallery.media.map(media => media.id)
  const isValidOrder = mediaIds.every((mediaId: string) => galleryMediaIds.includes(mediaId))
  const hasAllMedia = galleryMediaIds.every(mediaId => mediaIds.includes(mediaId))

  if (!isValidOrder || !hasAllMedia) {
    res.status(400).json({
      success: false,
      error: 'Invalid media order provided'
    })
    return
  }

  // Update the order of media
  for (let i = 0; i < mediaIds.length; i++) {
    await prisma.media.update({
      where: { id: mediaIds[i] },
      data: { order: i }
    })
  }

  res.json({
    success: true,
    message: 'Media order updated successfully'
  })
}))

// Delete gallery
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

  const gallery = await prisma.gallery.findUnique({
    where: { id }
  })

  if (!gallery) {
    res.status(404).json({
      success: false,
      error: 'Gallery not found'
    })
    return
  }

  if (gallery.authorId !== userId) {
    res.status(403).json({
      success: false,
      error: 'Not authorized to delete this gallery'
    })
    return
  }

  await prisma.gallery.delete({
    where: { id }
  })

  res.json({
    success: true,
    message: 'Gallery deleted successfully'
  })
}))

export default router 