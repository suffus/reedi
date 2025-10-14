# Zip File Upload Implementation Plan

## Overview
Enable users to upload zip files containing multiple media items, which will be automatically extracted, processed, and added to their media gallery. The system should validate media files, track progress, and provide robust error handling.

## Recent Updates (Based on Feedback)

**Simplified Scope:**
- ❌ **Removed**: Gallery creation from folder structure (deferred to future)
- ❌ **Removed**: WebSocket notifications (deferred to notification system)
- ❌ **Removed**: Malicious content detection (deferred to future security enhancement)
- ❌ **Removed**: Folder structure parsing service (not needed)
- ✅ **Added**: System file filtering (.DS_Store, Thumbs.db, etc.)
- ✅ **Added**: Direct internal processing in media processor (not self-publishing to queues)
- ✅ **Added**: `originalPath` field to preserve folder information for future use

---

## Architecture Flow

```
User (Frontend)
    ↓ Upload zip file
Backend API
    ↓ Create batch record, store zip
    ↓ Publish to RabbitMQ
Media Processor
    ↓ Extract & validate files
    ↓ Process each media item
    ↓ Publish results to RabbitMQ
Backend Consumer
    ↓ Create Media records
    ↓ Update batch progress
    ↓ Notify via WebSocket
Frontend
    ↓ Display progress & results
```

---

## Database Schema Changes

### 1. New `BatchUpload` Model

```prisma
model BatchUpload {
  id              String            @id @default(cuid())
  userId          String
  user            User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Upload details
  filename        String            // Original zip filename
  fileSize        Int               // Zip file size in bytes
  s3Key           String?           // S3 key if we store the zip
  
  // Processing status
  status          BatchUploadStatus @default(PENDING)
  totalFiles      Int               @default(0)     // Total media files found
  processedFiles  Int               @default(0)     // Successfully processed
  failedFiles     Int               @default(0)     // Failed to process
  skippedFiles    Int               @default(0)     // Non-media files skipped
  
  // Results
  mediaItems      Media[]           @relation("BatchUploadMedia")
  
  // Error tracking
  errors          Json?             // Array of error objects { filename, error, timestamp }
  
  // Metadata
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  startedAt       DateTime?         // When processing started
  completedAt     DateTime?         // When processing finished
  
  @@index([userId, status])
  @@index([createdAt])
  @@map("batch_uploads")
}

enum BatchUploadStatus {
  PENDING         // Uploaded, waiting to be processed
  EXTRACTING      // Extracting zip contents
  PROCESSING      // Processing individual files
  COMPLETED       // All done successfully
  PARTIAL_SUCCESS // Some files failed
  FAILED          // Complete failure
  CANCELLED       // User cancelled
}
```

### 2. Extend `Media` Model

Add relation to batch uploads:
```prisma
model Media {
  // ... existing fields
  batchUploadId   String?
  batchUpload     BatchUpload?  @relation("BatchUploadMedia", fields: [batchUploadId], references: [id], onDelete: SetNull)
  originalPath    String?       // Original path within zip (e.g., "photos/vacation/img1.jpg")
  
  @@index([batchUploadId])
}
```

---

## Backend Changes

### New Files to Create

#### 1. `/backend/src/routes/batch-upload.ts`
```
New API routes:
- POST   /api/batch-upload          - Upload zip file
- GET    /api/batch-upload          - List user's batch uploads
- GET    /api/batch-upload/:id      - Get batch status & details
- DELETE /api/batch-upload/:id      - Cancel/delete batch upload
- POST   /api/batch-upload/:id/retry - Retry failed items
```

#### 2. `/backend/src/services/batchUploadService.ts`
```
Functions:
- createBatchUpload(userId, file, options)
- updateBatchProgress(batchId, progress)
- completeBatchUpload(batchId)
- getBatchStatus(batchId)
- cancelBatchUpload(batchId)
- retryFailedFiles(batchId)
```

#### 3. `/backend/src/services/zipProcessingService.ts`
```
Functions:
- publishZipProcessingJob(batchId, zipS3Key, options)
- handleZipMediaResult(result) - Consumer for processed media
```

#### 4. `/backend/src/types/batch-upload.ts`
```
TypeScript interfaces:
- BatchUploadOptions
- ZipProcessingJob
- ZipMediaResult
- BatchUploadProgress
```

#### 5. `/backend/src/consumers/zipMediaResultConsumer.ts`
```
RabbitMQ consumer for processed media from zip files
- Receives individual media processing results
- Creates Media records
- Updates batch progress
- Creates galleries from folder structure
- Emits WebSocket events for real-time updates
```

### Files to Modify

#### 1. `/backend/src/index.ts`
- Import and register batch upload routes
- Start zip media result consumer
- Add cleanup for orphaned batch uploads on startup

#### 2. `/backend/src/services/s3Service.ts`
```
Add functions:
- uploadZipFile(file, userId) - Store zip in S3
- deleteZipFile(s3Key) - Clean up after processing
- generateBatchUploadKey(userId, filename) - S3 key generation
```

#### 3. `/backend/src/services/mediaService.ts`
```
Add function:
- createMediaFromBatch(mediaData, batchId, originalPath)
```

#### 4. ~~`/backend/src/services/galleryService.ts`~~ (DEFERRED)
Gallery creation from folder structure is deferred to future implementation.

#### 5. ~~`/backend/src/services/websocketService.ts`~~ (DEFERRED)
WebSocket notifications are deferred to future notification system implementation.
Progress will be tracked via polling for now.

#### 6. `/backend/prisma/schema.prisma`
- Add BatchUpload model
- Add BatchUploadStatus enum
- Update Media model with batchUploadId and originalPath

---

## Media Processor Changes

### New Files to Create

#### 1. `/media-processor/src/consumers/zipProcessingConsumer.ts`
```
RabbitMQ consumer for zip processing jobs:
- Receives zip processing requests
- Downloads zip from S3
- Extracts to temp directory
- Validates and processes files
- Publishes results back
- Cleans up temp files
```

#### 2. `/media-processor/src/services/zipExtractionService.ts`
```
Functions:
- extractZipFile(zipPath, extractPath) - Extract zip safely
- validateZipFile(zipPath) - Check for zip bombs, size limits
- scanZipContents(zipPath) - Preview contents without extracting
- filterSystemFiles(files) - Remove .DS_Store, Thumbs.db, etc.
```

#### 3. `/media-processor/src/services/fileValidationService.ts`
```
Functions:
- isValidMediaFile(filepath) - Check if file is processable media
- getMediaType(filepath) - Determine IMAGE/VIDEO/DOCUMENT
- validateFileSize(filepath) - Check size limits
- validateMimeType(filepath) - MIME type validation
```

#### 4. ~~`/media-processor/src/services/folderStructureService.ts`~~ (REMOVED)
Folder structure parsing is not needed. The `originalPath` field in Media records
will contain the full path within the zip, which can be used by the backend
to infer folder structure when/if gallery creation is implemented.

#### 5. `/media-processor/src/types/zip-processing.ts`
```
TypeScript interfaces:
- ZipProcessingJob
- ZipExtractionResult
- MediaFileInfo
- FolderStructure
- ZipProcessingProgress
```

### Files to Modify

#### 1. `/media-processor/src/index.ts`
- Import and start zip processing consumer
- Add zip-specific queue configuration

#### 2. `/media-processor/src/queues/index.ts`
```
Add new queues:
- 'zip-processing' - For zip extraction jobs
- 'zip-media-result' - For sending results back to backend
```

#### 3. `/media-processor/src/services/mediaProcessingService.ts`
```
Modify to handle batch processing:
- Add batchId parameter to processing functions
- Include originalPath in results
- Handle batch-specific S3 paths
- Process files directly (not via RabbitMQ) for zip batches
```

#### 4. `/media-processor/src/utils/tempFileManager.ts`
```
Enhance for zip extraction:
- createBatchTempDir(batchId) - Temp dir for extraction
- cleanupBatchFiles(batchId) - Clean up after batch
- trackZipExtraction(batchId, path) - Track extracted files
```

---

## Frontend Changes

### New Files to Create

#### 1. `/frontend/components/media/zip-upload.tsx`
```tsx
Component: ZipUploadDialog
- File picker for zip files
- Upload progress indicator
- Options: preserve folder structure, target gallery
- Size/file count validation
- Upload trigger
```

#### 2. `/frontend/components/media/batch-upload-progress.tsx`
```tsx
Component: BatchUploadProgress
- Real-time progress display
- File count (total/processed/failed)
- List of processing/completed files
- Error display for failed files
- Cancel button
- Option to retry failed files
```

#### 3. `/frontend/components/media/batch-upload-list.tsx`
```tsx
Component: BatchUploadList
- List of user's batch uploads
- Status indicators
- Navigation to batch details
- Delete/retry actions
```

#### 4. `/frontend/lib/batch-upload-hooks.ts`
```tsx
Custom hooks:
- useZipUpload() - Upload zip file
- useBatchStatus(batchId) - Poll/subscribe to batch status
- useBatchList() - Get user's batches
- useCancelBatch(batchId) - Cancel batch
- useRetryBatch(batchId) - Retry failed files
```

### Files to Modify

#### 1. `/frontend/components/dashboard/media-library.tsx`
- Add "Upload Zip" button
- Integrate ZipUploadDialog
- Show active batch progress
- Link to batch upload history

#### 2. `/frontend/components/media/media-uploader.tsx`
- Add tab or option for zip uploads
- Redirect to zip upload component
- Show active batch uploads

#### 3. `/frontend/lib/api-hooks.ts`
```tsx
Add API functions:
- uploadZipFile(file, options)
- getBatchStatus(batchId)
- getBatchList(userId)
- cancelBatch(batchId)
- retryBatch(batchId)
```

#### 4. ~~`/frontend/lib/websocket.ts`~~ (DEFERRED)
WebSocket integration is deferred to future notification system.
Progress will be tracked via polling for now.

---

## RabbitMQ Message Definitions

### 1. Zip Processing Job (Backend → Media Processor)

**Queue**: `zip-processing`

```typescript
interface ZipProcessingJob {
  batchId: string;
  userId: string;
  zipS3Key: string;
  zipFilename: string;
  options: {
    preserveStructure: boolean;
    targetGalleryId?: string;
    maxFileSize?: number;
    allowedTypes?: ('IMAGE' | 'VIDEO' | 'DOCUMENT')[];
  };
}
```

### 2. Zip Extraction Progress (Media Processor → Backend)

**Queue**: `zip-extraction-progress`

```typescript
interface ZipExtractionProgress {
  batchId: string;
  status: 'EXTRACTING' | 'EXTRACTED' | 'SCANNING';
  totalFiles: number;
  mediaFiles: number;
  skippedFiles: number;
}
```

### 3. Media Processing Result (Media Processor → Backend)

**Queue**: `zip-media-result`

```typescript
interface ZipMediaResult {
  batchId: string;
  success: boolean;
  originalFilename: string;
  originalPath: string; // Path within zip
  
  // If successful
  media?: {
    s3Key: string;
    thumbnailS3Key?: string;
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
```

### 4. Batch Complete Notification (Media Processor → Backend)

**Queue**: `zip-processing-complete`

```typescript
interface ZipProcessingComplete {
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
```

---

## Media Processing Approach

### How Media Processor Handles Extracted Files

**Direct Internal Processing** (Recommended approach):

1. **Extract zip** to temporary directory
2. **Filter system files** (.DS_Store, Thumbs.db, etc.)
3. **Validate each file** as processable media
4. **Process files directly** using existing image/video processing functions
   - Call `processImage()` or `processVideo()` internally
   - Same code path as regular uploads
   - Synchronous processing with controlled concurrency
5. **Publish results** to `zip-media-result` queue
6. **Clean up** temporary files

**Benefits:**
- Simpler architecture (no self-publishing to queues)
- Easier progress tracking
- Less queue overhead
- Direct control over processing order

**Alternative:** Self-publish to existing `image-processing`/`video-processing` queues, but this adds complexity and queue overhead.

---

## Configuration Changes

### 1. Backend Environment Variables

```env
# Zip upload limits
MAX_ZIP_FILE_SIZE=1073741824        # 1GB in bytes
MAX_FILES_PER_ZIP=1000              # Max files in one zip
ZIP_EXTRACTION_TIMEOUT=600000       # 10 minutes

# S3 paths
S3_ZIP_UPLOAD_PREFIX=zip-uploads/
S3_ZIP_RETENTION_DAYS=7             # Keep zips for 7 days after processing

# Batch upload
BATCH_UPLOAD_CONCURRENT_LIMIT=3     # Max concurrent batch uploads per user
```

### 2. Media Processor Environment Variables

```env
# Zip extraction
ZIP_TEMP_DIR=/tmp/zip-extractions
ZIP_MAX_EXTRACTION_SIZE=5368709120  # 5GB uncompressed max
ZIP_BOMB_RATIO=100                  # Max compression ratio to detect zip bombs

# Processing
BATCH_PROCESSING_CONCURRENCY=5      # Process 5 files at a time from batch
```

---

## Security Considerations

### 1. Zip Bomb Prevention
- Check compression ratio before full extraction
- Limit uncompressed size
- Timeout on extraction
- Monitor extraction process

### 2. Malicious File Detection
- Validate MIME types
- Scan for executable files (reject)
- Sanitize filenames (remove path traversal)
- Virus scanning (optional integration)

### 3. Path Traversal Prevention
```typescript
// Ensure extracted files stay in extraction directory
function sanitizePath(extractPath: string, basePath: string): boolean {
  const normalized = path.normalize(extractPath);
  return normalized.startsWith(basePath);
}
```

### 4. Resource Limits
- Max zip file size
- Max number of files
- Max extraction time
- Per-user rate limiting
- Concurrent batch upload limits

---

## Folder Hierarchy Handling (DEFERRED)

**Current Implementation:** All files are uploaded to the user's media library with `originalPath` field containing the full path within the zip.

**Example:**
```
zip structure:                    →  Media records:
vacation.zip                         
├── beach/photo1.jpg              →  originalPath: "beach/photo1.jpg"
├── beach/photo2.jpg              →  originalPath: "beach/photo2.jpg"  
├── mountains/photo3.jpg          →  originalPath: "mountains/photo3.jpg"
└── photo5.jpg                    →  originalPath: "photo5.jpg"
```

**Future Implementation:** The backend can parse `originalPath` fields to create galleries from folder structure when that feature is implemented.

**Benefits of this approach:**
- Simpler initial implementation
- Preserves all folder information
- Flexible for future gallery creation
- No complex folder parsing logic needed now

---

## Progress Tracking & User Experience

### 1. Upload Phase
- Show zip file upload progress (0-100%)
- Display file size being uploaded
- Allow cancellation during upload

### 2. Extraction Phase
- "Extracting zip file..."
- "Found X media files"
- Folder structure preview

### 3. Processing Phase
- Polling-based count: "Processing 5 of 100 files"
- Show current file being processed
- Progress bar for overall completion
- Show thumbnails as they're processed

### 4. Completion Phase
- Summary: "Successfully added 95 of 100 files"
- Link to view new media
- List failed files with reasons
- Option to retry failed files

### 5. Error Handling
- Clear error messages
- Specific reasons (file too large, unsupported format, etc.)
- Partial success handling (some files succeed)
- Retry mechanism for failed files

---

## API Endpoints Summary

### Backend Routes

```
POST   /api/batch-upload
       Body: { file: File, preserveStructure: boolean, targetGalleryId?: string }
       Response: { batchId, status, message }

GET    /api/batch-upload
       Query: { status?, limit?, offset? }
       Response: { batches: BatchUpload[] }

GET    /api/batch-upload/:batchId
       Response: { batch: BatchUpload, progress: Progress, errors: Error[] }

DELETE /api/batch-upload/:batchId
       Response: { success: boolean }

POST   /api/batch-upload/:batchId/retry
       Body: { fileIds?: string[] } // Retry specific files or all failed
       Response: { success: boolean, retriedCount: number }

GET    /api/batch-upload/:batchId/media
       Query: { status?, limit?, offset? }
       Response: { media: Media[] }
```

---

## Additional Features to Consider

### 1. Metadata Preservation
- Extract EXIF data from images
- Use folder names as tags/categories
- Date taken from file metadata
- GPS coordinates if available

### 2. Duplicate Detection
- Check if media already exists (hash comparison)
- Option to skip or replace duplicates
- Show duplicate warnings

### 3. Auto-tagging
- Use folder names as automatic tags
- AI-based tagging of extracted images
- Location-based tagging from EXIF

### 4. Batch Editing
- Apply same visibility settings to all
- Bulk caption/description
- Bulk gallery assignment

### 5. Import from Archives
- Support other archive formats (.rar, .7z, .tar.gz)
- Support nested archives (zip within zip)

### 6. Smart Organization
- Group by date taken
- Group by location
- Detect photo series/bursts

---

## Testing Strategy

### Unit Tests
- Zip extraction service
- File validation service
- Folder structure parsing
- Path sanitization
- Security checks (zip bombs, path traversal)

### Integration Tests
- End-to-end zip upload flow
- Batch upload creation
- Media processing from zip
- Gallery creation from folders
- Error handling scenarios
- Partial success scenarios

### Performance Tests
- Large zip files (100MB+)
- Many small files (1000+)
- Deep folder hierarchies
- Concurrent batch uploads

### Security Tests
- Zip bomb attempts
- Path traversal attempts
- Malicious file types
- Oversized archives

---

## Migration Plan

### 1. Database Migration
```bash
npx prisma migrate dev --name add_batch_upload
```

### 2. Deployment Order
1. Deploy media processor (backwards compatible)
2. Deploy backend (with new routes)
3. Deploy frontend (feature flag initially)
4. Enable feature for beta users
5. Full rollout

### 3. Rollback Plan
- Feature flag to disable zip uploads
- Batch upload table can remain (no breaking changes)
- Gracefully handle in-progress batches

---

## Monitoring & Observability

### Metrics to Track
- Zip uploads per day
- Average files per zip
- Processing time per file
- Failure rates
- Most common errors
- Storage used by batch uploads
- Queue depths (zip-processing, zip-media-result)

### Logging
- Batch upload creation
- Extraction start/complete
- Individual file processing
- Errors with context
- Cleanup operations

### Alerts
- High failure rate
- Queue backlog
- Processing timeout
- Storage quota warnings

---

## Estimated Complexity

### Backend: **High**
- Database schema changes
- New routes and services
- RabbitMQ integration
- WebSocket events
- Error handling

### Media Processor: **Very High**
- Zip extraction logic
- Security validation
- Folder structure parsing
- Batch processing coordination
- Error recovery

### Frontend: **Medium**
- Upload UI component
- Progress tracking
- WebSocket integration
- Error display

### Total Effort: **~2-3 weeks** (1 developer)

---

## What You Might Have Forgotten

1. **Duplicate File Handling**: What if the zip contains files with the same name?
   - Solution: Use original path as unique identifier, rename if needed

2. **Folder Name Conflicts**: What if folder names match existing galleries?
   - Solution: Append timestamp or numeric suffix

3. **Partially Uploaded Zips**: Network interruption during upload?
   - Solution: Implement resumable uploads (multipart)

4. **Zip File Cleanup**: When to delete the uploaded zip?
   - Solution: Delete after X days or after successful processing

5. **Character Encoding**: Filenames with special characters or non-ASCII?
   - Solution: Properly decode zip entry names, sanitize for S3

6. **Hidden Files**: macOS `.DS_Store`, Windows `Thumbs.db`?
   - Solution: Filter out system files

7. **Symlinks in Zip**: Malicious symlinks?
   - Solution: Ignore symlinks during extraction

8. **Memory Usage**: Large zips in memory?
   - Solution: Stream extraction, process one file at a time

9. **Concurrent Processing**: User uploads multiple zips?
   - Solution: Queue system, limit concurrent batches per user

10. **Orphaned Records**: Batch record created but processing fails?
    - Solution: Cleanup job for abandoned batches

11. **Gallery Limits**: User hits gallery limit during batch?
    - Solution: Pre-check limits, fail early with clear message

12. **File Name Collisions**: Multiple files named `IMG_001.jpg` in different folders?
    - Solution: Preserve folder context in `originalPath` field

13. **Progress Interruption**: User closes browser during processing?
    - Solution: Processing continues server-side, resume view on return

14. **Album Cover Selection**: Which image becomes gallery thumbnail?
    - Solution: Use first image, or allow user to select afterward

15. **Notification Spam**: Notify for each file or just batch completion?
    - Solution: Batch completion only, with summary

---

## Phase 1 MVP Scope

To get started, focus on:

1. ✅ Database schema (BatchUpload model)
2. ✅ Backend zip upload endpoint
3. ✅ Media processor zip extraction
4. ✅ Store originalPath for future folder support
5. ✅ Progress tracking (polling-based)
6. ✅ Basic error handling
7. ✅ Frontend upload component
8. ✅ Frontend progress display
9. ✅ System file filtering (.DS_Store, Thumbs.db)

**Defer for Phase 2:**
- Gallery creation from folder structure
- WebSocket real-time updates
- Retry mechanism
- Duplicate detection
- Metadata extraction
- Smart organization
- Malicious content detection

---

## Conclusion

This is a comprehensive feature requiring coordination across frontend, backend, and media processor. The key challenges are:

1. **Security**: Preventing malicious zips
2. **Performance**: Handling large batches efficiently
3. **UX**: Clear progress indication
4. **Error handling**: Graceful degradation for partial failures
5. **Resource management**: Memory, storage, processing time

The plan above should cover all aspects, but expect to discover edge cases during implementation.

