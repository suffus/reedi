#!/usr/bin/env node

import { StandaloneVideoProcessor } from './standaloneVideoProcessor'

async function main() {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    console.log('Usage: npm run standalone-cli <video-file-path>')
    console.log('Example: npm run standalone-cli ./test-video.mp4')
    process.exit(1)
  }

  const videoPath = args[0] || ''
  
  if (!require('fs').existsSync(videoPath)) {
    console.error(`Error: Video file not found: ${videoPath}`)
    process.exit(1)
  }

  console.log(`Processing video: ${videoPath}`)

  const mediaId = 'test-media-1'
  const processor = new StandaloneVideoProcessor()
  
  try {
    const result = await processor.processVideo(videoPath, mediaId)
    
    if (result.success) {
      console.log('✅ Video processing completed successfully!')
      console.log(`Processing time: ${result.processingTime}ms`)
      console.log(`Generated ${result.outputs.length} outputs:`)
      
      result.outputs.forEach((output: any, index: number) => {
        console.log(`  ${index + 1}. ${output.type} - ${output.s3Key} (${output.width}x${output.height})`)
      })
      
      if (result.metadata) {
        console.log('\nVideo metadata:')
        console.log(`  Duration: ${result.metadata.duration}s`)
        console.log(`  Resolution: ${result.metadata.resolution}`)
        console.log(`  Codec: ${result.metadata.codec}`)
        console.log(`  Bitrate: ${result.metadata.bitrate}bps`)
        console.log(`  Framerate: ${result.metadata.framerate}fps`)
      }
    } else {
      console.error('❌ Video processing failed:')
      console.error(result.error)
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  }
}

main().catch(console.error) 