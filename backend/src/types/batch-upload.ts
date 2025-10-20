export interface BatchUploadOptions {
  preserveStructure?: boolean;
  targetGalleryId?: string;
  maxFileSize?: number;
  allowedTypes?: ('IMAGE' | 'VIDEO' | 'DOCUMENT')[];
}

export interface ZipProcessingJob {
  batchId: string;
  userId: string;
  zipS3Key: string;
  zipFilename: string;
  options: BatchUploadOptions;
}

export interface ZipMediaResult {
  batchId: string;
  success: boolean;
  originalFilename: string;
  originalPath: string; // Path within zip
  folderPath?: string; // For future gallery creation
  
  // If successful
  media?: {
    s3Key: string;
    mediaType: 'IMAGE' | 'VIDEO';
    mimeType: string;
    fileSize: number;
    width?: number;
    height?: number;
    duration?: number;
    metadata?: any;
  };
  
  // If failed
  error?: {
    code: string;
    message: string;
  };
}

export interface ZipExtractionProgress {
  batchId: string;
  status: 'EXTRACTING' | 'EXTRACTED' | 'SCANNING';
  totalFiles: number;
  mediaFiles: number;
  skippedFiles: number;
}

export interface ZipProcessingComplete {
  batchId: string;
  totalProcessed: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{
    filename: string;
    error: string;
  }>;
}

export interface BatchUploadProgress {
  batchId: string;
  status: 'PENDING' | 'EXTRACTING' | 'PROCESSING' | 'COMPLETED' | 'PARTIAL_SUCCESS' | 'FAILED' | 'CANCELLED';
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  skippedFiles: number;
  currentFile?: string;
  errors?: Array<{
    filename: string;
    error: string;
    timestamp: string;
  }>;
}


