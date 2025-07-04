import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const UPLOADS_DIR = path.join(process.cwd(), 'uploads')
const IMAGES_DIR = path.join(UPLOADS_DIR, 'images')
const THUMBNAILS_DIR = path.join(UPLOADS_DIR, 'thumbnails')

// Ensure directories exist
const ensureDirectories = () => {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true })
  }
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true })
  }
  if (!fs.existsSync(THUMBNAILS_DIR)) {
    fs.mkdirSync(THUMBNAILS_DIR, { recursive: true })
  }
}

// Generate a unique filename
const generateFilename = (originalName: string): string => {
  const ext = path.extname(originalName)
  const baseName = path.basename(originalName, ext)
  const uniqueId = uuidv4()
  return `${baseName}_${uniqueId}${ext}`
}

// Process image and generate thumbnail
export const processImage = async (
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<{
  imagePath: string
  thumbnailPath: string
  width: number
  height: number
  size: number
}> => {
  ensureDirectories()

  const filename = generateFilename(originalName)
  const imagePath = path.join(IMAGES_DIR, filename)
  const thumbnailPath = path.join(THUMBNAILS_DIR, `thumb_${filename}`)

  // Get image metadata
  const metadata = await sharp(buffer).metadata()
  const width = metadata.width || 0
  const height = metadata.height || 0

  // Save full-size image
  await sharp(buffer)
    .jpeg({ quality: 90 })
    .toFile(imagePath)

  // Generate thumbnail (300x300, maintaining aspect ratio)
  await sharp(buffer)
    .resize(300, 300, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality: 80 })
    .toFile(thumbnailPath)

  // Get file sizes
  const imageStats = fs.statSync(imagePath)
  const thumbnailStats = fs.statSync(thumbnailPath)

  return {
    imagePath: `/uploads/images/${filename}`,
    thumbnailPath: `/uploads/thumbnails/thumb_${filename}`,
    width,
    height,
    size: imageStats.size
  }
}

// Delete image files
export const deleteImageFiles = async (imagePath: string, thumbnailPath?: string) => {
  try {
    const fullImagePath = path.join(process.cwd(), imagePath.replace(/^\//, ''))
    if (fs.existsSync(fullImagePath)) {
      fs.unlinkSync(fullImagePath)
    }

    if (thumbnailPath) {
      const fullThumbnailPath = path.join(process.cwd(), thumbnailPath.replace(/^\//, ''))
      if (fs.existsSync(fullThumbnailPath)) {
        fs.unlinkSync(fullThumbnailPath)
      }
    }
  } catch (error) {
    console.error('Error deleting image files:', error)
  }
}

// Serve static files
export const serveImage = (req: any, res: any) => {
  const filePath = req.params[0]
  const fullPath = path.join(process.cwd(), 'uploads', filePath)
  
  if (fs.existsSync(fullPath)) {
    res.sendFile(fullPath)
  } else {
    res.status(404).json({ error: 'Image not found' })
  }
} 