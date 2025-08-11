import { config } from 'dotenv'

config()

export const uploadConfig = {
  // Chunk size in bytes (5MB default)
  chunkSize: parseInt(process.env.UPLOAD_CHUNK_SIZE || '5242880'),
  
  // Maximum number of chunks to upload concurrently
  maxConcurrentChunks: parseInt(process.env.UPLOAD_MAX_CONCURRENT_CHUNKS || '3'),
  
  // Maximum number of retries for failed chunk uploads
  maxRetries: parseInt(process.env.UPLOAD_MAX_RETRIES || '3'),
  
  // File size threshold above which chunked upload is used (5MB default)
  chunkSizeThreshold: parseInt(process.env.UPLOAD_CHUNK_SIZE_THRESHOLD || '5242880'),
  
  // Maximum file size allowed (5GB default - 1000 parts * 5MB chunks)
  maxFileSize: parseInt(process.env.UPLOAD_CHUNK_SIZE_THRESHOLD || '5368709120'),
  
  // Allowed file types
  allowedTypes: {
    images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    videos: ['video/mp4', 'video/webm', 'video/mov', 'video/avi', 'video/mkv'],
    documents: ['application/pdf', 'text/plain', 'application/msword']
  },
  
  // S3 multipart upload settings
  s3: {
    // Maximum number of parts allowed by S3 (IDrive supports up to 1000)
    maxParts: parseInt(process.env.UPLOAD_S3_MAX_PARTS || '1000'),
    
    // Minimum part size (5MB for S3)
    minPartSize: parseInt(process.env.UPLOAD_S3_MIN_PART_SIZE || '5242880'),
    
    // Maximum part size (5GB for S3)
    maxPartSize: parseInt(process.env.UPLOAD_S3_MAX_PART_SIZE || '5368709120')
  }
}

// Validation
if (uploadConfig.chunkSize < uploadConfig.s3.minPartSize) {
  throw new Error(`Chunk size (${uploadConfig.chunkSize}) must be at least ${uploadConfig.s3.minPartSize} bytes`)
}

if (uploadConfig.chunkSize > uploadConfig.s3.maxPartSize) {
  throw new Error(`Chunk size (${uploadConfig.chunkSize}) cannot exceed ${uploadConfig.s3.maxPartSize} bytes`)
}

const maxFileSizeWithChunks = uploadConfig.chunkSize * uploadConfig.s3.maxParts
if (uploadConfig.maxFileSize > maxFileSizeWithChunks) {
  console.warn(`Max file size (${uploadConfig.maxFileSize}) exceeds theoretical limit with current chunk size: ${maxFileSizeWithChunks}`)
} 