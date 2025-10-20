/**
 * Utility functions for downloading media files
 */

/**
 * Download a file from a URL with a custom filename
 * @param url - The URL to download from
 * @param filename - The filename to save as
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  try {
    // Fetch the file as a blob to ensure proper download
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const blob = await response.blob()
    
    // Create a temporary anchor element
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    
    // Append to DOM, click, and remove
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // Clean up the object URL
    URL.revokeObjectURL(link.href)
  } catch (error) {
    console.error('Failed to download file:', error)
    throw new Error('Download failed')
  }
}

/**
 * Download a file from a blob with a custom filename
 * @param blob - The blob to download
 * @param filename - The filename to save as
 */
export function downloadBlob(blob: Blob, filename: string): void {
  try {
    // Create a temporary anchor element
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    
    // Append to DOM, click, and remove
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // Clean up the object URL
    URL.revokeObjectURL(link.href)
  } catch (error) {
    console.error('Failed to download blob:', error)
    throw new Error('Download failed')
  }
}

/**
 * Downloads media with proper filename handling
 * @param mediaUrl - The URL of the media to download
 * @param mediaName - The name/alt text of the media
 * @param mediaType - The type of media (IMAGE/VIDEO)
 * @returns Promise that resolves when download starts
 */
export async function downloadMedia(
  mediaUrl: string, 
  mediaName: string, 
  mediaType: 'IMAGE' | 'VIDEO' | 'ZIP' = 'IMAGE'
): Promise<void> {
  // Extract file extension from URL
  const urlParts = mediaUrl.split('.')
  const extension = urlParts[urlParts.length - 1]?.split('?')[0] || 
    (mediaType === 'VIDEO' ? 'mp4' : mediaType === 'ZIP' ? 'zip' : 'jpg')
  
  // Create a safe filename
  const safeName = mediaName
    .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .substring(0, 50) // Limit length
  
  const filename = `${safeName}.${extension}`
  
  // Use the blob-based download approach for consistency
  try {
    const response = await fetch(mediaUrl)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const blob = await response.blob()
    
    // Create a temporary anchor element
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    
    // Append to DOM, click, and remove
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // Clean up the object URL
    URL.revokeObjectURL(link.href)
  } catch (error) {
    console.error('Failed to download media:', error)
    throw new Error('Download failed')
  }
}

/**
 * Generate a filename for media download
 * @param originalName - The original filename
 * @param mediaType - The type of media (IMAGE or VIDEO)
 * @param extension - The file extension (e.g., '.jpg', '.mp4')
 */
export function generateDownloadFilename(
  originalName: string | null, 
  mediaType: 'IMAGE' | 'VIDEO', 
  extension: string
): string {
  if (originalName) {
    // If original name exists, use it but ensure it has the right extension
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '')
    return `${nameWithoutExt}${extension}`
  }
  
  // Generate a timestamp-based filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
  const type = mediaType.toLowerCase()
  return `${type}-${timestamp}${extension}`
}

/**
 * Get the appropriate file extension for a media type and MIME type
 * @param mediaType - The type of media (IMAGE or VIDEO)
 * @param mimeType - The MIME type of the media
 */
export function getFileExtension(mediaType: 'IMAGE' | 'VIDEO', mimeType: string | null): string {
  if (mimeType) {
    // Try to extract extension from MIME type
    const extension = mimeType.split('/')[1]
    if (extension) {
      return `.${extension}`
    }
  }
  
  // Fallback to common extensions
  switch (mediaType) {
    case 'IMAGE':
      return '.jpg'
    case 'VIDEO':
      return '.mp4'
    default:
      return '.bin'
  }
} 