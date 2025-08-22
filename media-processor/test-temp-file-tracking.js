#!/usr/bin/env node

/**
 * Test script for the new temp file tracking system
 * This demonstrates how temp files are tracked through the processing pipeline
 */

const { TempFileTracker } = require('./dist/utils/tempFileTracker')
const path = require('path')
const fs = require('fs')

async function testTempFileTracking() {
  console.log('🧪 Testing Temp File Tracking System')
  console.log('=====================================\n')

  // Create a temp file tracker
  const tracker = new TempFileTracker('/tmp/test-temp-tracking')
  
  // Simulate a job processing pipeline
  const jobId = 'test-job-123'
  
  console.log(`📁 Created tracker for job: ${jobId}`)
  
  // Simulate download stage
  const downloadPath = path.join('/tmp/test-temp-tracking', 'downloaded_video.mp4')
  fs.writeFileSync(downloadPath, 'fake video content')
  tracker.trackFile(jobId, downloadPath, 'DOWNLOADED', 'input', 'Original video downloaded from S3')
  console.log(`⬇️  Tracked downloaded file: ${downloadPath}`)
  
  // Simulate processing stage - generate thumbnails
  const thumbnail1Path = path.join('/tmp/test-temp-tracking', 'thumb_1.jpg')
  const thumbnail2Path = path.join('/tmp/test-temp-tracking', 'thumb_2.jpg')
  fs.writeFileSync(thumbnail1Path, 'fake thumbnail 1')
  fs.writeFileSync(thumbnail2Path, 'fake thumbnail 2')
  
  tracker.trackFile(jobId, thumbnail1Path, 'PROCESSED', 'output', 'Generated thumbnail 1')
  tracker.trackFile(jobId, thumbnail2Path, 'PROCESSED', 'output', 'Generated thumbnail 2')
  console.log(`🖼️  Tracked generated thumbnails`)
  
  // Simulate quality versions
  const quality360Path = path.join('/tmp/test-temp-tracking', 'quality_360p.mp4')
  const quality720Path = path.join('/tmp/test-temp-tracking', 'quality_720p.mp4')
  fs.writeFileSync(quality360Path, 'fake 360p video')
  fs.writeFileSync(quality720Path, 'fake 720p video')
  
  tracker.trackFile(jobId, quality360Path, 'PROCESSED', 'output', 'Generated 360p quality version')
  tracker.trackFile(jobId, quality720Path, 'PROCESSED', 'output', 'Generated 720p quality version')
  console.log(`🎥  Tracked quality versions`)
  
  // Show current stats
  console.log('\n📊 Current Temp File Statistics:')
  console.log('================================')
  const stats = tracker.getJobTempFiles(jobId)
  console.log(`Total files tracked: ${stats.length}`)
  console.log(`Total size: ${Math.round(tracker.getJobTempFilesSize(jobId) / 1024)} KB`)
  
  stats.forEach((file, index) => {
    console.log(`  ${index + 1}. ${path.basename(file.path)} (${file.type}) - ${file.description}`)
  })
  
  // Simulate upload stage - mark files for cleanup
  console.log('\n📤 Simulating upload stage...')
  tracker.markFileForCleanup(jobId, thumbnail1Path)
  tracker.markFileForCleanup(jobId, quality360Path)
  console.log('✅ Marked some files for cleanup')
  
  // Show updated stats
  console.log('\n📊 Updated Statistics:')
  console.log('======================')
  const updatedStats = tracker.getJobTempFiles(jobId)
  updatedStats.forEach((file, index) => {
    console.log(`  ${index + 1}. ${path.basename(file.path)} (${file.type}) - ${file.description}`)
  })
  
  // Simulate cleanup stage
  console.log('\n🧹 Running cleanup stage...')
  const cleanupResult = await tracker.cleanupJobTempFiles(jobId)
  console.log(`✅ Cleanup completed: ${cleanupResult.cleaned} files cleaned, ${Math.round(cleanupResult.totalSize / 1024)} KB freed`)
  
  // Show final stats
  console.log('\n📊 Final Statistics:')
  console.log('====================')
  const finalStats = tracker.getSummary()
  console.log(`Total jobs: ${finalStats.totalJobs}`)
  console.log(`Total files: ${finalStats.totalFiles}`)
  console.log(`Total size: ${Math.round(finalStats.totalSize / 1024)} KB`)
  
  // Clean up test directory
  try {
    fs.rmdirSync('/tmp/test-temp-tracking', { recursive: true })
    console.log('\n🗑️  Cleaned up test directory')
  } catch (error) {
    console.log('\n⚠️  Could not clean up test directory:', error.message)
  }
  
  console.log('\n🎉 Temp file tracking test completed successfully!')
}

// Run the test
testTempFileTracking().catch(console.error)
