import crypto from 'crypto'
import { prisma } from '@/db'
import { logger } from '@/utils/logger'

class VerificationService {
  private readonly CODE_LENGTH = 6
  private readonly CODE_EXPIRY_MINUTES = parseInt(process.env.VERIFICATION_CODE_EXPIRY_MINUTES || '15')
  private readonly MAX_ATTEMPTS = parseInt(process.env.MAX_VERIFICATION_ATTEMPTS || '5')

  /**
   * Generate a secure 6-digit verification code
   */
  generateVerificationCode(): string {
    // Generate a random number between 100000 and 999999
    const min = Math.pow(10, this.CODE_LENGTH - 1)
    const max = Math.pow(10, this.CODE_LENGTH) - 1
    return crypto.randomInt(min, max + 1).toString()
  }

  /**
   * Create a new verification code for an email
   */
  async createVerificationCode(email: string): Promise<string> {
    // Clean up any existing verification codes for this email
    await this.cleanupExpiredCodes(email)

    // Generate new verification code
    const code = this.generateVerificationCode()
    const expiresAt = new Date(Date.now() + this.CODE_EXPIRY_MINUTES * 60 * 1000)

    try {
      await prisma.emailVerification.create({
        data: {
          email,
          code,
          expiresAt,
          attempts: 0,
        },
      })

      logger.info(`Verification code created for ${email}`)
      return code
    } catch (error) {
      logger.error(`Failed to create verification code for ${email}:`, error)
      throw new Error('Failed to create verification code')
    }
  }

  /**
   * Verify a code for an email
   */
  async verifyCode(email: string, code: string): Promise<boolean> {
    try {
      const verification = await prisma.emailVerification.findFirst({
        where: {
          email,
          code,
          expiresAt: {
            gt: new Date(),
          },
        },
      })

      if (!verification) {
        // Increment attempts for failed verification
        await this.incrementAttempts(email)
        return false
      }

      // Code is valid, clean it up
      await prisma.emailVerification.delete({
        where: { id: verification.id },
      })

      logger.info(`Verification code verified successfully for ${email}`)
      return true
    } catch (error) {
      logger.error(`Error verifying code for ${email}:`, error)
      return false
    }
  }

  /**
   * Check if a user can request a new verification code
   */
  async canRequestNewCode(email: string): Promise<boolean> {
    try {
      const recentVerification = await prisma.emailVerification.findFirst({
        where: {
          email,
          createdAt: {
            gt: new Date(Date.now() - 60 * 1000), // Within last minute
          },
        },
      })

      return !recentVerification
    } catch (error) {
      logger.error(`Error checking if can request new code for ${email}:`, error)
      return false
    }
  }

  /**
   * Increment failed verification attempts
   */
  private async incrementAttempts(email: string): Promise<void> {
    try {
      const verification = await prisma.emailVerification.findFirst({
        where: { email },
      })

      if (verification) {
        await prisma.emailVerification.update({
          where: { id: verification.id },
          data: { attempts: verification.attempts + 1 },
        })
      }
    } catch (error) {
      logger.error(`Error incrementing attempts for ${email}:`, error)
    }
  }

  /**
   * Clean up expired verification codes
   */
  private async cleanupExpiredCodes(email?: string): Promise<void> {
    try {
      const whereClause = email
        ? { email, expiresAt: { lt: new Date() } }
        : { expiresAt: { lt: new Date() } }

      await prisma.emailVerification.deleteMany({
        where: whereClause,
      })
    } catch (error) {
      logger.error('Error cleaning up expired verification codes:', error)
    }
  }

  /**
   * Get verification status for an email
   */
  async getVerificationStatus(email: string): Promise<{
    hasActiveCode: boolean
    attempts: number
    canRequestNew: boolean
  }> {
    try {
      const verification = await prisma.emailVerification.findFirst({
        where: {
          email,
          expiresAt: { gt: new Date() },
        },
      })

      const canRequestNew = await this.canRequestNewCode(email)

      return {
        hasActiveCode: !!verification,
        attempts: verification?.attempts || 0,
        canRequestNew,
      }
    } catch (error) {
      logger.error(`Error getting verification status for ${email}:`, error)
      return {
        hasActiveCode: false,
        attempts: 0,
        canRequestNew: false,
      }
    }
  }

  /**
   * Clean up all expired codes (for maintenance)
   */
  async cleanupAllExpiredCodes(): Promise<void> {
    await this.cleanupExpiredCodes()
  }
}

export const verificationService = new VerificationService() 