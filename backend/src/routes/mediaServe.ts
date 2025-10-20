import { Router, Request, Response } from 'express'
import { prisma } from '@/db'
import { asyncHandler } from '@/middleware/errorHandler'
import { optionalAuthMiddleware } from '@/middleware/auth'
import { AuthenticatedRequest } from '@/types'
import { getImageFromS3 } from '@/utils/s3Service'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

const router = Router()

// Initialize S3 client for streaming
const s3Client = new S3Client({
  region: process.env.IDRIVE_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.IDRIVE_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.IDRIVE_SECRET_ACCESS_KEY || ''
  },
  endpoint: process.env.IDRIVE_ENDPOINT,
  forcePathStyle: true,
  // Add timeout configurations to prevent hanging
  maxAttempts: 3, // Retry up to 3 times
})

// Track active connections for debugging
let activeConnections = 0
let totalConnections = 0
let failedConnections = 0
let timeouts = 0
let totalDataSent = 0
let totalDataCount = 0

// Log connection stats every 30 seconds
setInterval(() => {
  const totalDataInGB = (totalDataSent/1024/1024/1024).toFixed(3)
  console.log(`🔗 MediaServe Connection Stats: Active: ${activeConnections}, Total: ${totalConnections}, Failed: ${failedConnections}, Timeouts: ${timeouts} Total Data Sent  : ${totalDataInGB}G Total Data Count: ${totalDataCount}`)
}, 5000)

// Function to stream video from S3
async function streamVideoFromS3(s3Key: string, mimeType: string | null, req: Request, res: Response) {
  const connectionId = ++totalConnections
  
  console.log(`🎥 [${connectionId}] Starting video stream for ${s3Key}`)
  
  // Track if this connection has been cleaned up
  let connectionCleanedUp = false
  
  // Create AbortController for this stream
  const abortController = new AbortController()
  
  const cleanupConnection = () => {
    if (!connectionCleanedUp) {
      connectionCleanedUp = true
      activeConnections--
      
      // Abort the S3 request and destroy the stream
      try {
        console.log(`🎥 [${connectionId}] Aborting S3 request and destroying stream...`)
        abortController.abort()
      } catch (error) {
        console.error(`🎥 [${connectionId}] Error aborting stream:`, error)
      }
      
      console.log(`🎥 [${connectionId}] Connection cleaned up, active connections: ${activeConnections}`)
    }
  }
  
  // Set a timeout to force cleanup if connection hangs
  const connectionTimeout = setTimeout(() => {
    console.warn(`🎥 [${connectionId}] Connection timeout - forcing cleanup`)
    timeouts++
    cleanupConnection()
    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        error: 'Request timeout'
      })
    } else {
      res.end()
    }
  }, 1200000) // 120 second timeout
  
  // Add S3 request timeout and detailed debugging
  const s3StartTime = Date.now()
  
  try {
    const bucket = process.env.IDRIVE_BUCKET_NAME || ''
    
    // Get the range header from the request
    const range = req.headers.range
    
    // Prepare the S3 request
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      ...(range && { Range: range })
    })

    
    
    console.log(`🎥 [${connectionId}] S3 request prepared, sending command...`)
    
    console.log(`🎥 [${connectionId}] S3 request start time: ${s3StartTime}`)
    
    // Get the object from S3 with abort signal and detailed timing
    const response = await Promise.race([
      s3Client.send(command, { abortSignal: abortController.signal }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('S3 request timeout')), 2500)
      )
    ])
    
    const s3Time = Date.now() - s3StartTime
    console.log(`🎥 [${connectionId}] S3 response received in ${s3Time}ms`)
    
    if (!response.Body) {
      throw new Error('No body in S3 response')
    }
    
    console.log(`🎥 [${connectionId}] S3 response received, setting up stream...`)
    
    // Set appropriate headers
    res.setHeader('Content-Type', mimeType || 'video/mp4')
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'public, max-age=31536000') // Cache for 1 year
    
    // Handle range requests
    if (range && response.ContentRange) {
      res.status(206)
      res.setHeader('Content-Range', response.ContentRange)
      res.setHeader('Content-Length', response.ContentLength?.toString() || '0')
    } else {
      res.setHeader('Content-Length', response.ContentLength?.toString() || '0')
    }
    
    console.log(`🎥 [${connectionId}] Starting pipe operation...`)
    
    activeConnections++
    // Pipe the S3 response to the HTTP response
    const stream = response.Body as any
    let dataSent = 0
    let dataCount = 0
    
    // Set up error handling for the stream
    stream.on('error', (error: any) => {
      clearTimeout(connectionTimeout)
      failedConnections++
      console.error(`🎥 [${connectionId}] Stream error:`, error)
      cleanupConnection()
      
      // Fallback to buffered download if streaming fails
      console.log(`🎥 [${connectionId}] Attempting fallback to buffered download...`)
      fallbackToBufferedDownload(s3Key, mimeType, req, res, connectionId)
    })
    
    stream.on('end', () => {
      clearTimeout(connectionTimeout)
      console.log(`🎥 [${connectionId}] Stream ended successfully`)
      cleanupConnection()
    })

    stream.on('data', (chunk: any) => {
      // Check if connection is already cleaned up - if so, don't process more data
      if (connectionCleanedUp) {
        //console.log(`🎥 [${connectionId}] Ignoring data chunk after cleanup, size: ${chunk.length} bytes`)
        //return
      }
      
      dataSent += chunk.length
      totalDataSent += chunk.length
      totalDataCount++
      dataCount++
      if(dataCount % 20 === 0) {
        const bytesSent = (dataSent/1024/1024).toFixed(3) + " MB"
        const dataRate = (dataSent/(Date.now() - s3StartTime)/1024*1000).toFixed(3) + " KB/s"
        console.log(`🎥 [${connectionId}] Stream video data received, total data sent: ${bytesSent} at ${dataRate} is stream closed: ${connectionCleanedUp}`)
      }
    })
    
    stream.on('close', () => {
      clearTimeout(connectionTimeout)
      console.log(`🎥 [${connectionId}] Stream closed`)
      cleanupConnection()
    })
    
    // Handle response events
    res.on('error', (error: any) => {
      clearTimeout(connectionTimeout)
      failedConnections++
      console.error(`🎥 [${connectionId}] Response error:`, error)
      cleanupConnection()
    })
    
    res.on('close', () => {
      clearTimeout(connectionTimeout)
      console.log(`🎥 [${connectionId}] Response closed`)
      cleanupConnection()
    })
    
    res.on('finish', () => {
      clearTimeout(connectionTimeout)
      console.log(`🎥 [${connectionId}] Response finished`)
      cleanupConnection()
    })
    
    // Handle request events
    req.on('close', () => {
      clearTimeout(connectionTimeout)
      console.log(`🎥 [${connectionId}] Request closed by client`)
      cleanupConnection()
    })
    
    req.on('aborted', () => {
      clearTimeout(connectionTimeout)
      console.log(`🎥 [${connectionId}] Request aborted by client`)
      cleanupConnection()
    })
    
    // Start streaming
    stream.pipe(res)
    
  } catch (error) {
    clearTimeout(connectionTimeout)
    failedConnections++
    const s3Time = Date.now() - s3StartTime
    
    // Check if this was an abort error
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
      console.log(`🎥 [${connectionId}] S3 request aborted after ${s3Time}ms`)
    } else {
      console.error(`🎥 [${connectionId}] Error streaming video from S3 after ${s3Time}ms:`, error)
    }
    
    cleanupConnection()
    
    // Fallback to buffered download if S3 request fails
    console.log(`🎥 [${connectionId}] Attempting fallback to buffered download...`)
    fallbackToBufferedDownload(s3Key, mimeType, req, res, connectionId)
  }
}

// Fallback function to download video as buffer when streaming fails
async function fallbackToBufferedDownload(s3Key: string, mimeType: string | null, req: Request, res: Response, connectionId: number) {
  try {
    throw "We are not trying to fallback to buffered download"
    console.log(`🎥 [${connectionId}] Starting fallback buffered download for ${s3Key}`)
    
    // Import the working S3 service
    const { getImageFromS3 } = await import('@/utils/s3Service')
    
    // Get the video as a buffer (this works reliably)
    const videoBuffer = await getImageFromS3(s3Key)
    
    console.log(`🎥 [${connectionId}] Fallback download completed, buffer size: ${videoBuffer.length} bytes`)
    
    // Set appropriate headers
    res.setHeader('Content-Type', mimeType || 'video/mp4')
    res.setHeader('Content-Length', videoBuffer.length.toString())
    res.setHeader('Cache-Control', 'public, max-age=31536000')
    
    // Send the buffer
    res.end(videoBuffer)
    
    console.log(`🎥 [${connectionId}] Fallback download served successfully`)
    
  } catch (fallbackError) {
    console.error(`🎥 [${connectionId}] Fallback download also failed:`, fallbackError)
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to serve video content'
      })
    }
  }
}


// Function to stream image from S3
async function streamImageFromS3(s3Key: string, mimeType: string | null, req: Request, res: Response) {
  const connectionId = ++totalConnections
  activeConnections++
  
  console.log(`🖼️ [${connectionId}] Starting image stream for ${s3Key}`)
  
  // Track if this connection has been cleaned up
  let connectionCleanedUp = false
  
  // Create AbortController for this stream
  const abortController = new AbortController()
  
  const cleanupConnection = () => {
    if (!connectionCleanedUp) {
      connectionCleanedUp = true
      activeConnections--
      
      // Abort the S3 request and destroy the stream
      try {
        console.log(`🖼️ [${connectionId}] Aborting S3 request and destroying stream...`)
        abortController.abort()
      } catch (error) {
        console.error(`🖼️ [${connectionId}] Error aborting stream:`, error)
      }
      
      console.log(`🖼️ [${connectionId}] Connection cleaned up, active connections: ${activeConnections}`)
    }
  }
  
  // Set a timeout to force cleanup if connection hangs
  const connectionTimeout = setTimeout(() => {
    console.warn(`🖼️ [${connectionId}] Connection timeout - forcing cleanup`)
    timeouts++
    cleanupConnection()
    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        error: 'Request timeout'
      })
    } else {
      res.end()
    }
  }, 35000) // 35 second timeout for images (shorter than videos)
  
  try {
    const bucket = process.env.IDRIVE_BUCKET_NAME || ''
    
    // Prepare the S3 request
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: s3Key
    })
    
    console.log(`🖼️ [${connectionId}] S3 request prepared, sending command...`)
    
    // Get the object from S3 with abort signal
    const response = await s3Client.send(command, { abortSignal: abortController.signal })
    
    const s3StartTime = Date.now()

    let dataSent = 0

    if (!response.Body) {
      throw new Error('No body in S3 response')
    }
    
    console.log(`🖼️ [${connectionId}] S3 response received, setting up stream...`)
    
    // Set appropriate headers for images
    res.setHeader('Content-Type', mimeType || 'image/jpeg')
    res.setHeader('Cache-Control', 'public, max-age=31536000') // Cache for 1 year
    res.setHeader('Content-Length', response.ContentLength?.toString() || '0')
    
    // Stream the image data directly to the response
    const stream = response.Body as any
    
    // Add comprehensive error handling for the stream
    stream.on('error', (error: any) => {
      console.error(`🖼️ [${connectionId}] Stream error:`, error)
      failedConnections++
      clearTimeout(connectionTimeout)
      cleanupConnection()
      
      // Fallback to buffered download if streaming fails
      console.log(`🖼️ [${connectionId}] Attempting fallback to buffered download...`)
      fallbackToBufferedImageDownload(s3Key, mimeType, req, res, connectionId)
    })
    
    stream.on('end', () => {
      console.log(`🖼️ [${connectionId}] Stream ended successfully`)
      clearTimeout(connectionTimeout)
      cleanupConnection()
    })
    
    stream.on('close', () => {
      console.log(`🖼️ [${connectionId}] Stream closed`)
      clearTimeout(connectionTimeout)
      cleanupConnection()
    })

    stream.on('data', (chunk: any) => {
      // Check if connection is already cleaned up - if so, don't process more data
      if (connectionCleanedUp) {
        console.log(`🖼️ [${connectionId}] Ignoring data chunk after cleanup, size: ${chunk.length} bytes`)
        return
      }
      dataSent += chunk.length
      totalDataSent += chunk.length
      totalDataCount++
      if(totalDataCount % 20 === 0) {
        const bytesSent = (dataSent/1024/1024).toFixed(3) + " MB"
        const dataRate = (dataSent/(Date.now() - s3StartTime)/1024*1000).toFixed(3) + " KB/s"
        console.log(`🎥 [${connectionId}] Stream image data received, total data sent: ${bytesSent} at ${dataRate} is stream closed: ${connectionCleanedUp}`)
      }
    
    })
    
    // Handle response errors
    res.on('error', (error: any) => {
      console.error(`🖼️ [${connectionId}] Response error:`, error)
      clearTimeout(connectionTimeout)
      cleanupConnection()
    })
    
    res.on('close', () => {
      console.log(`🖼️ [${connectionId}] Response closed`)
      clearTimeout(connectionTimeout)
      cleanupConnection()
    })
    
    res.on('finish', () => {
      console.log(`🖼️ [${connectionId}] Response finished successfully`)
      clearTimeout(connectionTimeout)
      cleanupConnection()
    })
    
    // Handle client disconnect
    req.on('close', () => {
      console.log(`🖼️ [${connectionId}] Client disconnected`)
      clearTimeout(connectionTimeout)
      cleanupConnection()
    })
    
    req.on('aborted', () => {
      console.log(`🖼️ [${connectionId}] Request aborted by client`)
      clearTimeout(connectionTimeout)
      cleanupConnection()
    })
    
    console.log(`🖼️ [${connectionId}] Starting pipe operation...`)
    stream.pipe(res)
    
  } catch (error) {
    console.error(`🖼️ [${connectionId}] Error streaming image from S3:`, error)
    failedConnections++
    clearTimeout(connectionTimeout)
    
    // Check if this was an abort error
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
      console.log(`🖼️ [${connectionId}] S3 request aborted`)
    }
    
    cleanupConnection()
    
    // Fallback to buffered download if S3 request fails
    console.log(`🖼️ [${connectionId}] Attempting fallback to buffered download...`)
    fallbackToBufferedImageDownload(s3Key, mimeType, req, res, connectionId)
  }
}

// Fallback function to download image as buffer when streaming fails
async function fallbackToBufferedImageDownload(s3Key: string, mimeType: string | null, req: Request, res: Response, connectionId: number) {
  try {
    throw "We are not trying to fallback to buffered download"
    console.log(`🖼️ [${connectionId}] Starting fallback buffered download for ${s3Key}`)
    
    // Import the working S3 service
    const { getImageFromS3 } = await import('@/utils/s3Service')
    
    // Get the image as a buffer (this works reliably)
    const imageBuffer = await getImageFromS3(s3Key)
    
    console.log(`🖼️ [${connectionId}] Fallback download completed, buffer size: ${imageBuffer.length} bytes`)
    
    // Set appropriate headers
    res.setHeader('Content-Type', mimeType || 'image/jpeg')
    res.setHeader('Content-Length', imageBuffer.length.toString())
    res.setHeader('Cache-Control', 'public, max-age=31536000')
    
    // Send the buffer
    res.end(imageBuffer)
    
    console.log(`🖼️ [${connectionId}] Fallback download served successfully`)
    
  } catch (fallbackError) {
    console.error(`🖼️ [${connectionId}] Fallback download also failed:`, fallbackError)
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to serve image content'
      })
    }
  }
}

// Add CORS headers for all media serve requests
router.use((req: Request, res: Response, next) => {
  res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000')
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range')
  res.header('Cross-Origin-Resource-Policy', 'cross-origin')
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
    return
  }
  
  next()
})

// Helper function to check if user can view media (with existing media data)
async function canViewMediaWithData(media: any, viewerId?: string): Promise<boolean> {
  // Public media can be viewed by anyone
  if (media.visibility === 'PUBLIC') {
    return true
  }

  // Private media can only be viewed by the author
  if (media.visibility === 'PRIVATE') {
    return viewerId === media.authorId
  }

  // Friends only media can be viewed by the author or friends
  if (media.visibility === 'FRIENDS_ONLY') {
    if (!viewerId) {
      return false
    }
    
    if (viewerId === media.authorId) {
      return true
    }

    // Check if they are friends
    const friendship = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: viewerId, receiverId: media.authorId, status: 'ACCEPTED' },
          { senderId: media.authorId, receiverId: viewerId, status: 'ACCEPTED' }
        ]
      }
    })

    return !!friendship
  }

  return false
}

// Helper function to get media and check permissions in the correct order
async function getMediaAndCheckPermissions(
  mediaId: string, 
  viewerId?: string, 
  selectFields?: {
    s3Key?: boolean
    videoS3Key?: boolean
    mimeType?: boolean
    mediaType?: boolean
    processingStatus?: boolean
    versions?: boolean
  }
) {
  // First check if media exists
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    select: {
      id: true,
      visibility: true,
      authorId: true,
      ...(selectFields || {})
    }
  })

  if (!media) {
    return { media: null, canView: false, error: 'NOT_FOUND' as const }
  }

  // Now check if user can view this media
  const canView = await canViewMediaWithData(media, viewerId)
  if (!canView) {
    return { media: null, canView: false, error: 'FORBIDDEN' as const }
  }

  return { media, canView: true, error: null }
}

// Helper function to check if user can view media (legacy - fetches media first)
async function canViewMedia(mediaId: string, viewerId?: string): Promise<boolean> {
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    select: {
      id: true,
      visibility: true,
      authorId: true
    }
  })

  if (!media) {
    return false
  }

  return canViewMediaWithData(media, viewerId)
}

// Serve media directly from backend
router.get('/:id', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const viewerId = req.user?.id
  const startTime = Date.now()

  console.log(`📺 [${id}] Media serve request started for user: ${viewerId || 'anonymous'}`)

  // Handle locked media placeholders
  if (id === 'locked-image' || id === 'locked-video') {
    const isVideo = id === 'locked-video'
    
    // Generate a simple locked placeholder image
    const svg = `
      <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f3f4f6"/>
        <rect x="100" y="100" width="200" height="200" fill="#e5e7eb" rx="20"/>
        <rect x="150" y="120" width="100" height="60" fill="#6b7280" rx="8"/>
        <circle cx="200" cy="150" r="8" fill="#9ca3af"/>
        <rect x="190" y="160" width="20" height="10" fill="#9ca3af" rx="2"/>
        ${isVideo ? `
          <circle cx="200" cy="220" r="30" fill="#6b7280"/>
          <polygon points="190,210 190,230 210,220" fill="white"/>
        ` : `
          <rect x="170" y="200" width="60" height="40" fill="#6b7280" rx="4"/>
          <circle cx="185" cy="215" r="3" fill="#9ca3af"/>
          <circle cx="195" cy="215" r="3" fill="#9ca3af"/>
          <circle cx="205" cy="215" r="3" fill="#9ca3af"/>
          <rect x="175" y="225" width="50" height="8" fill="#9ca3af" rx="2"/>
        `}
        <text x="200" y="280" font-family="Arial, sans-serif" font-size="16" fill="#6b7280" text-anchor="middle">Locked Content</text>
      </svg>
    `
    
    const svgBuffer = Buffer.from(svg, 'utf-8')
    
    res.setHeader('Content-Type', 'image/svg+xml')
    res.setHeader('Content-Length', svgBuffer.length)
    res.setHeader('Cache-Control', 'public, max-age=31536000') // Cache for 1 year
    
    res.end(svgBuffer)
    console.log(`📺 [${id}] Locked media placeholder served in ${Date.now() - startTime}ms`)
    return
  }

  // Get media and check permissions in the correct order
  const dbStartTime = Date.now()
  console.log(`📺 [${id}] Starting database queries...`)
  
  const { media, canView, error } = await getMediaAndCheckPermissions(id, viewerId, {
    s3Key: true,
    videoS3Key: true,
    mimeType: true,
    mediaType: true,
    processingStatus: true,
    versions: true
  })

  const dbTime = Date.now() - dbStartTime
  console.log(`📺 [${id}] Database queries completed in ${dbTime}ms`)

  if (error === 'NOT_FOUND') {
    console.log(`📺 [${id}] Media not found`)
    res.status(404).json({
      success: false,
      error: 'Media not found'
    })
    return
  }

  if (error === 'FORBIDDEN') {
    console.log(`📺 [${id}] Access denied for user ${viewerId}`)
    res.status(403).json({
      success: false,
      error: 'Access denied'
    })
    return
  }

  // At this point, media should not be null
  if (!media) {
    console.error(`📺 [${id}] Internal server error: media is null after permission check`)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
    return
  }

  const mediaType = media.mediaType
  const processingStatus = media.processingStatus
  const mimeType = media.mimeType

  console.log(`📺 [${id}] Media type: ${mediaType}, Processing status: ${processingStatus}`)

  // For videos that are still processing, return a placeholder or error
  if (mediaType === 'VIDEO' && processingStatus !== 'COMPLETED') {
    console.log(`📺 [${id}] Video still processing: ${processingStatus}`)
    res.status(202).json({
      success: false,
      error: 'Video is still processing',
      processingStatus: media.processingStatus
    })
    return
  }

  try {
    // Determine which S3 key to serve
    let s3Key = media.s3Key
    
    if (mediaType === 'VIDEO') {
      // For videos, prefer 540p quality if available, otherwise fall back to processed video or original
      let preferredS3Key = null
      
      // Check if 540p version exists in videoVersions
      if (media.versions && Array.isArray(media.versions)) {
        const videoVersions = media.versions as any[]
        const version540p = videoVersions.find((version: any) => version.quality === '540p')
        if (version540p) {
          preferredS3Key = version540p.s3Key || version540p.s3_key
          console.log(`📺 [${id}] Found 540p version, using S3 key: ${preferredS3Key}`)
        }
      }
      
      // If 540p not found, fall back to processed video or original
      if (!preferredS3Key) {
        if (media.videoS3Key) {
          preferredS3Key = media.videoS3Key
          console.log(`📺 [${id}] No 540p version found, using processed video S3 key: ${preferredS3Key}`)
        } else {
          preferredS3Key = media.s3Key
          console.log(`📺 [${id}] No processed video found, using original S3 key: ${preferredS3Key}`)
        }
      }
      
      s3Key = preferredS3Key
    }

    if (!s3Key) {
      console.error(`📺 [${id}] No S3 key found for media`)
      res.status(404).json({
        success: false,
        error: 'Media file not found'
      })
      return
    }

    console.log(`📺 [${id}] Serving media with S3 key: ${s3Key}`)

    // For videos, use streaming approach
    if (mediaType === 'VIDEO') {
      await streamVideoFromS3(s3Key, mimeType, req, res)
    } else {
      // For images, use the existing approach
      const s3StartTime = Date.now()
      console.log(`📺 [${id}] Fetching image from S3...`)
      
      const mediaBuffer = await getImageFromS3(s3Key)
      
      const s3Time = Date.now() - s3StartTime
      console.log(`📺 [${id}] S3 fetch completed in ${s3Time}ms, buffer size: ${mediaBuffer.length} bytes`)
      
      // Set appropriate headers
      res.setHeader('Content-Type', mimeType || 'application/octet-stream')
      res.setHeader('Content-Length', mediaBuffer.length)
      res.setHeader('Cache-Control', 'public, max-age=31536000') // Cache for 1 year
      
      res.end(mediaBuffer)
      console.log(`📺 [${id}] Image served successfully in ${Date.now() - startTime}ms`)
    }

  } catch (error) {
    console.error(`📺 [${id}] Error serving media:`, error)
    res.status(500).json({
      success: false,
      error: 'Error serving media'
    })
  }
}))

// Serve media thumbnail
router.get('/:id/thumbnail', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const viewerId = req.user?.id
  const startTime = Date.now()

  console.log(`🖼️ [${id}] Thumbnail request started for user: ${viewerId || 'anonymous'}`)

  // Handle locked media placeholders
  if (id === 'locked-image' || id === 'locked-video') {
    const isVideo = id === 'locked-video'
    
    // Generate a smaller locked placeholder image for thumbnails
    const svg = `
      <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f3f4f6"/>
        <rect x="50" y="50" width="100" height="100" fill="#e5e7eb" rx="10"/>
        <rect x="75" y="60" width="50" height="30" fill="#6b7280" rx="4"/>
        <circle cx="100" cy="75" r="4" fill="#9ca3af"/>
        <rect x="95" y="80" width="10" height="5" fill="#9ca3af" rx="1"/>
        ${isVideo ? `
          <circle cx="100" cy="110" r="15" fill="#6b7280"/>
          <polygon points="95,105 95,115 105,110" fill="white"/>
        ` : `
          <rect x="85" y="100" width="30" height="20" fill="#6b7280" rx="2"/>
          <circle cx="92" cy="107" r="1.5" fill="#9ca3af"/>
          <circle cx="97" cy="107" r="1.5" fill="#9ca3af"/>
          <circle cx="102" cy="107" r="1.5" fill="#9ca3af"/>
          <rect x="87" y="112" width="26" height="4" fill="#9ca3af" rx="1"/>
        `}
        <text x="100" y="140" font-family="Arial, sans-serif" font-size="8" fill="#6b7280" text-anchor="middle">Locked</text>
      </svg>
    `
    
    const svgBuffer = Buffer.from(svg, 'utf-8')
    
    res.setHeader('Content-Type', 'image/svg+xml')
    res.setHeader('Content-Length', svgBuffer.length)
    res.setHeader('Cache-Control', 'public, max-age=31536000') // Cache for 1 year
    
    res.end(svgBuffer)
    console.log(`🖼️ [${id}] Locked thumbnail placeholder served in ${Date.now() - startTime}ms`)
    return
  }

  // Check if user can view this media
  const permissionStartTime = Date.now()
  console.log(`🖼️ [${id}] Checking permissions...`)
  
  const canView = await canViewMedia(id, viewerId)
  
  const permissionTime = Date.now() - permissionStartTime
  console.log(`🖼️ [${id}] Permission check completed in ${permissionTime}ms, result: ${canView}`)
  
  if (!canView) {
    console.log(`🖼️ [${id}] Access denied for user ${viewerId}`)
    res.status(403).json({
      success: false,
      error: 'Access denied'
    })
    return
  }

  const dbStartTime = Date.now()
  console.log(`🖼️ [${id}] Fetching media from database...`)
  
  const media = await prisma.media.findUnique({
    where: { id },
    select: {
      id: true,
      thumbnails: true,
      mimeType: true,
      mediaType: true,
      processingStatus: true
    }
  })

  const dbTime = Date.now() - dbStartTime
  console.log(`🖼️ [${id}] Database query completed in ${dbTime}ms`)

  if (!media) {
    console.log(`🖼️ [${id}] Media not found`)
    res.status(404).json({
      success: false,
      error: 'Media not found'
    })
    return
  }

  // For videos that are still processing, return a placeholder
  if (media.mediaType === 'VIDEO' && media.processingStatus !== 'COMPLETED') {
    console.log(`🖼️ [${id}] Video thumbnail still processing: ${media.processingStatus}`)
    res.status(202).json({
      success: false,
      error: 'Video thumbnail is still processing',
      processingStatus: media.processingStatus
    })
    return
  }

  try {
    let thumbnailS3Key: string | null = null

    // Get thumbnail from the thumbnails JSON array
    if (media.thumbnails) {
      const thumbnails = media.thumbnails as any[]
      if (thumbnails && thumbnails.length > 0) {
        // Use the first thumbnail (or could implement logic to pick the best one)
        thumbnailS3Key = thumbnails[0].s3Key || thumbnails[0].s3_key
        console.log(`🖼️ [${id}] Using thumbnail from JSON array: ${thumbnailS3Key}`)
      }
    }

    if (!thumbnailS3Key) {
      console.error(`🖼️ [${id}] No thumbnail found in thumbnails array`)
      res.status(404).json({
        success: false,
        error: 'No thumbnail found'
      })
      return
    }

    // Get thumbnail from S3
    const s3StartTime = Date.now()
    console.log(`🖼️ [${id}] Fetching thumbnail from S3: ${thumbnailS3Key}`)
    
    const thumbnailBuffer = await getImageFromS3(thumbnailS3Key)
    
    const s3Time = Date.now() - s3StartTime
    console.log(`🖼️ [${id}] S3 fetch completed in ${s3Time}ms, buffer size: ${thumbnailBuffer.length} bytes`)

    // Set appropriate headers
    res.setHeader('Content-Type', 'image/jpeg')
    res.setHeader('Content-Length', thumbnailBuffer.length)
    res.setHeader('Cache-Control', 'public, max-age=31536000') // Cache for 1 year

    res.end(thumbnailBuffer)
    console.log(`🖼️ [${id}] Thumbnail served successfully in ${Date.now() - startTime}ms`)

  } catch (error) {
    console.error(`🖼️ [${id}] Error serving thumbnail:`, error)
    res.status(500).json({
      success: false,
      error: 'Error serving thumbnail'
    })
  }
}))

// Serve processed video thumbnail
router.get('/:id/processed-thumbnail/:s3Key', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id, s3Key } = req.params
  const viewerId = req.user?.id

  // Check if user can view this media
  const canView = await canViewMedia(id, viewerId)
  if (!canView) {
    res.status(403).json({
      success: false,
      error: 'Access denied'
    })
    return
  }

  const media = await prisma.media.findUnique({
    where: { id },
    select: {
      id: true,
      mediaType: true,
      processingStatus: true,
      thumbnails: true
    }
  })

  if (!media) {
    res.status(404).json({
      success: false,
      error: 'Media not found'
    })
    return
  }

  if (media.mediaType !== 'VIDEO') {
    res.status(400).json({
      success: false,
      error: 'This endpoint is for video thumbnails only'
    })
    return
  }

  if (media.processingStatus !== 'COMPLETED') {
    res.status(202).json({
      success: false,
      error: 'Video is still processing',
      processingStatus: media.processingStatus
    })
    return
  }

  try {
    // Validate that the requested s3Key is actually a thumbnail for this video
    const videoThumbnails = media.thumbnails as any[]
    const isValidThumbnail = videoThumbnails && videoThumbnails.some((thumb: any) => 
      (thumb.s3_key || thumb.s3Key) === s3Key
    )

    if (!isValidThumbnail) {
      res.status(404).json({
        success: false,
        error: 'Thumbnail not found for this video'
      })
      return
    }

    // Get thumbnail from S3
    const thumbnailBuffer = await getImageFromS3(s3Key)

    // Set appropriate headers
    res.setHeader('Content-Type', 'image/jpeg')
    res.setHeader('Content-Length', thumbnailBuffer.length)
    res.setHeader('Cache-Control', 'public, max-age=31536000') // Cache for 1 year

    res.end(thumbnailBuffer)

  } catch (error) {
    console.error('Error serving processed thumbnail:', error)
    res.status(500).json({
      success: false,
      error: 'Error serving thumbnail'
    })
  }
}))

// Stream video (for future video streaming implementation)
router.get('/:id/stream', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const viewerId = req.user?.id
  console.log("STREAMING VIDEO REQUEST FOR ", id)

  // Check if user can view this media
  const canView = await canViewMedia(id, viewerId)
  if (!canView) {
    res.status(403).json({
      success: false,
      error: 'Access denied'
    })
    return
  }

  const media = await prisma.media.findUnique({
    where: { id },
    select: {
      id: true,
      videoS3Key: true,
      s3Key: true,
      mimeType: true,
      mediaType: true,
      processingStatus: true
    }
  })

  if (!media) {
    res.status(404).json({
      success: false,
      error: 'Media not found'
    })
    return
  }

  if (media.mediaType !== 'VIDEO') {
    res.status(400).json({
      success: false,
      error: 'This endpoint is for video streaming only'
    })
    return
  }

  if (media.processingStatus !== 'COMPLETED') {
    res.status(202).json({
      success: false,
      error: 'Video is still processing',
      processingStatus: media.processingStatus
    })
    return
  }

  try {
    // Use processed video if available, otherwise fall back to original
    const s3Key = media.videoS3Key || media.s3Key

    if (!s3Key) {
      res.status(404).json({
        success: false,
        error: 'Video file not found'
      })
      return
    }

    // Use the streaming function for better performance
    await streamVideoFromS3(s3Key, media.mimeType, req, res)

  } catch (error) {
    console.error('Error streaming video:', error)
    res.status(500).json({
      success: false,
      error: 'Error streaming video'
    })
  }
}))

// Serve processed video thumbnails
router.get('/:id/processed-thumbnail/:s3Key', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id, s3Key } = req.params
  const viewerId = req.user?.id

  // Check if user can view this media
  const canView = await canViewMedia(id, viewerId)
  if (!canView) {
    res.status(403).json({
      success: false,
      error: 'Access denied'
    })
    return
  }

  const media = await prisma.media.findUnique({
    where: { id },
    select: {
      id: true,
      mediaType: true,
      thumbnails: true
    }
  })

  if (!media) {
    res.status(404).json({
      success: false,
      error: 'Media not found'
    })
    return
  }

  if (media.mediaType !== 'VIDEO') {
    res.status(400).json({
      success: false,
      error: 'This endpoint is for video thumbnails only'
    })
    return
  }

  // Verify that the requested S3 key is actually a thumbnail for this video
  const thumbnails = media.thumbnails as any[]
  const thumbnailExists = thumbnails && Array.isArray(thumbnails) && 
    thumbnails.some(thumb => {
      const thumbS3Key = thumb.s3Key || thumb.s3_key
      return thumbS3Key === decodeURIComponent(s3Key)
    })

  if (!thumbnailExists) {
    res.status(404).json({
      success: false,
      error: 'Thumbnail not found'
    })
    return
  }

  try {
    // Get thumbnail from S3
    const thumbnailBuffer = await getImageFromS3(decodeURIComponent(s3Key))

    // Set appropriate headers for image serving
    res.setHeader('Content-Type', 'image/jpeg')
    res.setHeader('Content-Length', thumbnailBuffer.length)
    res.setHeader('Cache-Control', 'public, max-age=31536000')
    res.setHeader('Accept-Ranges', 'bytes')

    res.end(thumbnailBuffer)

  } catch (error) {
    console.error('Error serving processed thumbnail:', error)
    res.status(500).json({
      success: false,
      error: 'Error serving thumbnail'
    })
  }
}))

// Get available video qualities for a media item
router.get('/:id/qualities', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const viewerId = req.user?.id

  // Check if user can view this media
  const canView = await canViewMedia(id, viewerId)
  if (!canView) {
    res.status(403).json({
      success: false,
      error: 'Access denied'
    })
    return
  }

  const media = await prisma.media.findUnique({
    where: { id },
    select: {
      id: true,
      mediaType: true,
      processingStatus: true,
      versions: true,
      videoS3Key: true,
      s3Key: true,
      mimeType: true
    }
  })

  if (!media) {
    res.status(404).json({
      success: false,
      error: 'Media not found'
    })
    return
  }

  if (media.mediaType !== 'VIDEO') {
    res.status(400).json({
      success: false,
      error: 'This endpoint is for video media only'
    })
    return
  }

  if (media.processingStatus !== 'COMPLETED') {
    res.status(202).json({
      success: false,
      error: 'Video is still processing',
      processingStatus: media.processingStatus
    })
    return
  }

  try {
    const qualities: Array<{
      quality: string
      width: number
      height: number
      bitrate: string
      url: string
      fileSize: number
    }> = []

    // Add original quality if available
    if (media.videoS3Key || media.s3Key) {
      qualities.push({
        quality: 'original',
        width: 0, // Will be filled by frontend when video loads
        height: 0,
        bitrate: 'auto',
        url: `${req.protocol}://${req.get('host')}/api/media/serve/${media.id}`,
        fileSize: 0
      })
    }

    // Add processed qualities if available
    if (media.versions && Array.isArray(media.versions)) {
      for (const version of media.versions as any[]) {
        // Handle both snake_case and camelCase field names
        const s3Key = version.s3Key || version.s3_key
        const quality = version.quality
        const width = version.width
        const height = version.height
        const bitrate = version.bitrate || 'auto'
        const fileSize = version.fileSize || version.file_size || 0
        
        if (s3Key && quality && width && height) {
          qualities.push({
            quality: quality,
            width: width,
            height: height,
            bitrate: bitrate,
            url: `${req.protocol}://${req.get('host')}/api/media/serve/by_quality/${media.id}/${quality}`,
            fileSize: fileSize
          })
        }
      }
    }

    // Sort qualities by resolution (highest first)
    qualities.sort((a, b) => (b.width * b.height) - (a.width * a.height))

    res.json({
      success: true,
      qualities
    })

  } catch (error) {
    console.error('Error getting video qualities:', error)
    res.status(500).json({
      success: false,
      error: 'Error getting video qualities'
    })
  }
}))

// Get available image qualities for a media item
router.get('/:id/image-qualities', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const viewerId = req.user?.id

  // Check if user can view this media
  const canView = await canViewMedia(id, viewerId)
  if (!canView) {
    res.status(403).json({
      success: false,
      error: 'Access denied'
    })
    return
  }

  const media = await prisma.media.findUnique({
    where: { id },
    select: {
      id: true,
      mediaType: true,
      processingStatus: true,
      versions: true,
      s3Key: true,
      mimeType: true
    }
  })

  if (!media) {
    res.status(404).json({
      success: false,
      error: 'Media not found'
    })
    return
  }

  if (media.mediaType !== 'IMAGE') {
    res.status(400).json({
      success: false,
      error: 'This endpoint is for image media only'
    })
    return
  }

  // Check image processing status specifically
  const processingStatus = media.processingStatus
  if (processingStatus !== 'COMPLETED') {
    res.status(202).json({
      success: false,
      error: 'Image is still processing',
      processingStatus: processingStatus
    })
    return
  }

  try {
    const qualities: Array<{
      quality: string
      width: number
      height: number
      url: string
      fileSize: number
    }> = []

    // Add original quality if available
    if (media.s3Key) {
      qualities.push({
        quality: 'original',
        width: 0, // Will be filled by frontend when image loads
        height: 0,
        url: `${req.protocol}://${req.get('host')}/api/media/serve/${media.id}`,
        fileSize: 0
      })
    }

    // Add processed qualities if available
    let versions: any[] = []
    if (media.versions) {
      if (typeof media.versions === 'string') {
        try {
          versions = JSON.parse(media.versions)
        } catch (error) {
          console.error('Failed to parse versions JSON in qualities endpoint:', error)
        }
      } else if (Array.isArray(media.versions)) {
        versions = media.versions
      }
    }
    
    if (versions && Array.isArray(versions)) {
      for (const version of versions) {
        // Handle both snake_case and camelCase field names
        const quality = version.quality
        const width = version.width
        const height = version.height
        const fileSize = version.fileSize || version.file_size || 0
        
        if (quality && width && height) {
          qualities.push({
            quality: quality,
            width: width,
            height: height,
            url: `${req.protocol}://${req.get('host')}/api/media/serve/by_quality/${media.id}/${quality}`,
            fileSize: fileSize
          })
        }
      }
    }

    // Sort qualities by resolution (highest first)
    qualities.sort((a, b) => (b.width * b.height) - (a.width * a.height))

    res.json({
      success: true,
      qualities
    })

  } catch (error) {
    console.error('Error getting image qualities:', error)
    res.status(500).json({
      success: false,
      error: 'Error getting image qualities'
    })
  }
}))

// Serve specific image quality by name (e.g., /by_quality/1080p, /by_quality/540p)
router.get('/by_quality/:id/:quality', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id, quality } = req.params
  const viewerId = req.user?.id

  // Handle locked media placeholders
  if (id === 'locked-image' || id === 'locked-video') {
    const isVideo = id === 'locked-video'
    
    // Generate a locked placeholder image (same as main endpoint)
    const svg = `
      <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f3f4f6"/>
        <rect x="100" y="100" width="200" height="200" fill="#e5e7eb" rx="20"/>
        <rect x="150" y="120" width="100" height="60" fill="#6b7280" rx="8"/>
        <circle cx="200" cy="150" r="8" fill="#9ca3af"/>
        <rect x="190" y="160" width="20" height="10" fill="#9ca3af" rx="2"/>
        ${isVideo ? `
          <circle cx="200" cy="220" r="30" fill="#6b7280"/>
          <polygon points="190,210 190,230 210,220" fill="white"/>
        ` : `
          <rect x="170" y="200" width="60" height="40" fill="#6b7280" rx="4"/>
          <circle cx="185" cy="215" r="3" fill="#9ca3af"/>
          <circle cx="195" cy="215" r="3" fill="#9ca3af"/>
          <circle cx="205" cy="215" r="3" fill="#9ca3af"/>
          <rect x="175" y="225" width="50" height="8" fill="#9ca3af" rx="2"/>
        `}
        <text x="200" y="280" font-family="Arial, sans-serif" font-size="16" fill="#6b7280" text-anchor="middle">Locked Content</text>
      </svg>
    `
    
    const svgBuffer = Buffer.from(svg, 'utf-8')
    
    res.setHeader('Content-Type', 'image/svg+xml')
    res.setHeader('Content-Length', svgBuffer.length)
    res.setHeader('Cache-Control', 'public, max-age=31536000') // Cache for 1 year
    
    res.end(svgBuffer)
    return
  }

  // First check if media exists
  const media = await prisma.media.findUnique({
    where: { id },
    select: {
      id: true,
      mediaType: true,
      processingStatus: true,
      versions: true,
      s3Key: true, // Fallback to original
      mimeType: true,
      visibility: true,
      authorId: true
    }
  })

  if (!media) {
    res.status(404).json({
      success: false,
      error: 'Media not found'
    })
    return
  }

  // Now check if user can view this media
  const canView = await canViewMediaWithData(media, viewerId)
  if (!canView) {
    res.status(403).json({
      success: false,
      error: 'Access denied'
    })
    return
  }

  // Support both images and videos for quality selection
  if (media.mediaType !== 'IMAGE' && media.mediaType !== 'VIDEO') {
    res.status(400).json({
      success: false,
      error: 'Quality selection only supported for images and videos'
    })
    return
  }

  // Check processing status based on media type
  let processingStatus: string | null = null
  if (media.mediaType === 'IMAGE') {
    processingStatus = media.processingStatus
  } else if (media.mediaType === 'VIDEO') {
    processingStatus = media.processingStatus
  }
  
  if (processingStatus !== 'COMPLETED') {
    res.status(202).json({
      success: false,
      error: `${media.mediaType === 'VIDEO' ? 'Video' : 'Image'} is still processing`,
      processingStatus: processingStatus
    })
    return
  }

  try {
    let s3Key: string | null = null

    // If quality is 'original', use the original media
    if (quality === 'original') {
      s3Key = media.s3Key
    } else {
      // Look for the specific quality in versions based on media type
      let versions: any[] = []
      let versionsField = media.versions
      
      if (versionsField) {
        if (typeof versionsField === 'string') {
          try {
            versions = JSON.parse(versionsField)
          } catch (error) {
            console.error(`Failed to parse versions JSON:`, error)
          }
        } else if (Array.isArray(versionsField)) {
          versions = versionsField
        }
      }
      
      if (versions && Array.isArray(versions)) {
        // First try to find exact quality match
        let targetVersion = versions.find(version => version.quality === quality)
        
        if (targetVersion) {
          s3Key = targetVersion.s3Key || targetVersion.s3_key
        } else {
          // Find the best available quality (closest above requested, or highest available)
          const qualityOrder = ['180p', '360p', '540p', '720p', '1080p', 'original']
          const requestedIndex = qualityOrder.indexOf(quality)
          
          if (requestedIndex !== -1) {
            // Look for the next best quality above the requested one
            let bestVersion = null
            let bestIndex = -1
            
            for (const version of versions) {
              const versionIndex = qualityOrder.indexOf(version.quality)
              if (versionIndex !== -1 && versionIndex >= requestedIndex) {
                if (bestVersion === null || versionIndex < bestIndex) {
                  bestVersion = version
                  bestIndex = versionIndex
                }
              }
            }
            
            if (bestVersion) {
              s3Key = bestVersion.s3Key || bestVersion.s3_key
            }
          }
        }
      }
    }

    // If no specific quality found, fall back to original
    if (!s3Key) {
      s3Key = media.s3Key
    }

    if (!s3Key) {
      res.status(404).json({
        success: false,
        error: `${media.mediaType === 'VIDEO' ? 'Video' : 'Image'} not found`
      })
      return
    }

    // Stream the media based on type
    if (media.mediaType === 'VIDEO') {
      await streamVideoFromS3(s3Key, 'video/mp4', req, res)
    } else {
      await streamImageFromS3(s3Key, media.mimeType, req, res)
    }

  } catch (error) {
    console.error(`Error serving ${media.mediaType === 'VIDEO' ? 'video' : 'image'} quality:`, error)
    res.status(500).json({
      success: false,
      error: `Error serving ${media.mediaType === 'VIDEO' ? 'video' : 'image'}`
    })
  }
}))

// Serve video with specific quality by S3 key
router.get('/:id/quality/:s3Key', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id, s3Key } = req.params
  const viewerId = req.user?.id

  // Check if user can view this media
  const canView = await canViewMedia(id, viewerId)
  if (!canView) {
    res.status(403).json({
      success: false,
      error: 'Access denied'
    })
    return
  }

  const media = await prisma.media.findUnique({
    where: { id },
    select: {
      id: true,
      mediaType: true,
      processingStatus: true,
      versions: true
    }
  })

  if (!media) {
    res.status(404).json({
      success: false,
      error: 'Media not found'
    })
    return
  }

  if (media.mediaType === 'VIDEO') {
    if (media.processingStatus !== 'COMPLETED') {
      res.status(202).json({
        success: false,
        error: 'Video is still processing',
        processingStatus: media.processingStatus
      })
      return
    }

    // Verify that the requested S3 key is actually a version for this video
    const versions = media.versions as any[]
    const versionExists = versions && Array.isArray(versions) && 
      versions.some(version => {
        const versionS3Key = version.s3Key || version.s3_key
        return versionS3Key === decodeURIComponent(s3Key)
      })

    if (!versionExists) {
      res.status(404).json({
        success: false,
        error: 'Video quality not found'
      })
      return
    }

    try {
      // Stream the specific quality version
      await streamVideoFromS3(decodeURIComponent(s3Key), 'video/mp4', req, res)
    } catch (error) {
      console.error('Error streaming video quality:', error)
      res.status(500).json({
        success: false,
        error: 'Error streaming video'
      })
    }
  } else if (media.mediaType === 'IMAGE') {
    if (media.processingStatus !== 'COMPLETED') {
      res.status(202).json({
        success: false,
        error: 'Image is still processing',
        processingStatus: media.processingStatus
      })
      return
    }

    // Verify that the requested S3 key is actually a version for this image
    const versions = media.versions as any[]
    const versionExists = versions && Array.isArray(versions) && 
      versions.some(version => {
        const versionS3Key = version.s3Key || version.s3_key
        return versionS3Key === decodeURIComponent(s3Key)
      })

    if (!versionExists) {
      res.status(404).json({
        success: false,
        error: 'Image quality not found'
      })
      return
    }

    try {
      // Stream the specific quality version
      await streamImageFromS3(decodeURIComponent(s3Key), 'image/jpeg', req, res)
    } catch (error) {
      console.error('Error streaming image quality:', error)
      res.status(500).json({
        success: false,
        error: 'Error streaming image'
      })
    }
  } else {
    res.status(400).json({
      success: false,
      error: 'Unsupported media type'
    })
  }
}))

export default router 