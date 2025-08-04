const fetch = require('node-fetch')

async function testGalleryMediaEndpoint() {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001'
  const galleryId = process.argv[2]
  
  if (!galleryId) {
    console.log('Usage: node test-gallery-media.js <gallery-id>')
    console.log('This will test the new gallery media endpoint')
    return
  }
  
  try {
    console.log(`Testing gallery media endpoint for gallery: ${galleryId}`)
    
    const response = await fetch(`${baseUrl}/galleries/${galleryId}/media?page=1&limit=10`, {
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    const data = await response.json()
    
    if (response.ok) {
      console.log('✅ Gallery media endpoint working!')
      console.log(`Found ${data.data.media.length} media items`)
      console.log(`Total: ${data.data.pagination.total} items`)
      
      if (data.data.media.length > 0) {
        console.log('Sample media items:')
        data.data.media.slice(0, 3).forEach((media, index) => {
          console.log(`  ${index + 1}. ${media.originalFilename || media.id} (${media.mediaType})`)
        })
      }
    } else {
      console.log('❌ Gallery media endpoint failed:')
      console.log(`Status: ${response.status}`)
      console.log('Error:', data.error || 'Unknown error')
    }
    
  } catch (error) {
    console.error('❌ Error testing gallery media endpoint:', error.message)
  }
}

testGalleryMediaEndpoint() 