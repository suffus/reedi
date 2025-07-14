import sharp from 'sharp'
import { v4 as uuidv4 } from 'uuid'
import { 
  processImageForS3, 
  uploadImageWithThumbnail, 
  deleteImageWithThumbnail,
  UploadResult,
  ProcessedImage
} from './s3Service'

// Generate a unique filename
const generateFilename = (originalName: string): string => {
  const ext = originalName.split('.').pop() || 'jpg'
  const baseName = originalName.replace(/\.[^/.]+$/, '')
  const uniqueId = uuidv4()
  return `${baseName}_${uniqueId}.${ext}`
}

// Process image and upload to S3
export const processImage = async (
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  userId: string
): Promise<{
  imagePath: string
  thumbnailPath: string
  width: number
  height: number
  size: number
  s3Key: string
  thumbnailS3Key?: string
}> => {
  // Process image and create thumbnail
  const processedImage: ProcessedImage = await processImageForS3(
    buffer,
    originalName,
    mimeType
  )

  // Upload to S3
  const uploadResult: UploadResult = await uploadImageWithThumbnail(
    processedImage.originalBuffer,
    processedImage.thumbnailBuffer,
    originalName,
    mimeType,
    userId
  )

  return {
    imagePath: uploadResult.key, // Store S3 key, generate URL on-demand
    thumbnailPath: uploadResult.thumbnailKey || '', // Store S3 key, generate URL on-demand
    width: processedImage.width,
    height: processedImage.height,
    size: processedImage.size,
    s3Key: uploadResult.key,
    thumbnailS3Key: uploadResult.thumbnailKey
  }
}

// Delete image files from S3
export const deleteImageFiles = async (s3Key: string, thumbnailS3Key?: string) => {
  try {
    await deleteImageWithThumbnail(s3Key, thumbnailS3Key)
  } catch (error) {
    console.error('Error deleting image files from S3:', error)
    throw error
  }
}

// Note: No need for serveImage function as S3 objects are publicly accessible
// The imagePath returned from processImage is the direct S3 URL 