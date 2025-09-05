import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '@/index'
import { asyncHandler } from '@/middleware/errorHandler'
import { authMiddleware } from '@/middleware/auth'
import { AuthenticatedRequest } from '@/types'
import { emailService } from '@/services/emailService'
import { verificationService } from '@/services/verificationService'

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

const verifyEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
  code: z.string().length(6, 'Verification code must be 6 digits')
})

const resendVerificationSchema = z.object({
  email: z.string().email('Invalid email address')
})

// Generate JWT token
const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
}

// Register new user (Step 1: Create unverified account and send verification code)
router.post('/register', asyncHandler(async (req: Request, res: Response) => {
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
    res.status(409).json({
      success: false,
      error: 'User with this email or username already exists'
    })
    return
  }

  // Check if user can request a new verification code
  const canRequestNew = await verificationService.canRequestNewCode(email)
  if (!canRequestNew) {
    res.status(429).json({
      success: false,
      error: 'Please wait before requesting another verification code'
    })
    return
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12)

  // Create unverified user
  const user = await prisma.user.create({
    data: {
      name,
      email,
      username,
      password: hashedPassword,
      emailVerified: false,
      isVerified: false
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
      emailVerified: true,
      createdAt: true,
      updatedAt: true
    }
  })

  try {
    // Generate and send verification code
    const verificationCode = await verificationService.createVerificationCode(email)
    const emailSent = await emailService.sendVerificationEmail(email, verificationCode, name)

    if (!emailSent) {
      // If email fails, delete the user and return error
      await prisma.user.delete({ where: { id: user.id } })
      res.status(500).json({
        success: false,
        error: 'Failed to send verification email. Please try again.'
      })
      return
    }

    res.status(201).json({
      success: true,
      data: {
        user: { ...user, emailVerified: false },
        message: 'Please check your email for verification code'
      },
      message: 'Registration successful. Please verify your email to complete registration.'
    })
  } catch (error) {
    // If verification code creation fails, delete the user and return error
    await prisma.user.delete({ where: { id: user.id } })
    res.status(500).json({
      success: false,
      error: 'Failed to create verification code. Please try again.'
    })
  }
}))

// Login user
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = loginSchema.parse(req.body)

  // Find user
  const user = await prisma.user.findUnique({
    where: { email }
  })

  if (!user) {
    res.status(401).json({
      success: false,
      error: 'Invalid email or password'
    })
    return
  }

  // Check password
  const isPasswordValid = await bcrypt.compare(password, user.password)

  if (!isPasswordValid) {
    res.status(401).json({
      success: false,
      error: 'Invalid email or password'
    })
    return
  }

  // Check if email is verified
  if (!user.emailVerified && !user.isVerified) {
    res.status(403).json({
      success: false,
      error: 'Please verify your email address before logging in.',
      needsVerification: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    })
    return
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
router.get('/me', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user

  if (!user) {
    res.status(401).json({
      success: false,
      error: 'User not found'
    })
    return
  }

  res.json({
    success: true,
    data: { user }
  })
}))

// Update user profile
router.put('/profile', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { name, username, bio, location, website, isPrivate } = req.body

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
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
      res.status(409).json({
        success: false,
        error: 'Username already taken'
      })
      return
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
router.put('/change-password', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { currentPassword, newPassword } = req.body

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  if (!currentPassword || !newPassword) {
    res.status(400).json({
      success: false,
      error: 'Current password and new password are required'
    })
    return
  }

  if (newPassword.length < 6) {
    res.status(400).json({
      success: false,
      error: 'New password must be at least 6 characters'
    })
    return
  }

  // Get user with password
  const user = await prisma.user.findUnique({
    where: { id: userId }
  })

  if (!user) {
    res.status(404).json({
      success: false,
      error: 'User not found'
    })
    return
  }

  // Verify current password
  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password)

  if (!isCurrentPasswordValid) {
    res.status(401).json({
      success: false,
      error: 'Current password is incorrect'
    })
    return
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

// Verify email with verification code (Step 2: Complete registration)
router.post('/verify-email', asyncHandler(async (req: Request, res: Response) => {
  const { email, code } = verifyEmailSchema.parse(req.body)

  // Find the user
  const user = await prisma.user.findUnique({
    where: { email }
  })

  if (!user) {
    res.status(404).json({
      success: false,
      error: 'User not found'
    })
    return
  }

  if (user.emailVerified) {
    res.status(400).json({
      success: false,
      error: 'Email is already verified'
    })
    return
  }

  // Verify the code
  const isValidCode = await verificationService.verifyCode(email, code)
  if (!isValidCode) {
    res.status(400).json({
      success: false,
      error: 'Invalid or expired verification code'
    })
    return
  }

  // Mark user as verified
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerifiedAt: new Date(),
      isVerified: true
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
      emailVerified: true,
      emailVerifiedAt: true,
      createdAt: true,
      updatedAt: true
    }
  })

  // Generate token
  const token = generateToken(updatedUser.id)

  res.json({
    success: true,
    data: {
      user: updatedUser,
      token
    },
    message: 'Email verified successfully. Welcome to Reedi!'
  })
}))

// Resend verification code
router.post('/resend-verification', asyncHandler(async (req: Request, res: Response) => {
  const { email } = resendVerificationSchema.parse(req.body)

  // Find the user
  const user = await prisma.user.findUnique({
    where: { email }
  })

  if (!user) {
    res.status(404).json({
      success: false,
      error: 'User not found'
    })
    return
  }

  if (user.emailVerified) {
    res.status(400).json({
      success: false,
      error: 'Email is already verified'
    })
    return
  }

  // Check if user can request a new code
  const canRequestNew = await verificationService.canRequestNewCode(email)
  if (!canRequestNew) {
    res.status(429).json({
      success: false,
      error: 'Please wait before requesting another verification code'
    })
    return
  }

  try {
    // Generate and send new verification code
    const verificationCode = await verificationService.createVerificationCode(email)
    const emailSent = await emailService.sendVerificationEmail(email, verificationCode, user.name)

    if (!emailSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to send verification email. Please try again.'
      })
      return
    }

    res.json({
      success: true,
      message: 'Verification code sent successfully. Please check your email.'
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to send verification code. Please try again.'
    })
  }
}))

// Get verification status
router.get('/verification-status/:email', asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.params

  // Find the user
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      emailVerifiedAt: true
    }
  })

  if (!user) {
    res.status(404).json({
      success: false,
      error: 'User not found'
    })
    return
  }

  // Get verification service status
  const verificationStatus = await verificationService.getVerificationStatus(email)

  res.json({
    success: true,
    data: {
      user: {
        email: user.email,
        emailVerified: user.emailVerified,
        emailVerifiedAt: user.emailVerifiedAt
      },
      verification: verificationStatus
    }
  })
}))

export default router 