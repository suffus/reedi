import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { fileTypeFromFile } from 'file-type';
import logger from '../utils/logger';

const stat = promisify(fs.stat);

export interface MediaFileInfo {
  filepath: string;
  filename: string;
  originalPath: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  mimeType: string;
  fileSize: number;
  isValid: boolean;
  error?: string;
}

export class FileValidationService {
  private maxFileSize: number;
  private allowedImageTypes: string[];
  private allowedVideoTypes: string[];
  private allowedDocumentTypes: string[];

  constructor(
    maxFileSize: number = 1024 * 1024 * 1024, // 1GB default
    allowedImageTypes: string[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff'],
    allowedVideoTypes: string[] = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/webm', 'video/mkv'],
    allowedDocumentTypes: string[] = ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  ) {
    this.maxFileSize = maxFileSize;
    this.allowedImageTypes = allowedImageTypes;
    this.allowedVideoTypes = allowedVideoTypes;
    this.allowedDocumentTypes = allowedDocumentTypes;
  }

  async validateMediaFile(filepath: string, originalPath: string): Promise<MediaFileInfo> {
    const filename = path.basename(filepath);
    
    try {
      // Check if file exists
      const stats = await stat(filepath);
      
      // Check file size
      if (stats.size > this.maxFileSize) {
        return {
          filepath,
          filename,
          originalPath,
          mediaType: 'IMAGE', // Default, will be corrected
          mimeType: 'unknown',
          fileSize: stats.size,
          isValid: false,
          error: `File too large: ${stats.size} bytes (max: ${this.maxFileSize})`
        };
      }

      // Get MIME type
      const fileType = await fileTypeFromFile(filepath);
      const mimeType = fileType?.mime || 'unknown';

      // Determine media type and validate
      const mediaType = this.getMediaType(mimeType);
      const isValid = this.isValidMimeType(mimeType, mediaType);

      if (!isValid) {
        return {
          filepath,
          filename,
          originalPath,
          mediaType,
          mimeType,
          fileSize: stats.size,
          isValid: false,
          error: `Unsupported file type: ${mimeType}`
        };
      }

      return {
        filepath,
        filename,
        originalPath,
        mediaType,
        mimeType,
        fileSize: stats.size,
        isValid: true
      };

    } catch (error) {
      logger.error(`Error validating file ${filepath}: ${error}`);
      return {
        filepath,
        filename,
        originalPath,
        mediaType: 'IMAGE', // Default
        mimeType: 'unknown',
        fileSize: 0,
        isValid: false,
        error: `File validation error: ${error}`
      };
    }
  }

  async validateMultipleFiles(files: Array<{ filepath: string; originalPath: string }>): Promise<MediaFileInfo[]> {
    const results: MediaFileInfo[] = [];
    
    for (const file of files) {
      const result = await this.validateMediaFile(file.filepath, file.originalPath);
      results.push(result);
    }

    return results;
  }

  private getMediaType(mimeType: string): 'IMAGE' | 'VIDEO' | 'DOCUMENT' {
    if (this.allowedImageTypes.includes(mimeType)) {
      return 'IMAGE';
    } else if (this.allowedVideoTypes.includes(mimeType)) {
      return 'VIDEO';
    } else if (this.allowedDocumentTypes.includes(mimeType)) {
      return 'DOCUMENT';
    } else {
      return 'IMAGE'; // Default fallback
    }
  }

  private isValidMimeType(mimeType: string, mediaType: 'IMAGE' | 'VIDEO' | 'DOCUMENT'): boolean {
    switch (mediaType) {
      case 'IMAGE':
        return this.allowedImageTypes.includes(mimeType);
      case 'VIDEO':
        return this.allowedVideoTypes.includes(mimeType);
      case 'DOCUMENT':
        return this.allowedDocumentTypes.includes(mimeType);
      default:
        return false;
    }
  }

  isImageFile(filepath: string): boolean {
    const ext = path.extname(filepath).toLowerCase();
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif'];
    return imageExts.includes(ext);
  }

  isVideoFile(filepath: string): boolean {
    const ext = path.extname(filepath).toLowerCase();
    const videoExts = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv'];
    return videoExts.includes(ext);
  }

  isDocumentFile(filepath: string): boolean {
    const ext = path.extname(filepath).toLowerCase();
    const docExts = ['.pdf', '.txt', '.doc', '.docx'];
    return docExts.includes(ext);
  }
}
