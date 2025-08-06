/**
 * Downloads a file in the background without replacing the interface
 * @param url - The URL of the file to download
 * @param filename - The filename to save as
 * @returns Promise that resolves when download starts
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  try {
    // Fetch the file
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    // Get the blob
    const blob = await response.blob()
    
    // Create a blob URL
    const blobUrl = window.URL.createObjectURL(blob)
    
    // Create a temporary link element
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = filename
    
    // Append to body, click, and remove
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // Clean up the blob URL
    window.URL.revokeObjectURL(blobUrl)
  } catch (error) {
    console.error('Download failed:', error)
    throw error
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
  mediaType: 'IMAGE' | 'VIDEO' = 'IMAGE'
): Promise<void> {
  // Extract file extension from URL
  const urlParts = mediaUrl.split('.')
  const extension = urlParts[urlParts.length - 1]?.split('?')[0] || (mediaType === 'VIDEO' ? 'mp4' : 'jpg')
  
  // Create a safe filename
  const safeName = mediaName
    .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .substring(0, 50) // Limit length
  
  const filename = `${safeName}.${extension}`
  
  return downloadFile(mediaUrl, filename)
} 