import * as fs from 'fs';
import * as path from 'path';
import * as yauzl from 'yauzl';
// import { promisify } from 'util'; // Not used
import logger from '../utils/logger';

// Note: yauzl.open doesn't work well with promisify, so we'll use it directly with callbacks

export interface ZipFileInfo {
  filename: string;
  originalPath: string;
  filepath: string;
  size: number;
  isDirectory: boolean;
}

export class ZipExtractionService {
  private tempDir: string;

  constructor(tempDir: string) {
    this.tempDir = tempDir;
  }

  async extractZipFile(zipPath: string, extractPath: string): Promise<ZipFileInfo[]> {
    logger.info(`Extracting zip file: ${zipPath} to ${extractPath}`);
    
    return new Promise((resolve, reject) => {
      yauzl.open(zipPath, { lazyEntries: true }, (err: any, zipfile: any) => {
        if (err) {
          logger.error(`Failed to open zip file: ${err.message}`);
          return reject(err);
        }

        if (!zipfile) {
          return reject(new Error('Failed to open zip file'));
        }

        const files: ZipFileInfo[] = [];
        let processedEntries = 0;
        let totalEntries = 0;
        let validEntries = 0;

        zipfile.on('entry', (entry: any) => {
          totalEntries++;
          
          // Skip directories and system files
          if (entry.fileName.endsWith('/') || this.isSystemFile(entry.fileName)) {
            zipfile.readEntry();
            return;
          }

          // Check for path traversal attacks
          if (this.isPathTraversal(entry.fileName)) {
            logger.warn(`Skipping potentially malicious file: ${entry.fileName}`);
            zipfile.readEntry();
            return;
          }

          validEntries++;

          zipfile.openReadStream(entry, (err: any, readStream: any) => {
            if (err) {
              logger.error(`Failed to read entry ${entry.fileName}: ${err.message}`);
              zipfile.readEntry();
              return;
            }

            const fullPath = path.join(extractPath, entry.fileName);
            const dir = path.dirname(fullPath);

            // Ensure directory exists
            fs.mkdirSync(dir, { recursive: true });

            const writeStream = fs.createWriteStream(fullPath);
            
            readStream.pipe(writeStream);
            
            writeStream.on('close', () => {
              files.push({
                filename: path.basename(entry.fileName),
                originalPath: entry.fileName,
                filepath: fullPath,
                size: entry.uncompressedSize,
                isDirectory: false
              });
              
              processedEntries++;
              logger.info(`Extracted file ${processedEntries}/${validEntries}: ${entry.fileName}`);
              
              // Check if we've processed all valid entries
 
              zipfile.readEntry();
              
            });

            writeStream.on('error', (err) => {
              logger.error(`Failed to write file ${entry.fileName}: ${err.message}`);
              zipfile.readEntry();
            });
          });
        });

        zipfile.on('end', () => {
          zipfile.close();
          if (processedEntries !== 0) {
            resolve(files);
          } else {
            reject(new Error('No valid files found in zip file'));
          }
        });

        zipfile.on('error', (err: any) => {
          logger.error(`Zip file error: ${err.message}`);
          reject(err);
        });

        zipfile.readEntry();
      });
    });
  }

  async validateZipFile(zipPath: string): Promise<boolean> {
    try {
      const stats = await fs.promises.stat(zipPath);
      
      // Check file size (max 1GB)
      const maxSize = 1024 * 1024 * 1024; // 1GB
      if (stats.size > maxSize) {
        logger.error(`Zip file too large: ${stats.size} bytes`);
        return false;
      }

      // Check if file exists and is readable
      await fs.promises.access(zipPath, fs.constants.R_OK);
      
      return true;
    } catch (error) {
      logger.error(`Zip file validation failed: ${error}`);
      return false;
    }
  }

  async scanZipContents(zipPath: string): Promise<ZipFileInfo[]> {
    logger.info(`Scanning zip contents: ${zipPath}`);
    
    return new Promise((resolve, reject) => {
      yauzl.open(zipPath, { lazyEntries: true }, (err: any, zipfile: any) => {
        if (err) {
          logger.error(`Failed to open zip file for scanning: ${err.message}`);
          return reject(err);
        }

        if (!zipfile) {
          return reject(new Error('Failed to open zip file'));
        }

        const files: ZipFileInfo[] = [];

        zipfile.on('entry', (entry: any) => {
          // Skip directories and system files
          if (entry.fileName.endsWith('/') || this.isSystemFile(entry.fileName)) {
            zipfile.readEntry();
            return;
          }

          // Check for path traversal attacks
          if (this.isPathTraversal(entry.fileName)) {
            logger.warn(`Skipping potentially malicious file: ${entry.fileName}`);
            zipfile.readEntry();
            return;
          }

          files.push({
            filename: path.basename(entry.fileName),
            originalPath: entry.fileName,
            filepath: '', // Will be set when actually extracted
            size: entry.uncompressedSize,
            isDirectory: false
          });

          zipfile.readEntry();
        });

        zipfile.on('end', () => {
          zipfile.close();
          resolve(files);
        });

        zipfile.on('error', (err: any) => {
          logger.error(`Zip file error during scanning: ${err.message}`);
          reject(err);
        });

        zipfile.readEntry();
      });
    });
  }

  private isSystemFile(filename: string): boolean {
    const systemFiles = [
      '.DS_Store',
      'Thumbs.db',
      'desktop.ini',
      '.Spotlight-V100',
      '.Trashes',
      '._.DS_Store',
      '.fseventsd',
      '.TemporaryItems'
    ];

    const basename = path.basename(filename);
    return systemFiles.includes(basename) || basename.startsWith('.');
  }

  private isPathTraversal(filename: string): boolean {
    // Check for path traversal patterns
    const dangerousPatterns = [
      '../',
      '..\\',
      '..%2f',
      '..%5c',
      '%2e%2e%2f',
      '%2e%2e%5c'
    ];

    return dangerousPatterns.some(pattern => 
      filename.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  async createBatchTempDir(batchId: string): Promise<string> {
    const batchDir = path.join(this.tempDir, 'zip-batches', batchId);
    await fs.promises.mkdir(batchDir, { recursive: true });
    return batchDir;
  }

  async cleanupBatchFiles(batchId: string): Promise<void> {
    const batchDir = path.join(this.tempDir, 'zip-batches', batchId);
    try {
      await fs.promises.rm(batchDir, { recursive: true, force: true });
      logger.info(`Cleaned up batch files for ${batchId}`);
    } catch (error) {
      logger.error(`Failed to cleanup batch files for ${batchId}: ${error}`);
    }
  }
}
