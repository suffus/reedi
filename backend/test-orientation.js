const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

async function testOrientationCorrection() {
  console.log('Testing EXIF orientation correction...')
  
  // Test with a sample image (you would need to provide a test image)
  const testImagePath = process.argv[2]
  
  if (!testImagePath) {
    console.log('Usage: node test-orientation.js <path-to-test-image>')
    console.log('This will test EXIF orientation detection and correction')
    return
  }
  
  if (!fs.existsSync(testImagePath)) {
    console.error('Test image not found:', testImagePath)
    return
  }
  
  try {
    // Read the original image
    const originalBuffer = fs.readFileSync(testImagePath)
    
    // Get original metadata
    const originalMetadata = await sharp(originalBuffer).metadata()
    console.log('Original metadata:', {
      width: originalMetadata.width,
      height: originalMetadata.height,
      orientation: originalMetadata.orientation,
      format: originalMetadata.format
    })
    
    // Process with orientation correction (same as our upload process)
    const correctedBuffer = await sharp(originalBuffer)
      .rotate() // Automatically rotate based on EXIF orientation
      .jpeg({ 
        quality: 85,
        progressive: true,
        mozjpeg: true
      })
      .toBuffer()
    
    // Get corrected metadata
    const correctedImage = sharp(originalBuffer).rotate()
    const correctedMetadata = await correctedImage.metadata()
    
    console.log('Corrected metadata:', {
      width: correctedMetadata.width,
      height: correctedMetadata.height,
      orientation: correctedMetadata.orientation,
      format: correctedMetadata.format
    })
    
    // Save corrected image for visual verification
    const outputPath = path.join(path.dirname(testImagePath), 'corrected_' + path.basename(testImagePath))
    fs.writeFileSync(outputPath, correctedBuffer)
    console.log('Corrected image saved to:', outputPath)
    
    if (originalMetadata.orientation && originalMetadata.orientation > 1) {
      console.log('✅ EXIF orientation was detected and corrected!')
      console.log(`Original dimensions: ${originalMetadata.width}x${originalMetadata.height}`)
      console.log(`Corrected dimensions: ${correctedMetadata.width}x${correctedMetadata.height}`)
    } else {
      console.log('ℹ️  No EXIF orientation correction needed (orientation: 1 or undefined)')
    }
    
  } catch (error) {
    console.error('Error testing orientation correction:', error)
  }
}

testOrientationCorrection() 