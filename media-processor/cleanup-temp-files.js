#!/usr/bin/env node

/**
 * Standalone script to clean up temporary files from the media processor
 * Run this script to clean up any orphaned temporary files
 */

const fs = require('fs')
const path = require('path')

// Configuration
const TEMP_DIR = process.env.TEMP_DIR || '/tmp'
const DRY_RUN = process.argv.includes('--dry-run')
const FORCE = process.argv.includes('--force')
const MAX_AGE_HOURS = parseInt(process.argv.find(arg => arg.startsWith('--max-age='))?.split('=')[1]) || 24

console.log(`Media Processor Temp File Cleanup`)
console.log(`================================`)
console.log(`Temp directory: ${TEMP_DIR}`)
console.log(`Max age: ${MAX_AGE_HOURS} hours`)
console.log(`Dry run: ${DRY_RUN ? 'Yes' : 'No'}`)
console.log(`Force: ${FORCE ? 'Yes' : 'No'}`)
console.log(``)

if (!fs.existsSync(TEMP_DIR)) {
  console.log(`Temp directory ${TEMP_DIR} does not exist. Nothing to clean up.`)
  process.exit(0)
}

function cleanupTempFiles() {
  const now = Date.now()
  const maxAgeMs = MAX_AGE_HOURS * 60 * 60 * 1000
  let cleanedCount = 0
  let totalSize = 0
  const filesToCleanup = []
  
  try {
    const files = fs.readdirSync(TEMP_DIR)
    
    // First pass: identify files to clean up
    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file)
      try {
        if (fs.existsSync(filePath)) {
          const stat = fs.statSync(filePath)
          if (stat.isFile()) {
            const fileAge = now - stat.mtime.getTime()
            if (fileAge > maxAgeMs || FORCE) {
              filesToCleanup.push({
                path: filePath,
                name: file,
                size: stat.size,
                age: fileAge,
                modified: stat.mtime
              })
            }
          }
        }
      } catch (error) {
        console.warn(`Error checking file ${filePath}:`, error.message)
      }
    }
    
    // Sort by modification time (oldest first)
    filesToCleanup.sort((a, b) => a.modified - b.modified)
    
    if (filesToCleanup.length === 0) {
      console.log(`No temporary files found to clean up.`)
      return
    }
    
    console.log(`Found ${filesToCleanup.length} files to clean up:`)
    console.log(``)
    
    // Display files that will be cleaned up
    for (const file of filesToCleanup) {
      const ageMinutes = Math.round(file.age / 1000 / 60)
      const sizeKB = Math.round(file.size / 1024)
      console.log(`  ${file.name} (${sizeKB} KB, ${ageMinutes} minutes old)`)
    }
    
    console.log(``)
    console.log(`Total size to free: ${Math.round(filesToCleanup.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024)} MB`)
    console.log(``)
    
    if (DRY_RUN) {
      console.log(`Dry run mode - no files will be deleted.`)
      return
    }
    
    // Ask for confirmation unless --force is used
    if (!FORCE) {
      const readline = require('readline')
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      })
      
      rl.question('Do you want to proceed with cleanup? (y/N): ', (answer) => {
        rl.close()
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
          performCleanup(filesToCleanup)
        } else {
          console.log('Cleanup cancelled.')
        }
      })
    } else {
      performCleanup(filesToCleanup)
    }
    
  } catch (error) {
    console.error(`Error during cleanup:`, error.message)
    process.exit(1)
  }
}

function performCleanup(filesToCleanup) {
  console.log(`Starting cleanup...`)
  console.log(``)
  
  let cleanedCount = 0
  let totalSize = 0
  
  for (const file of filesToCleanup) {
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path)
        cleanedCount++
        totalSize += file.size
        console.log(`✓ Cleaned up: ${file.name}`)
      }
    } catch (error) {
      console.warn(`✗ Failed to clean up ${file.name}: ${error.message}`)
    }
  }
  
  console.log(``)
  console.log(`Cleanup completed!`)
  console.log(`Files removed: ${cleanedCount}/${filesToCleanup.length}`)
  console.log(`Space freed: ${Math.round(totalSize / 1024 / 1024)} MB`)
}

// Show help if requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: node cleanup-temp-files.js [options]

Options:
  --dry-run          Show what would be cleaned up without actually deleting
  --force            Skip confirmation prompt
  --max-age=N        Only clean up files older than N hours (default: 24)
  --help, -h         Show this help message

Examples:
  node cleanup-temp-files.js                    # Clean up files older than 24 hours
  node cleanup-temp-files.js --dry-run          # Show what would be cleaned up
  node cleanup-temp-files.js --force            # Clean up without confirmation
  node cleanup-temp-files.js --max-age=6        # Clean up files older than 6 hours
  node cleanup-temp-files.js --force --max-age=0 # Clean up ALL temporary files
`)
  process.exit(0)
}

// Run cleanup
cleanupTempFiles() 