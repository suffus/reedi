import { Router, Request, Response } from 'express'
import multer from 'multer'
import { prisma } from '@/db'
import { asyncHandler } from '@/middleware/errorHandler'
import { authMiddleware, optionalAuthMiddleware } from '@/middleware/auth'
import { AuthenticatedRequest } from '@/types'
import { processImage, deleteImageFiles } from '@/utils/imageProcessor'
import { generatePresignedUrl, getImageFromS3, uploadToS3 } from '@/utils/s3Service'
import { multipartUploadService } from '@/utils/multipartUploadService'
import { getAuthContext } from '@/middleware/authContext'
import { 
  canDoMediaRead, 
  canDoMediaCreate, 
  canDoMediaUpdate, 
  canDoMediaDelete,
  filterReadableMedia 
} from '@/auth/media'
import { safePermissionCheck, auditPermission } from '@/lib/permissions'


const router = Router()

// Configure multer for file uploads (support both images and videos)
const storage = multer.memoryStorage()

// Supported video formats
const SUPPORTED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm', 
  'video/quicktime', // MOV
  'video/x-msvideo',  // AVI
  'video/avi',        // Alternative AVI MIME type
  'video/mpeg',       // MPEG-1
  'video/mp2',        // MPEG-2
  'video/mp2t'        // MPEG-2 Transport Stream
]

const upload = multer({ 
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit for videos
  },
  fileFilter: (req, file, cb) => {
    // Accept images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
      return
    }
    
    // Accept only supported video formats
    if (file.mimetype.startsWith('video/')) {
      if (SUPPORTED_VIDEO_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true)
      } else {
        cb(new Error(`Unsupported video format. Supported formats: MP4, WebM, MOV, AVI, MPEG-1, MPEG-2. Received: ${file.mimetype}`))
      }
      return
    }
    
    // Accept zip files
    if (file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed') {
      cb(null, true)
      return
    }
    
    cb(new Error('Only image, video, and zip files are allowed'))
  }
})

// Configure multer for chunk uploads (no file type validation needed)
const chunkUpload = multer({
  storage,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB limit for chunks (should be enough for 5MB chunks)
  }
  // No fileFilter - chunks are just binary data
})

// Get user's media with optional filtering
router.get('/user/:userId', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const auth = getAuthContext(req)
  const { userId } = req.params
  const { 
    page = 1, 
    limit = 20, 
    tags, 
    title, 
    galleryId, 
    visibility, 
    mediaType,
    startDate,
    endDate,
    showOnlyUnorganized
  } = req.query
  const offset = (Number(page) - 1) * Number(limit)

  // Build where clause with filters
  const whereClause: any = { authorId: userId }

  // Filter by tags (comma-separated string)
  if (tags && typeof tags === 'string') {
    const tagArray = tags.split(',').map(tag => tag.trim().toLowerCase())
    whereClause.tags = {
      hasSome: tagArray
    }
  }

  // Filter by title/caption (text search)
  if (title && typeof title === 'string') {
    whereClause.OR = [
      { originalFilename: { contains: title, mode: 'insensitive' } },
      { caption: { contains: title, mode: 'insensitive' } },
      { altText: { contains: title, mode: 'insensitive' } }
    ]
  }

  // Filter by gallery
  if (galleryId && typeof galleryId === 'string') {
    whereClause.galleryId = galleryId
  }

  // Filter by visibility
  if (visibility && typeof visibility === 'string') {
    whereClause.visibility = visibility
  }

  // Filter by media type
  if (mediaType && typeof mediaType === 'string') {
    whereClause.mediaType = mediaType
  }

  // Filter by date range
  if (startDate && typeof startDate === 'string') {
    whereClause.createdAt = {
      ...whereClause.createdAt,
      gte: new Date(startDate)
    }
  }

  if (endDate && typeof endDate === 'string') {
    whereClause.createdAt = {
      ...whereClause.createdAt,
      lte: new Date(endDate)
    }
  }

  // Filter by showOnlyUnorganized - show only media not in galleries
  if (showOnlyUnorganized === 'true') {
    whereClause.galleryId = null
  }

  // Fetch all matching media (before permission filtering)
  const allMedia = await prisma.media.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      url: true,
      s3Key: true,
      originalFilename: true,
      altText: true,
      caption: true,
      tags: true,
      visibility: true,
      createdAt: true,
      updatedAt: true,
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
      thumbnails: true,
      versions: true,
      postId: true,
      galleryId: true,
      order: true,
      originalPath: true,
      zipMediaId: true,
      metadata: true
    }
  })

  // Filter media based on permissions
  const viewableMedia = await filterReadableMedia(auth, allMedia)

  // Apply pagination after filtering
  const total = viewableMedia.length
  const paginatedMedia = viewableMedia.slice(offset, offset + Number(limit))

  // Return the media (authorId is already in the media object)
  const mediaResponse = paginatedMedia

  res.json({
    success: true,
    data: {
      media: mediaResponse,
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

// Get media for a user's public page, filtered by visibility
router.get('/user/:userId/public', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params
  const viewerId = req.user?.id
  const { page = 1, limit = 20 } = req.query
  const offset = (Number(page) - 1) * Number(limit)

  // Determine which media the viewer can see
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

  const [media, total] = await Promise.all([
    prisma.media.findMany({
      where: {
        authorId: userId,
        OR: visibilityFilter
      },
      skip: offset,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        s3Key: true,
        originalFilename: true,
        altText: true,
        caption: true,
        width: true,
        height: true,
        size: true,
        mimeType: true,
        tags: true,
        mediaType: true,
        processingStatus: true,
        duration: true,
        codec: true,
        bitrate: true,
        framerate: true,
        videoUrl: true,
        videoS3Key: true,
        createdAt: true,
        updatedAt: true,
        authorId: true,
      }
    }),
    prisma.media.count({
      where: {
        authorId: userId,
        OR: visibilityFilter
      }
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

// Upload media (images and videos)
router.post('/upload', authMiddleware, upload.single('media'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  console.log('Upload request received for user:', req.user?.id)
  console.log('Form data:', req.body)
  console.log('File:', req.file ? { filename: req.file.originalname, size: req.file.size, mimetype: req.file.mimetype } : 'No file')
  
  const userId = req.user?.id
  
  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  if (!req.file) {
    res.status(400).json({
      success: false,
      error: 'No media file provided'
    })
    return
  }

  // Check permission
  const authContext = getAuthContext(req)
  const permission = await safePermissionCheck(
    () => canDoMediaCreate(authContext),
    'media-create'
  )

  if (!permission.granted) {
    await auditPermission(permission, authContext, 'MEDIA', {
      shouldAudit: true,
      auditSensitive: false,
      asyncAudit: true
    })
    res.status(403).json({
      success: false,
      error: permission.reason
    })
    return
  }

  const isVideo = req.file.mimetype.startsWith('video/')
  const isZip = req.file.mimetype === 'application/zip' || req.file.mimetype === 'application/x-zip-compressed'
  const mediaType = isVideo ? 'VIDEO' : isZip ? 'ZIP' : 'IMAGE'

  // Parse tags from form data
  let tags: string[] = []
  if (req.body.tags) {
    try {
      tags = JSON.parse(req.body.tags)
    } catch (error) {
      console.warn('Failed to parse tags:', error)
    }
  }

  let media

  if (isVideo) {
    // For videos, upload to S3 and set status to PENDING
    const s3Key = await uploadToS3(
      req.file.buffer, 
      req.file.originalname, 
      req.file.mimetype, 
      userId,
      (progress) => {
        console.log(`Video upload progress: ${progress.percentage}% (${progress.uploadedBytes}/${progress.totalBytes} bytes)`)
      }
    )
    
    media = await prisma.media.create({
      data: {
        url: s3Key, // Store S3 key for now
        s3Key: s3Key,
        originalFilename: req.file.originalname,
        altText: req.body.title || req.body.altText || 'Uploaded video',
        caption: req.body.description || req.body.caption || '',
        tags: tags,
        size: Math.ceil(req.file.size / 1024), // Convert bytes to kilobytes
        mimeType: req.file.mimetype,
        mediaType: 'VIDEO',
        processingStatus: 'PENDING',
        authorId: userId
      }
    })

    // Queue video processing job
    const videoProcessingService = req.app.locals.videoProcessingService
    if (videoProcessingService) {
      try {
        await videoProcessingService.createProcessingJob(
          media.id,
          userId,
          s3Key,
          req.file.originalname,
          req.file.mimetype,
          req.file.size,
          true, // request progress updates
          5 // progress interval
        )
        console.log(`Video processing job queued for media ${media.id}`)
      } catch (error) {
        console.error(`Failed to queue video processing job for media ${media.id}:`, error)
        // Don't fail the upload, just log the error
      }
    } else {
      console.warn('Video processing service not available, skipping video processing')
    }

  } else {
    // For images, upload to S3 and queue for processing
    const s3Key = await uploadToS3(
      req.file.buffer, 
      req.file.originalname, 
      req.file.mimetype, 
      userId,
      (progress) => {
        console.log(`Image upload progress: ${progress.percentage}% (${progress.uploadedBytes}/${progress.totalBytes} bytes)`)
      }
    )
    
    media = await prisma.media.create({
      data: {
        url: s3Key, // Store S3 key for now
        s3Key: s3Key,
        originalFilename: req.file.originalname,
        altText: req.body.title || req.body.altText || 'Uploaded image',
        caption: req.body.description || req.body.caption || '',
        tags: tags,
        size: Math.ceil(req.file.size / 1024), // Convert bytes to kilobytes
        mimeType: req.file.mimetype,
        mediaType: 'IMAGE',
        processingStatus: 'PENDING',
        authorId: userId
      }
    })

    // Queue image processing job
    const imageProcessingService = req.app.locals.imageProcessingService
    if (imageProcessingService) {
      try {
        await imageProcessingService.requestImageProcessing(
          media.id,
          userId,
          s3Key,
          req.file.originalname
        )
        console.log(`Image processing job queued for media ${media.id}`)
      } catch (error) {
        console.error(`Failed to queue image processing job for media ${media.id}:`, error)
        // Don't fail the upload, just log the error
      }
    } else {
      console.warn('Image processing service not available, skipping image processing')
    }
  }

  if (isZip) {
    console.log('Processing zip file upload')
    console.log('Request body keys:', Object.keys(req.body))
    console.log('allowedTypes value:', req.body.allowedTypes)
    console.log('allowedTypes type:', typeof req.body.allowedTypes)
    
    // For zip files, upload to S3 and queue for processing
    const s3Key = await uploadToS3(
      req.file.buffer, 
      req.file.originalname, 
      req.file.mimetype, 
      userId,
      (progress) => {
        console.log(`Zip upload progress: ${progress.percentage}% (${progress.uploadedBytes}/${progress.totalBytes} bytes)`)
      }
    )
    
    media = await prisma.media.create({
      data: {
        url: s3Key, // Store S3 key for now
        s3Key: s3Key,
        originalFilename: req.file.originalname,
        altText: req.body.title || req.body.altText || 'Uploaded zip file',
        caption: req.body.description || req.body.caption || '',
        tags: tags,
        size: Math.ceil(req.file.size / 1024), // Convert bytes to kilobytes
        mimeType: req.file.mimetype,
        mediaType: 'ZIP',
        processingStatus: 'PENDING',
        authorId: userId
      }
    })

    // Queue zip processing job
    const zipProcessingService = req.app.locals.zipProcessingService
    if (zipProcessingService) {
      try {
        await zipProcessingService.requestZipProcessing(
          media.id,
          userId,
          s3Key,
          req.file.originalname,
          req.file.mimetype,
          req.file.size,
          {
            preserveStructure: req.body.preserveStructure === 'true',
            maxFileSize: req.body.maxFileSize ? parseInt(req.body.maxFileSize) : 1073741824, // 1GB default
            allowedTypes: (() => {
              try {
                return req.body.allowedTypes ? JSON.parse(req.body.allowedTypes) : ['IMAGE', 'VIDEO']
              } catch (error) {
                console.warn('Failed to parse allowedTypes, using default:', error)
                return ['IMAGE', 'VIDEO']
              }
            })()
          }
        )
        console.log(`Zip processing job queued for media ${media.id}`)
      } catch (error) {
        console.error(`Failed to queue zip processing job for media ${media.id}:`, error)
        // Don't fail the upload, just log the error
      }
    } else {
      console.warn('Zip processing service not available, skipping zip processing')
    }
  }

  console.log('Media created successfully:', { 
    id: media.id, 
    title: media.altText, 
    authorId: media.authorId,
    mediaType: media.mediaType,
    processingStatus: media.processingStatus
  })

  res.status(201).json({
    success: true,
    data: { media },
    message: `${mediaType === 'VIDEO' ? 'Video' : 'Image'} uploaded successfully`
  })
}))

// Upload media (main route - for URLs)
router.post('/', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { url, altText, caption, postId, galleryId, mediaType = 'IMAGE' } = req.body

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  // Check permission
  const authContext = getAuthContext(req)
  const permission = await safePermissionCheck(
    () => canDoMediaCreate(authContext),
    'media-create'
  )

  if (!permission.granted) {
    await auditPermission(permission, authContext, 'MEDIA', {
      shouldAudit: true,
      auditSensitive: false,
      asyncAudit: true
    })
    res.status(403).json({
      success: false,
      error: permission.reason
    })
    return
  }

  const media = await prisma.media.create({
    data: {
      url,
      altText,
      caption,
      postId,
      galleryId,
      mediaType: mediaType as 'IMAGE' | 'VIDEO',
      processingStatus: mediaType === 'VIDEO' ? 'PENDING' : 'COMPLETED',
      authorId: userId
    }
  })

  res.status(201).json({
    success: true,
    data: { media },
    message: 'Media created successfully'
  })
}))

// Chunked upload endpoints
router.post('/upload/initiate', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  if (!userId) {
    res.status(401).json({ success: false, error: 'User not authenticated' })
    return
  }

  const { filename, contentType, fileSize, metadata } = req.body
  
  if (!filename || !contentType || !fileSize) {
    res.status(400).json({ success: false, error: 'Missing required fields: filename, contentType, fileSize' })
    return
  }

  // Check permission
  const authContext = getAuthContext(req)
  const permission = await safePermissionCheck(
    () => canDoMediaCreate(authContext),
    'media-create'
  )

  if (!permission.granted) {
    await auditPermission(permission, authContext, 'MEDIA', {
      shouldAudit: true,
      auditSensitive: false,
      asyncAudit: true
    })
    res.status(403).json({
      success: false,
      error: permission.reason
    })
    return
  }

  const timestamp = Date.now()
  const fileExtension = filename.split('.').pop() || 'bin'
  const key = `uploads/${userId}/${timestamp}.${fileExtension}`

  try {
    const uploadId = await multipartUploadService.initiateMultipartUpload(key, contentType, metadata)
    const result = {
      success: true,
      uploadId,
      key,
      chunkSize: multipartUploadService.getConfig().chunkSize || 5 * 1024 * 1024,
      maxConcurrentChunks: multipartUploadService.getConfig().maxConcurrentChunks || 5
    }
    res.json(result)
    console.log('initiateMultipartUpload response=', result)
  } catch (error) {
    console.error('Failed to initiate multipart upload:', error)
    res.status(500).json({ success: false, error: 'Failed to initiate upload' })
  }
}))

router.post('/upload/chunk', authMiddleware, chunkUpload.single('chunk'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  if (!userId) {
    res.status(401).json({ success: false, error: 'User not authenticated' })
    return
  }

  const { uploadId, key, partNumber } = req.body
  
  if (!uploadId || !key || !partNumber) {
    res.status(400).json({ success: false, error: 'Missing required fields' })
    return
  }

  // Check if we have a file in the request (binary data)
  if (!req.file) {
    res.status(400).json({ success: false, error: 'No chunk file provided' })
    return
  }

  try {
    const chunkBuffer = req.file.buffer
    
    if (!chunkBuffer) {
      res.status(400).json({ success: false, error: 'Invalid chunk data' })
      return
    }
    
    const etag = await multipartUploadService.uploadChunk(key, uploadId, partNumber, chunkBuffer)
    
    res.json({
      success: true,
      partNumber,
      etag,
      size: chunkBuffer.length
    })
  } catch (error) {
    console.error('Failed to upload chunk:', error)
    res.status(500).json({ success: false, error: 'Failed to upload chunk' })
  }
}))

router.post('/upload/complete', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  if (!userId) {
    res.status(401).json({ success: false, error: 'User not authenticated' })
    return
  }

  const { uploadId, key, parts, filename, contentType, fileSize, metadata } = req.body
  
  if (!uploadId || !key || !parts || !filename || !contentType || !fileSize) {
    res.status(400).json({ success: false, error: 'Missing required fields' })
    return
  }

  try {
    // Complete the multipart upload
    const s3Key = await multipartUploadService.completeMultipartUpload(key, uploadId, parts)
    
    // Create media record
    const isVideo = contentType.startsWith('video/')
    const isZip = contentType === 'application/zip' || contentType === 'application/x-zip-compressed'
    const mediaType = isVideo ? 'VIDEO' : isZip ? 'ZIP' : 'IMAGE'
    
    const media = await prisma.media.create({
      data: {
        url: s3Key,
        s3Key: s3Key,
        originalFilename: filename,
        altText: metadata?.title || 'Uploaded media',
        caption: metadata?.description || '',
        tags: metadata?.tags || [],
        size: Math.ceil(fileSize / 1024), // Convert bytes to kilobytes
        mimeType: contentType,
        mediaType: mediaType,
        processingStatus: 'PENDING',
        authorId: userId
      }
    })

    // Queue processing if needed
    if (isVideo) {
      const videoProcessingService = req.app.locals.videoProcessingService
      if (videoProcessingService) {
        try {
          await videoProcessingService.createProcessingJob(
            media.id,
            userId,
            s3Key,
            filename,
            contentType,
            fileSize,
            true,
            5
          )
        } catch (error) {
          console.error(`Failed to queue video processing job:`, error)
        }
      }
    } else if (isZip) {
      // Queue zip processing job
      const zipProcessingService = req.app.locals.zipProcessingService
      if (zipProcessingService) {
        try {
          // Parse options from metadata
          const options = metadata?.options ? JSON.parse(metadata.options) : {}
          await zipProcessingService.requestZipProcessing(
            media.id,
            userId,
            s3Key,
            filename,
            contentType,
            fileSize,
            {
              preserveStructure: options.preserveStructure || false,
              maxFileSize: options.maxFileSize || 1073741824, // 1GB default
              allowedTypes: options.allowedTypes || ['IMAGE', 'VIDEO']
            }
          )
          console.log(`Zip processing job queued for media ${media.id}`)
        } catch (error) {
          console.error(`Failed to queue zip processing job for media ${media.id}:`, error)
          // Don't fail the upload, just log the error
        }
      } else {
        console.warn('Zip processing service not available, skipping zip processing')
      }
    } else {
      // Queue image processing job
      const imageProcessingService = req.app.locals.imageProcessingService
      if (imageProcessingService) {
        try {
          await imageProcessingService.requestImageProcessing(
            media.id,
            userId,
            s3Key,
            filename
          )
          console.log(`Image processing job queued for media ${media.id}`)
        } catch (error) {
          console.error(`Failed to queue image processing job for media ${media.id}:`, error)
          // Don't fail the upload, just log the error
        }
      } else {
        console.warn('Image processing service not available, skipping image processing')
      }
    }

    res.json({
      success: true,
      media,
      s3Key
    })
  } catch (error) {
    console.error('Failed to complete multipart upload:', error)
    res.status(500).json({ success: false, error: 'Failed to complete upload' })
  }
}))

router.post('/upload/abort', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  if (!userId) {
    res.status(401).json({ success: false, error: 'User not authenticated' })
    return
  }

  const { uploadId, key } = req.body
  
  if (!uploadId || !key) {
    res.status(400).json({ success: false, error: 'Missing required fields' })
    return
  }

  try {
    await multipartUploadService.abortMultipartUpload(key, uploadId)
    res.json({ success: true })
  } catch (error) {
    console.error('Failed to abort multipart upload:', error)
    res.status(500).json({ success: false, error: 'Failed to abort upload' })
  }
}))

// Get media by ID
router.get('/:id', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const auth = getAuthContext(req)
  const { id } = req.params

  const media = await prisma.media.findUnique({
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

  if (!media) {
    res.status(404).json({
      success: false,
      error: 'Media not found'
    })
    return
  }

  // Check permission to read this media
  const canRead = await safePermissionCheck(
    () => canDoMediaRead(auth, media as any),
    'media-read'
  )

  // Audit non-public media access
  if (media.visibility !== 'PUBLIC') {
    await auditPermission(canRead, auth, 'MEDIA', {
      shouldAudit: true,
      auditSensitive: true,
      asyncAudit: true
    })
  }

  if (!canRead.granted) {
    res.status(403).json({
      success: false,
      error: canRead.reason
    })
    return
  }

  res.json({
    success: true,
    data: { media }
  })
}))

// Update media
router.put('/:id', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const userId = req.user?.id
  const { title, description, altText, caption, tags, visibility, mergeTags } = req.body

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  const media = await prisma.media.findUnique({
    where: { id },
    select: { 
      id: true,
      authorId: true, 
      tags: true,
      visibility: true
    }
  })

  if (!media) {
    res.status(404).json({
      success: false,
      error: 'Media not found'
    })
    return
  }

  // Check permission
  const authContext = getAuthContext(req)
  const permission = await safePermissionCheck(
    () => canDoMediaUpdate(authContext, media as any),
    'media-update'
  )

  if (!permission.granted) {
    await auditPermission(permission, authContext, 'MEDIA', {
      shouldAudit: true,
      auditSensitive: false,
      asyncAudit: true
    })
    res.status(403).json({
      success: false,
      error: permission.reason
    })
    return
  }

  await auditPermission(permission, authContext, 'MEDIA', {
    shouldAudit: true,
    auditSensitive: false,
    asyncAudit: true
  })

  // Handle tag merging logic
  let finalTags = tags
  if (tags !== undefined && mergeTags && Array.isArray(tags)) {
    const existingTags = media.tags || []
    const newTags = tags.filter(tag => tag && tag.trim().length > 0)
    finalTags = [...new Set([...existingTags, ...newTags])]
  }

  const updatedMedia = await prisma.media.update({
    where: { id },
    data: {
      altText: title || altText,
      caption: description || caption,
      tags: finalTags || undefined,
      visibility
    }
  })

  console.log('Media updated in database:', {
    id: updatedMedia.id,
    altText: updatedMedia.altText,
    caption: updatedMedia.caption,
    tags: updatedMedia.tags,
    mergeTags: mergeTags
  })

  res.json({
    success: true,
    data: { media: updatedMedia },
    message: 'Media updated successfully'
  })
}))

// Delete media
router.delete('/:id', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const userId = req.user?.id

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    })
    return
  }

  const media = await prisma.media.findUnique({
    where: { id },
    select: { 
      id: true,
      authorId: true, 
      s3Key: true, 
      videoS3Key: true,
      mediaType: true,
      visibility: true
    }
  })

  if (!media) {
    res.status(404).json({
      success: false,
      error: 'Media not found'
    })
    return
  }

  // Check permission
  const authContext = getAuthContext(req)
  const permission = await safePermissionCheck(
    () => canDoMediaDelete(authContext, media as any),
    'media-delete'
  )

  if (!permission.granted) {
    await auditPermission(permission, authContext, 'MEDIA', {
      shouldAudit: true,
      auditSensitive: false,
      asyncAudit: true
    })
    res.status(403).json({
      success: false,
      error: permission.reason
    })
    return
  }

  await auditPermission(permission, authContext, 'MEDIA', {
    shouldAudit: true,
    auditSensitive: false,
    asyncAudit: true
  })

  // Delete files from S3
  try {
    if (media.mediaType === 'VIDEO') {
      // Delete video files
      if (media.s3Key) {
        await deleteImageFiles(media.s3Key)
      }
      if (media.videoS3Key) {
        await deleteImageFiles(media.videoS3Key)
      }
    } else {
      // Delete image files
      if (media.s3Key) {
        await deleteImageFiles(media.s3Key)
      }
    }
  } catch (error) {
    console.error('Error deleting files from S3:', error)
    // Continue with deletion even if S3 deletion fails
  }

  // Delete from database
  await prisma.media.delete({
    where: { id }
  })

  res.json({
    success: true,
    message: 'Media deleted successfully'
  })
}))

// Bulk update media
router.put('/bulk/update', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { mediaIds, updates, tagMode = 'replace' } = req.body

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
      error: 'Media IDs are required'
    })
    return
  }

  // Fetch all media with full details for permission checking
  const media = await prisma.media.findMany({
    where: {
      id: { in: mediaIds }
    },
    select: { 
      id: true, 
      tags: true,
      authorId: true,
      visibility: true
    }
  })

  if (media.length !== mediaIds.length) {
    res.status(404).json({
      success: false,
      error: 'Some media not found'
    })
    return
  }

  // Check permissions for each media item
  const authContext = getAuthContext(req)
  const unauthorizedIds: string[] = []
  
  for (const item of media) {
    const permission = await safePermissionCheck(
      () => canDoMediaUpdate(authContext, item as any),
      'media-bulk-update'
    )
    
    if (!permission.granted) {
      unauthorizedIds.push(item.id)
    }
  }

  if (unauthorizedIds.length > 0) {
    res.status(403).json({
      success: false,
      error: `Not authorized to update ${unauthorizedIds.length} media item(s)`
    })
    return
  }

  // Update all media
  const updatePromises = mediaIds.map(id => {
    let updateData = { ...updates }
    
    // Handle tag merge mode
    if (tagMode === 'merge' && updates.tags && Array.isArray(updates.tags)) {
      const existingMedia = media.find(m => m.id === id)
      if (existingMedia && existingMedia.tags) {
        // Merge existing tags with new tags and remove duplicates
        const mergedTags = [...new Set([...existingMedia.tags, ...updates.tags])]
        updateData = { ...updates, tags: mergedTags }
      }
    }
    
    return prisma.media.update({
      where: { id },
      data: updateData
    })
  })

  const updatedMedia = await Promise.all(updatePromises)

  res.json({
    success: true,
    data: { media: updatedMedia },
    message: 'Media updated successfully'
  })
}))

// Search media by tags
router.get('/search/tags', asyncHandler(async (req: Request, res: Response) => {
  const { tags, page = 1, limit = 20 } = req.query
  const offset = (Number(page) - 1) * Number(limit)

  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    res.status(400).json({
      success: false,
      error: 'Tags are required'
    })
    return
  }

  const [media, total] = await Promise.all([
    prisma.media.findMany({
      where: {
        tags: {
          hasSome: tags as string[]
        },
        visibility: 'PUBLIC'
      },
      skip: offset,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        s3Key: true,
        originalFilename: true,
        altText: true,
        caption: true,
        width: true,
        height: true,
        size: true,
        mimeType: true,
        tags: true,
        mediaType: true,
        processingStatus: true,
        duration: true,
        codec: true,
        bitrate: true,
        framerate: true,
        videoUrl: true,
        videoS3Key: true,
        createdAt: true,
        updatedAt: true,
        authorId: true
      }
    }),
    prisma.media.count({
      where: {
        tags: {
          hasSome: tags as string[]
        },
        visibility: 'PUBLIC'
      }
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

// Reprocess failed media
router.post('/:mediaId/reprocess', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { mediaId } = req.params
  const userId = req.user?.id

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  // Get the media and verify ownership
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    select: {
      id: true,
      authorId: true,
      mediaType: true,
      processingStatus: true,
      s3Key: true,
      originalFilename: true,
      mimeType: true,
      size: true,
      visibility: true
    }
  })

  if (!media) {
    res.status(404).json({
      success: false,
      error: 'Media not found'
    })
    return
  }

  // Check permission (reprocess requires update permission)
  const authContext = getAuthContext(req)
  const permission = await safePermissionCheck(
    () => canDoMediaUpdate(authContext, media as any),
    'media-reprocess'
  )

  if (!permission.granted) {
    await auditPermission(permission, authContext, 'MEDIA', {
      shouldAudit: true,
      auditSensitive: false,
      asyncAudit: true
    })
    res.status(403).json({
      success: false,
      error: permission.reason
    })
    return
  }

  // Check if media is in a failed state
  const isFailed = 
    media.processingStatus === 'FAILED' ||
    media.processingStatus === 'REJECTED'

  if (!isFailed) {
    res.status(400).json({
      success: false,
      error: 'Media is not in a failed state and cannot be reprocessed'
    })
    return
  }

  try {
    // Reset processing status and related fields
    const updateData: any = {
      processingStatus: 'PENDING'
    }

    if (media.mediaType === 'VIDEO') {
      updateData.processingStatus = 'PENDING'
      updateData.duration = null
      updateData.width = null
      updateData.height = null
      updateData.codec = null
      updateData.bitrate = null
      updateData.framerate = null
      updateData.videoUrl = null
      updateData.thumbnails = null
      updateData.versions = null
    } else if (media.mediaType === 'IMAGE') {
      updateData.processingStatus = 'PENDING'
      updateData.width = null
      updateData.height = null
      updateData.versions = null
    }

    // Update the media record
    await prisma.media.update({
      where: { id: mediaId },
      data: updateData
    })

    // Re-queue for processing
    if (media.mediaType === 'VIDEO') {
      const videoProcessingService = req.app.locals.videoProcessingService
      if (videoProcessingService) {
        await videoProcessingService.createProcessingJob(
          media.id,
          userId,
          media.s3Key,
          media.originalFilename,
          media.mimeType,
          media.size,
          true, // request progress updates
          5 // progress interval
        )
        console.log(`Video reprocessing job queued for media ${media.id}`)
      } else {
        console.warn('Video processing service not available, cannot reprocess video')
        res.status(503).json({
          success: false,
          error: 'Video processing service not available'
        })
        return
      }
    } else if (media.mediaType === 'IMAGE') {
      const imageProcessingService = req.app.locals.imageProcessingService
      if (imageProcessingService) {
        await imageProcessingService.requestImageProcessing(
          media.id,
          userId,
          media.s3Key,
          media.originalFilename
        )
        console.log(`Image reprocessing job queued for media ${media.id}`)
      } else {
        console.warn('Image processing service not available, cannot reprocess image')
        res.status(503).json({
          success: false,
          error: 'Image processing service not available'
        })
        return
      }
    }

    res.json({
      success: true,
      message: `${media.mediaType === 'VIDEO' ? 'Video' : 'Image'} reprocessing started successfully`
    })

  } catch (error) {
    console.error(`Failed to reprocess media ${mediaId}:`, error)
    res.status(500).json({
      success: false,
      error: 'Failed to start reprocessing'
    })
  }
}))

export default router 