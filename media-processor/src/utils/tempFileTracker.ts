import * as fs from 'fs'
import * as path from 'path'
import { TempFileInfo, ProcessingStage } from '../types/stagedProcessing'
import logger from './logger'

export class TempFileTracker {
  private tempFiles: Map<string, TempFileInfo[]> = new Map()
  private tempDir: string

  constructor(tempDir: string = '/tmp') {
    this.tempDir = tempDir
  }

  /**
   * Track a new temp file for a specific job
   */
  trackFile(
    jobId: string, 
    filePath: string, 
    stage: ProcessingStage, 
    type: 'input' | 'output' | 'intermediate',
    description: string
  ): void {
    try {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath)
        const tempFile: TempFileInfo = {
          path: filePath,
          stage,
          createdAt: new Date(),
          size: stats.size,
          type,
          description
        }

        if (!this.tempFiles.has(jobId)) {
          this.tempFiles.set(jobId, [])
        }
        this.tempFiles.get(jobId)!.push(tempFile)

        logger.debug(`Tracked temp file for job ${jobId}: ${filePath} (${description})`)
      }
    } catch (error) {
      logger.warn(`Failed to track temp file ${filePath}:`, error)
    }
  }

  /**
   * Get all tracked temp files for a job
   */
  getJobTempFiles(jobId: string): TempFileInfo[] {
    return this.tempFiles.get(jobId) || []
  }

  /**
   * Get total size of temp files for a job
   */
  getJobTempFilesSize(jobId: string): number {
    const files = this.getJobTempFiles(jobId)
    return files.reduce((total, file) => total + file.size, 0)
  }

  /**
   * Mark a temp file as no longer needed (e.g., after successful upload)
   */
  markFileForCleanup(jobId: string, filePath: string): void {
    const files = this.tempFiles.get(jobId)
    if (files) {
      const fileIndex = files.findIndex(f => f.path === filePath)
      if (fileIndex !== -1 && files[fileIndex]) {
        files[fileIndex].type = 'intermediate' // Mark as ready for cleanup
        logger.debug(`Marked file for cleanup: ${filePath}`)
      }
    }
  }

  /**
   * Clean up all temp files for a specific job
   */
  async cleanupJobTempFiles(jobId: string): Promise<{ cleaned: number, totalSize: number }> {
    const files = this.getJobTempFiles(jobId)
    let cleaned = 0
    let totalSize = 0

    for (const file of files) {
      try {
        if (fs.existsSync(file.path)) {
          const stats = fs.statSync(file.path)
          fs.unlinkSync(file.path)
          cleaned++
          totalSize += stats.size
          logger.debug(`Cleaned up temp file: ${file.path}`)
        }
      } catch (error) {
        logger.warn(`Failed to clean up temp file ${file.path}:`, error)
      }
    }

    // Remove the job from tracking
    this.tempFiles.delete(jobId)

    logger.info(`Cleaned up ${cleaned} temp files for job ${jobId}, freed ${Math.round(totalSize / 1024 / 1024)} MB`)
    return { cleaned, totalSize }
  }

  /**
   * Clean up all temp files for all jobs
   */
  async cleanupAllTempFiles(): Promise<{ cleaned: number, totalSize: number }> {
    let totalCleaned = 0
    let totalSize = 0

    for (const [jobId] of this.tempFiles) {
      const result = await this.cleanupJobTempFiles(jobId)
      totalCleaned += result.cleaned
      totalSize += result.totalSize
    }

    logger.info(`Cleaned up all temp files: ${totalCleaned} files, ${Math.round(totalSize / 1024 / 1024)} MB`)
    return { cleaned: totalCleaned, totalSize }
  }

  /**
   * Get summary of all tracked temp files
   */
  getSummary(): { totalJobs: number; totalFiles: number; totalSize: number } {
    let totalFiles = 0
    let totalSize = 0

    for (const files of this.tempFiles.values()) {
      totalFiles += files.length
      totalSize += files.reduce((sum, file) => sum + file.size, 0)
    }

    return {
      totalJobs: this.tempFiles.size,
      totalFiles,
      totalSize
    }
  }

  /**
   * Find orphaned temp files that aren't being tracked
   */
  findOrphanedFiles(): string[] {
    const orphaned: string[] = []
    
    try {
      if (!fs.existsSync(this.tempDir)) {
        return orphaned
      }

      const files = fs.readdirSync(this.tempDir)
      const trackedPaths = new Set<string>()
      
      // Get all tracked file paths
      for (const files of this.tempFiles.values()) {
        for (const file of files) {
          trackedPaths.add(file.path)
        }
      }

      // Check for orphaned files
      for (const file of files) {
        const filePath = path.join(this.tempDir, file)
        try {
          if (fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath)
            if (stat.isFile() && !trackedPaths.has(filePath)) {
              orphaned.push(filePath)
            }
          }
        } catch (error) {
          logger.warn(`Error checking file ${filePath}:`, error)
        }
      }
    } catch (error) {
      logger.warn(`Error finding orphaned files:`, error)
    }

    return orphaned
  }

  /**
   * Clean up orphaned temp files
   */
  async cleanupOrphanedFiles(): Promise<{ cleaned: number, totalSize: number }> {
    const orphaned = this.findOrphanedFiles()
    let cleaned = 0
    let totalSize = 0

    for (const filePath of orphaned) {
      try {
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath)
          fs.unlinkSync(filePath)
          cleaned++
          totalSize += stats.size
          logger.debug(`Cleaned up orphaned file: ${filePath}`)
        }
      } catch (error) {
        logger.warn(`Failed to clean up orphaned file ${filePath}:`, error)
      }
    }

    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} orphaned files, freed ${Math.round(totalSize / 1024 / 1024)} MB`)
    }

    return { cleaned, totalSize }
  }
}
