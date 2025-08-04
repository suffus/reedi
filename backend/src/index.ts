import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import path from 'path'
import { createServer } from 'http'

// Import routes
import authRoutes from '@/routes/auth'
import userRoutes from '@/routes/users'
import postRoutes from '@/routes/posts'
import commentRoutes from '@/routes/comments'
import mediaRoutes from '@/routes/media'
import mediaServeRoutes from '@/routes/mediaServe'
import galleryRoutes from '@/routes/galleries'
import searchRoutes from '@/routes/search'
import friendRoutes from '@/routes/friends'
import videoProcessingRoutes from '@/routes/videoProcessing'
import messageRoutes from '@/routes/messages'

// Import services
import { MessagingService } from '@/services/messagingService'

// Import services
import { StagedVideoProcessingService } from '@/services/stagedVideoProcessingService'
import { RabbitMQService } from '@/services/rabbitmqService'

// Import middleware
import { errorHandler } from '@/middleware/errorHandler'
import { authMiddleware } from '@/middleware/auth'

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

// Create Express app and HTTP server
const app = express()
const server = createServer(app)
const PORT = process.env.PORT || 8088

// Add video processing service to app context
app.locals.videoProcessingService = null

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50000, // limit each IP to 50000 requests per windowMs (increased for debugging)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
})

// Middleware
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}))
app.use(limiter)
app.use(morgan('combined'))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Serve uploads directory as static files
app.use('/uploads', (req: express.Request, res: express.Response, next: express.NextFunction): void => {
  // Add CORS headers for image requests
  res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000')
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  res.header('Cross-Origin-Resource-Policy', 'cross-origin')
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
    return
  }
  
  next()
}, express.static(path.join(process.cwd(), 'uploads')))

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
})

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/users', authMiddleware, userRoutes)
app.use('/api/posts', postRoutes)
app.use('/api/comments', commentRoutes)

// Public media serve endpoints (no authentication required)
app.use('/api/media/serve', mediaServeRoutes)

// Protected media routes (authentication required)
app.use('/api/media', authMiddleware, mediaRoutes)
app.use('/api/galleries', galleryRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/friends', friendRoutes)
app.use('/api/video-processing', videoProcessingRoutes)
app.use('/api/messages', messageRoutes)

// Error handling middleware
app.use(errorHandler)

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl 
  })
})

// Connection pool monitoring
let requestCount = 0
let errorCount = 0

// Monitor database health
setInterval(async () => {
  try {
    // Simple health check query
    await prisma.$queryRaw`SELECT 1`
    
    // Log health status every 5 minutes
    if (Date.now() % 300000 < 1000) { // Every 5 minutes
      console.log(`📊 Database Health: ${requestCount} requests, ${errorCount} errors`)
    }
  } catch (error) {
    errorCount++
    console.error('❌ Database health check failed:', error)
  }
}, 30000) // Check every 30 seconds

// Initialize services
let videoProcessingService: StagedVideoProcessingService | null = null
let messagingService: MessagingService | null = null

// Start server
async function startServer() {
  try {
    // Test database connection
    await prisma.$connect()
    console.log('✅ Database connected successfully')

    // Initialize messaging service
    try {
      messagingService = new MessagingService(server, prisma)
      app.locals.messagingService = messagingService
      console.log('✅ Messaging service started')
    } catch (error) {
      console.warn('⚠️ Messaging service failed to start:', error)
      console.warn('⚠️ Real-time messaging will be disabled')
    }

    // Initialize video processing service
    try {
      const rabbitmqService = new RabbitMQService()
      videoProcessingService = new StagedVideoProcessingService(prisma, rabbitmqService)
      await videoProcessingService.start()
      app.locals.videoProcessingService = videoProcessingService
      console.log('✅ Staged video processing service started')
    } catch (error) {
      console.warn('⚠️ Video processing service failed to start:', error)
      console.warn('⚠️ Video processing will be disabled')
    }

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`)
      console.log(`📊 Health check: http://localhost:${PORT}/health`)
      console.log(`🔗 API Base URL: http://localhost:${PORT}/api`)
      console.log(`💬 WebSocket: ws://localhost:${PORT}`)
    })
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...')
  if (videoProcessingService) {
    await videoProcessingService.stop()
  }
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...')
  if (videoProcessingService) {
    await videoProcessingService.stop()
  }
  await prisma.$disconnect()
  process.exit(0)
})

startServer() 