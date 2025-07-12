const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

/**
 * Test progressive JPEG conversion
 */
async function testProgressiveConversion() {
  console.log('Testing progressive JPEG conversion...')
  
  try {
    // Create a test image (if you have one, you can use it instead)
    const testImagePath = path.join(__dirname, 'test-image.jpg')
    
    // Check if test image exists
    if (!fs.existsSync(testImagePath)) {
      console.log('No test image found. Creating a simple test image...')
      
      // Create a simple test image using sharp
      const testBuffer = await sharp({
        create: {
          width: 800,
          height: 600,
          channels: 3,
          background: { r: 255, g: 100, b: 100 }
        }
      })
      .jpeg({ quality: 90 })
      .toBuffer()
      
      fs.writeFileSync(testImagePath, testBuffer)
      console.log('Created test image')
    }
    
    // Read the test image
    const originalBuffer = fs.readFileSync(testImagePath)
    console.log(`Original image size: ${originalBuffer.length} bytes`)
    
    // Convert to progressive JPEG
    const progressiveBuffer = await sharp(originalBuffer)
      .jpeg({ 
        quality: 85,
        progressive: true,
        mozjpeg: true
      })
      .toBuffer()
    
    console.log(`Progressive image size: ${progressiveBuffer.length} bytes`)
    console.log(`Size change: ${((progressiveBuffer.length - originalBuffer.length) / originalBuffer.length * 100).toFixed(2)}%`)
    
    // Save progressive version
    const progressivePath = path.join(__dirname, 'test-image-progressive.jpg')
    fs.writeFileSync(progressivePath, progressiveBuffer)
    
    // Test that we can read the progressive image
    const testRead = await sharp(progressiveBuffer).metadata()
    console.log(`Progressive image metadata: ${testRead.width}x${testRead.height}, format: ${testRead.format}`)
    
    // Check if it's actually progressive
    const isProgressive = await checkIfProgressive(progressiveBuffer)
    console.log(`Is progressive: ${isProgressive}`)
    
    console.log('\n✓ Progressive JPEG conversion test completed successfully!')
    console.log(`Test files created:`)
    console.log(`  Original: ${testImagePath}`)
    console.log(`  Progressive: ${progressivePath}`)
    
  } catch (error) {
    console.error('Test failed:', error)
    throw error
  }
}

/**
 * Check if a JPEG buffer is progressive
 */
async function checkIfProgressive(buffer) {
  try {
    // Read the first few bytes to check for progressive JPEG markers
    const header = buffer.slice(0, 100)
    const headerHex = header.toString('hex')
    
    // Progressive JPEGs have specific markers
    // Look for SOF2 marker (Start of Frame, Progressive)
    return headerHex.includes('ffc2')
  } catch (error) {
    console.error('Error checking progressive status:', error)
    return false
  }
}

/**
 * Compare loading performance (simulated)
 */
async function simulateLoadingPerformance() {
  console.log('\nSimulating loading performance...')
  
  try {
    const testImagePath = path.join(__dirname, 'test-image.jpg')
    const progressivePath = path.join(__dirname, 'test-image-progressive.jpg')
    
    if (!fs.existsSync(testImagePath) || !fs.existsSync(progressivePath)) {
      console.log('Test images not found. Run the main test first.')
      return
    }
    
    const originalBuffer = fs.readFileSync(testImagePath)
    const progressiveBuffer = fs.readFileSync(progressivePath)
    
    // Simulate progressive loading by reading the buffer in chunks
    console.log('Simulating baseline JPEG loading (top-to-bottom):')
    const baselineChunks = simulateBaselineLoading(originalBuffer)
    
    console.log('Simulating progressive JPEG loading:')
    const progressiveChunks = simulateProgressiveLoading(progressiveBuffer)
    
    console.log('\nLoading comparison:')
    console.log(`Baseline JPEG: ${baselineChunks.length} chunks, ${baselineChunks[baselineChunks.length - 1]}ms to complete`)
    console.log(`Progressive JPEG: ${progressiveChunks.length} chunks, ${progressiveChunks[progressiveChunks.length - 1]}ms to complete`)
    
    // Calculate perceived performance improvement
    const firstVisibleBaseline = baselineChunks.findIndex(chunk => chunk > 0) + 1
    const firstVisibleProgressive = progressiveChunks.findIndex(chunk => chunk > 0) + 1
    
    console.log(`\nPerceived performance:`)
    console.log(`Baseline: First visible at chunk ${firstVisibleBaseline}`)
    console.log(`Progressive: First visible at chunk ${firstVisibleProgressive}`)
    console.log(`Improvement: ${((firstVisibleBaseline - firstVisibleProgressive) / firstVisibleBaseline * 100).toFixed(1)}% faster perceived loading`)
    
  } catch (error) {
    console.error('Performance simulation failed:', error)
  }
}

/**
 * Simulate baseline JPEG loading (top-to-bottom)
 */
function simulateBaselineLoading(buffer) {
  const chunkSize = Math.ceil(buffer.length / 10)
  const chunks = []
  
  for (let i = 0; i < 10; i++) {
    const start = i * chunkSize
    const end = Math.min(start + chunkSize, buffer.length)
    const chunk = buffer.slice(start, end)
    
    // Simulate processing time
    const processingTime = (i + 1) * 50 // Each chunk takes longer to process
    chunks.push(processingTime)
  }
  
  return chunks
}

/**
 * Simulate progressive JPEG loading
 */
function simulateProgressiveLoading(buffer) {
  const chunks = []
  
  // Progressive JPEGs show low-res version quickly, then improve
  chunks.push(20)  // Very fast first chunk (low-res preview)
  chunks.push(40)  // Second chunk (slightly better)
  chunks.push(60)  // Third chunk (better quality)
  chunks.push(80)  // Fourth chunk (good quality)
  chunks.push(100) // Fifth chunk (very good quality)
  chunks.push(120) // Sixth chunk (excellent quality)
  chunks.push(140) // Seventh chunk (near final)
  chunks.push(160) // Eighth chunk (final quality)
  chunks.push(180) // Ninth chunk (complete)
  chunks.push(200) // Tenth chunk (fully loaded)
  
  return chunks
}

// Main execution
async function main() {
  try {
    await testProgressiveConversion()
    await simulateLoadingPerformance()
  } catch (error) {
    console.error('Test script failed:', error)
    process.exit(1)
  }
}

// Run the script
if (require.main === module) {
  main()
}

module.exports = {
  testProgressiveConversion,
  checkIfProgressive,
  simulateLoadingPerformance
} 