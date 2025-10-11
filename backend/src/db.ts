/**
 * Database Client
 * Exports a singleton Prisma client instance that can be used throughout the application
 */

import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Initialize Prisma client with optimized connection pool
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  // Optimize connection pool for high concurrency
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

// Handle cleanup on process termination
if (process.env.NODE_ENV !== 'test') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect()
  })
}


