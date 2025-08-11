# Chunked Upload Implementation

## Overview

This document describes the implementation of chunked uploads for large media files in the Reedi application. The system automatically detects large files (>5MB) and uses multipart S3 uploads to improve reliability and support much larger files.

## Architecture

### Backend Components

#### 1. Multipart Upload Service (`backend/src/utils/multipartUploadService.ts`)
- **Purpose**: Handles S3 multipart upload operations
- **Features**:
  - Initiates multipart uploads
  - Uploads individual chunks with retry logic
  - Completes multipart uploads
  - Aborts failed uploads
  - Progress tracking

#### 2. Upload Configuration (`backend/src/config/upload.ts`)
- **Purpose**: Centralized configuration for upload settings
- **Configurable Options**:
  - Chunk size (default: 5MB)
  - Maximum concurrent chunks (default: 3)
  - Maximum retries (default: 3)
  - File size threshold for chunked uploads (default: 5MB)
  - Maximum file size (default: 5GB)

#### 3. Media Routes (`backend/src/routes/media.ts`)
- **New Endpoints**:
  - `POST /upload/initiate` - Start multipart upload
  - `POST /upload/chunk` - Upload individual chunk
  - `POST /upload/complete` - Complete multipart upload
  - `POST /upload/abort` - Abort multipart upload

### Frontend Components

#### 1. Chunked Upload Service (`frontend/lib/chunkedUploadService.ts`)
- **Purpose**: Client-side chunk management and upload orchestration
- **Features**:
  - Automatic file size detection
  - Chunk calculation and management
  - Progress tracking and reporting
  - Fallback to regular upload for small files
  - Retry logic with exponential backoff

#### 2. Enhanced Media Uploader (`frontend/components/dashboard/media-uploader.tsx`)
- **Purpose**: User interface for file uploads
- **Enhancements**:
  - Automatic chunked upload detection
  - Detailed progress display for large files
  - Chunk information display
  - File size formatting

## Configuration

### Environment Variables

```bash
# Chunked Upload Configuration
UPLOAD_CHUNK_SIZE=5242880                    # 5MB in bytes
UPLOAD_MAX_CONCURRENT_CHUNKS=3               # Max chunks uploading simultaneously
UPLOAD_MAX_RETRIES=3                         # Max retries per chunk
UPLOAD_CHUNK_SIZE_THRESHOLD=5242880          # File size threshold for chunked uploads
UPLOAD_MAX_FILE_SIZE=5368709120              # 5GB maximum file size
UPLOAD_S3_MAX_PARTS=1000                     # Maximum S3 parts (IDrive limit)
```

### Default Values

- **Chunk Size**: 5MB (5,242,880 bytes)
- **Concurrent Chunks**: 3
- **Retry Attempts**: 3
- **Threshold**: 5MB (files larger than this use chunked uploads)
- **Maximum File Size**: 5GB (1000 parts × 5MB chunks)

## How It Works

### 1. File Size Detection
```typescript
if (chunkedUploadService.shouldUseChunkedUpload(file.size)) {
  // Use chunked upload
} else {
  // Use regular upload
}
```

### 2. Chunk Calculation
```typescript
const chunks = chunkedUploadService.calculateChunks(file)
// Returns array of chunk info with start/end positions
```

### 3. Upload Process
1. **Initiate**: Create multipart upload on S3
2. **Upload Chunks**: Upload chunks in batches (3 at a time)
3. **Complete**: Finalize multipart upload
4. **Fallback**: Abort upload on failure

### 4. Progress Tracking
```typescript
onProgress: (progress) => {
  // progress.uploadedBytes
  // progress.totalBytes
  // progress.percentage
  // progress.currentChunk
  // progress.totalChunks
  // progress.status
}
```

## Benefits

### 1. Reliability
- **Resumable**: Failed uploads can be retried
- **Robust**: Network issues don't affect entire file
- **Atomic**: Either complete success or complete failure

### 2. Performance
- **Parallel**: Multiple chunks upload simultaneously
- **Efficient**: Optimized for large files
- **Scalable**: Supports files up to 5GB

### 3. User Experience
- **Progress**: Real-time upload progress
- **Transparent**: Automatic fallback for small files
- **Informative**: Detailed chunk information

## File Size Support

### Small Files (<5MB)
- Use traditional single-request upload
- No chunking overhead
- Immediate processing

### Large Files (≥5MB)
- Automatic chunked upload
- 5MB chunks
- Up to 3 concurrent chunks
- Maximum 5GB file size

## Error Handling

### Chunk Upload Failures
- Automatic retry up to 3 times
- Exponential backoff (1s, 2s, 3s delays)
- Individual chunk failures don't fail entire upload

### Upload Abortion
- Failed uploads are automatically aborted
- S3 cleanup prevents orphaned parts
- User can retry from beginning

## Security Considerations

### Authentication
- All endpoints require valid JWT token
- User can only upload to their own directory
- File paths are sanitized and validated

### File Validation
- File type restrictions
- Size limits enforced
- Path traversal prevention

## Monitoring and Logging

### Backend Logs
- Upload initiation and completion
- Chunk upload progress
- Error details and retry attempts
- S3 operation results

### Frontend Logs
- Upload method selection
- Chunk progress updates
- Error handling and retry logic

## Future Enhancements

### 1. Resume Capability
- Store upload state in database
- Allow resuming interrupted uploads
- Partial chunk recovery

### 2. Advanced Progress
- Upload speed calculation
- Time remaining estimation
- Bandwidth optimization

### 3. Batch Operations
- Multiple file chunked uploads
- Queue management
- Priority handling

## Testing

### Backend Tests
```bash
cd backend
npm run build  # Verify TypeScript compilation
```

### Frontend Tests
```bash
cd frontend
npm run build  # Verify Next.js build
```

## Deployment Notes

### Environment Setup
1. Set required environment variables
2. Ensure S3 credentials are configured
3. Verify chunk size limits match S3 provider

### Performance Tuning
- Adjust chunk size based on network conditions
- Modify concurrent chunk limits
- Configure retry strategies

### Monitoring
- Track upload success rates
- Monitor chunk upload performance
- Alert on upload failures

## Troubleshooting

### Common Issues

#### 1. Chunk Size Too Large
- Error: "Chunk size exceeds S3 maximum"
- Solution: Reduce `UPLOAD_CHUNK_SIZE`

#### 2. Too Many Concurrent Chunks
- Error: Network timeouts or failures
- Solution: Reduce `UPLOAD_MAX_CONCURRENT_CHUNKS`

#### 3. File Size Limit Exceeded
- Error: "File too large for chunked upload"
- Solution: Increase `UPLOAD_MAX_FILE_SIZE` or reduce chunk size

### Debug Mode
Enable detailed logging by setting environment variables:
```bash
DEBUG=upload:* npm run dev
```

## Conclusion

The chunked upload implementation provides a robust, scalable solution for large file uploads while maintaining backward compatibility with existing small file uploads. The system automatically adapts to file sizes and provides detailed progress information to users.

Key benefits include:
- **Reliability**: Robust upload handling with retry logic
- **Performance**: Parallel chunk uploads for large files
- **User Experience**: Detailed progress tracking and transparent operation
- **Scalability**: Support for files up to 5GB
- **Maintainability**: Centralized configuration and clean architecture 