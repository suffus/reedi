import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import sharp from 'sharp'

// S3 Client configuration for IDrive
const s3Client = new S3Client({
  region: process.env.IDRIVE_REGION || 'us-east-1',
  endpoint: process.env.IDRIVE_ENDPOINT,
  credentials: {
    accessKeyId: process.env.IDRIVE_ACCESS_KEY_ID!,
    secretAccessKey: process.env.IDRIVE_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true, // Required for S3-compatible services
})

const BUCKET_NAME = process.env.IDRIVE_BUCKET_NAME!

export interface UploadResult {
  key: string
  url: string
  thumbnailKey?: string
  thumbnailUrl?: string
  width?: number
  height?: number
  size: number
}

export interface ProcessedImage {
  originalBuffer: Buffer
  thumbnailBuffer: Buffer
  width: number
  height: number
  size: number
}

/**
 * Process image and create thumbnail
 */
export async function processImageForS3(
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<ProcessedImage> {
  // Process original image
  const originalImage = sharp(buffer)
  const originalMetadata = await originalImage.metadata()
  
  // Convert original to progressive JPEG for better loading experience
  const progressiveBuffer = await sharp(buffer)
    .jpeg({ 
      quality: 85,
      progressive: true, // Enable progressive loading
      mozjpeg: true // Use mozjpeg for better compression
    })
    .toBuffer()
  
  // Create thumbnail (max 300x300, maintain aspect ratio)
  const thumbnailBuffer = await sharp(buffer)
    .resize(300, 300, { 
      fit: 'inside',
      withoutEnlargement: true 
    })
    .jpeg({ 
      quality: 80,
      progressive: true, // Also make thumbnails progressive
      mozjpeg: true
    })
    .toBuffer()

  return {
    originalBuffer: progressiveBuffer, // Use progressive version as original
    thumbnailBuffer,
    width: originalMetadata.width || 0,
    height: originalMetadata.height || 0,
    size: progressiveBuffer.length, // Use progressive buffer size
  }
}

/**
 * Upload image to S3
 */
export async function uploadImageToS3(
  buffer: Buffer,
  key: string,
  mimeType: string,
  metadata?: Record<string, string>
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    Metadata: metadata,
    ACL: 'public-read', // Make objects publicly readable
  })

  await s3Client.send(command)
  
  // Return the S3 key (not URL) - URLs will be generated on-demand
  return key
}

/**
 * Upload image with thumbnail to S3
 */
export async function uploadImageWithThumbnail(
  originalBuffer: Buffer,
  thumbnailBuffer: Buffer,
  originalName: string,
  mimeType: string,
  userId: string
): Promise<UploadResult> {
  const timestamp = Date.now()
  const fileExtension = originalName.split('.').pop() || 'jpg'
  const baseKey = `uploads/${userId}/${timestamp}`
  
  const originalKey = `${baseKey}.${fileExtension}`
  const thumbnailKey = `${baseKey}_thumb.${fileExtension}`

  // Upload original image
  const originalUrl = await uploadImageToS3(
    originalBuffer,
    originalKey,
    mimeType,
    { originalName }
  )

  // Upload thumbnail
  const thumbnailUrl = await uploadImageToS3(
    thumbnailBuffer,
    thumbnailKey,
    'image/jpeg',
    { originalName: `${originalName}_thumb` }
  )

  return {
    key: originalKey,
    url: originalKey, // Store the S3 key, not URL
    thumbnailKey,
    thumbnailUrl: thumbnailKey, // Store the S3 key, not URL
    size: originalBuffer.length,
  }
}

/**
 * Delete image from S3
 */
export async function deleteImageFromS3(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })

  await s3Client.send(command)
}

/**
 * Delete image and thumbnail from S3
 */
export async function deleteImageWithThumbnail(
  originalKey: string,
  thumbnailKey?: string
): Promise<void> {
  await deleteImageFromS3(originalKey)
  
  if (thumbnailKey) {
    await deleteImageFromS3(thumbnailKey)
  }
}

/**
 * Generate presigned URL for private objects (if needed)
 */
export async function generatePresignedUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })

  return await getSignedUrl(s3Client, command, { expiresIn })
}

/**
 * Get image from S3 and return as buffer
 */
export async function getImageFromS3(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })

  const response = await s3Client.send(command)
  
  if (!response.Body) {
    throw new Error('No image data received from S3')
  }

  // Convert stream to buffer
  const chunks: Buffer[] = []
  for await (const chunk of response.Body as any) {
    chunks.push(Buffer.from(chunk))
  }
  
  return Buffer.concat(chunks)
}

/**
 * Get public URL for an object
 * For IDrive, we need to use presigned URLs since direct public access is not available
 */
export async function getPublicUrl(key: string): Promise<string> {
  return await generatePresignedUrl(key, 24 * 60 * 60) // 24 hours
} 