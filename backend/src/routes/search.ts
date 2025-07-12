import { Router, Request, Response } from 'express'
import { prisma } from '@/index'
import { asyncHandler } from '@/middleware/errorHandler'
import { optionalAuthMiddleware } from '@/middleware/auth'
import { AuthenticatedRequest } from '@/types'

const router = Router()

// Search endpoint
router.get('/', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { q: query, type = 'all', page = 1, limit = 20 } = req.query
  const userId = req.user?.id

  if (!query || typeof query !== 'string') {
    res.status(400).json({
      success: false,
      error: 'Search query is required'
    })
    return
  }

  const offset = (Number(page) - 1) * Number(limit)
  const searchTerm = query.toLowerCase()

  let results: any = {}
  let total = 0

  // Search posts
  if (type === 'all' || type === 'posts') {
    const [posts, postsCount] = await Promise.all([
      prisma.post.findMany({
        where: {
          OR: [
            { title: { contains: searchTerm, mode: 'insensitive' } },
            { content: { contains: searchTerm, mode: 'insensitive' } }
          ],
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
          OR: [
            { title: { contains: searchTerm, mode: 'insensitive' } },
            { content: { contains: searchTerm, mode: 'insensitive' } }
          ],
          publicationStatus: 'PUBLIC',
          isPrivate: false
        }
      })
    ])

    results.posts = posts
    total += postsCount
  }

  // Search users
  if (type === 'all' || type === 'users') {
    const [users, usersCount] = await Promise.all([
      prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { username: { contains: searchTerm, mode: 'insensitive' } },
            { bio: { contains: searchTerm, mode: 'insensitive' } }
          ]
        },
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true,
          bio: true,
          _count: {
            select: {
              posts: true,
              followers: true,
              following: true
            }
          }
        },
        skip: offset,
        take: Number(limit),
        orderBy: { name: 'asc' }
      }),
      prisma.user.count({
        where: {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { username: { contains: searchTerm, mode: 'insensitive' } },
            { bio: { contains: searchTerm, mode: 'insensitive' } }
          ]
        }
      })
    ])

    results.users = users
    total += usersCount
  }

  // Search hashtags
  if (type === 'all' || type === 'hashtags') {
    const [hashtags, hashtagsCount] = await Promise.all([
      prisma.hashtag.findMany({
        where: {
          name: { contains: searchTerm, mode: 'insensitive' }
        },
        include: {
          _count: {
            select: {
              posts: true
            }
          }
        },
        skip: offset,
        take: Number(limit),
        orderBy: { name: 'asc' }
      }),
      prisma.hashtag.count({
        where: {
          name: { contains: searchTerm, mode: 'insensitive' }
        }
      })
    ])

    results.hashtags = hashtags
    total += hashtagsCount
  }

  // Save search history if user is authenticated
  if (userId) {
    await prisma.searchHistory.create({
      data: {
        query: searchTerm,
        userId
      }
    })
  }

  res.json({
    success: true,
    data: {
      results,
      query: searchTerm,
      type,
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

// Get search suggestions
router.get('/suggestions', asyncHandler(async (req: Request, res: Response) => {
  const { q: query } = req.query

  if (!query || typeof query !== 'string') {
    res.json({
      success: true,
      data: { suggestions: [] }
    })
    return
  }

  const searchTerm = query.toLowerCase()

  const [users, hashtags] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { username: { contains: searchTerm, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        name: true,
        username: true,
        avatar: true
      },
      take: 5,
      orderBy: { name: 'asc' }
    }),
    prisma.hashtag.findMany({
      where: {
        name: { contains: searchTerm, mode: 'insensitive' }
      },
      take: 5,
      orderBy: { name: 'asc' }
    })
  ])

  const suggestions = [
    ...users.map(user => ({ type: 'user', ...user })),
    ...hashtags.map(tag => ({ type: 'hashtag', ...tag }))
  ]

  res.json({
    success: true,
    data: { suggestions }
  })
}))

export default router 