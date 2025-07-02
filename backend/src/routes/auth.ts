import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '@/index'
import { asyncHandler } from '@/middleware/errorHandler'
import { authMiddleware } from '@/middleware/auth'
import { AuthenticatedRequest } from '@/types'

const router = Router()

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

// Validation schemas
const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  username: z.string().min(3, 'Username must be at least 3 characters').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters')
})

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
})

// Generate JWT token
const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
}

// Register new user
router.post('/register', asyncHandler(async (req, res) => {
  const { name, email, username, password } = registerSchema.parse(req.body)

  // Check if user already exists
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        ...(username ? [{ username }] : [])
      ]
    }
  })

  if (existingUser) {
    return res.status(409).json({
      success: false,
      error: 'User with this email or username already exists'
    })
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12)

  // Create user
  const user = await prisma.user.create({
    data: {
      name,
      email,
      username,
      password: hashedPassword
    },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      avatar: true,
      bio: true,
      location: true,
      website: true,
      isPrivate: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true
    }
  })

  // Generate token
  const token = generateToken(user.id)

  res.status(201).json({
    success: true,
    data: {
      user,
      token
    },
    message: 'User registered successfully'
  })
}))

// Login user
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body)

  // Find user
  const user = await prisma.user.findUnique({
    where: { email }
  })

  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Invalid email or password'
    })
  }

  // Check password
  const isPasswordValid = await bcrypt.compare(password, user.password)

  if (!isPasswordValid) {
    return res.status(401).json({
      success: false,
      error: 'Invalid email or password'
    })
  }

  // Generate token
  const token = generateToken(user.id)

  // Return user data (without password)
  const { password: _, ...userData } = user

  res.json({
    success: true,
    data: {
      user: userData,
      token
    },
    message: 'Login successful'
  })
}))

// Get current user
router.get('/me', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const user = req.user

  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'User not found'
    })
  }

  res.json({
    success: true,
    data: { user }
  })
}))

// Update user profile
router.put('/profile', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id
  const { name, username, bio, location, website, isPrivate } = req.body

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
  }

  // Check if username is already taken (if provided)
  if (username) {
    const existingUser = await prisma.user.findFirst({
      where: {
        username,
        NOT: { id: userId }
      }
    })

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'Username already taken'
      })
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      username,
      bio,
      location,
      website,
      isPrivate
    },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      avatar: true,
      bio: true,
      location: true,
      website: true,
      isPrivate: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true
    }
  })

  res.json({
    success: true,
    data: { user: updatedUser },
    message: 'Profile updated successfully'
  })
}))

// Change password
router.put('/change-password', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id
  const { currentPassword, newPassword } = req.body

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
  }

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      error: 'Current password and new password are required'
    })
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      error: 'New password must be at least 6 characters'
    })
  }

  // Get user with password
  const user = await prisma.user.findUnique({
    where: { id: userId }
  })

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    })
  }

  // Verify current password
  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password)

  if (!isCurrentPasswordValid) {
    return res.status(401).json({
      success: false,
      error: 'Current password is incorrect'
    })
  }

  // Hash new password
  const hashedNewPassword = await bcrypt.hash(newPassword, 12)

  // Update password
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedNewPassword }
  })

  res.json({
    success: true,
    message: 'Password changed successfully'
  })
}))

export default router 