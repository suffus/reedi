# Comprehensive Temp File Tracking System

## Overview

The media processor now includes a comprehensive temp file tracking system that ensures all temporary files created during media processing are properly tracked and cleaned up. This system prevents disk space issues and ensures no orphaned files are left behind.

## Architecture

### 1. Temp File Tracker

The `TempFileTracker` class manages the lifecycle of all temporary files:

- **File Registration**: Every temp file is registered with metadata (path, stage, type, description)
- **Stage Tracking**: Files are tracked through different processing stages
- **Automatic Cleanup**: Files are automatically cleaned up when jobs complete
- **Orphan Detection**: Identifies and cleans up files that aren't being tracked

### 2. Enhanced Processing Pipeline

The processing pipeline now includes a dedicated cleanup stage:

```
DOWNLOAD → PROCESSING → UPLOAD → CLEANUP → COMPLETED
```

Each stage tracks its temp files and passes the tracking information to the next stage.

### 3. RabbitMQ Integration

Temp file tracking information flows through the RabbitMQ message queues:

- **Download Stage**: Tracks downloaded media files
- **Processing Stage**: Tracks generated thumbnails and quality versions
- **Upload Stage**: Marks files for cleanup after successful upload
- **Cleanup Stage**: Removes all tracked temp files
- **Completion**: Job is marked as complete with all temp files cleaned up

## Key Features

### Automatic File Tracking

```typescript
// Files are automatically tracked when created
this.tempFileTracker.trackFile(
  jobId, 
  filePath, 
  'PROCESSED', 
  'output', 
  'Generated thumbnail'
)
```

### Stage-Based Cleanup

```typescript
// Files are marked for cleanup after upload
this.tempFileTracker.markFileForCleanup(jobId, filePath)
```

### Comprehensive Cleanup

```typescript
// All temp files for a job are cleaned up
const { cleaned, totalSize } = await this.tempFileTracker.cleanupJobTempFiles(jobId)
```

### Orphan Detection

```typescript
// Find and clean up orphaned files
const orphaned = this.tempFileTracker.findOrphanedFiles()
await this.tempFileTracker.cleanupOrphanedFiles()
```

## Benefits

### 1. **Disk Space Management**
- No more disk space issues from accumulated temp files
- Automatic cleanup prevents `/tmp` directory from filling up
- Real-time monitoring of temp file usage

### 2. **Reliability**
- All temp files are guaranteed to be cleaned up
- No orphaned files left behind
- Graceful handling of processing failures

### 3. **Monitoring**
- Real-time statistics on temp file usage
- Health check endpoints show temp file status
- Easy debugging of file management issues

### 4. **Scalability**
- Handles multiple concurrent jobs
- Efficient cleanup without blocking processing
- Automatic cleanup on service shutdown

## Usage

### Health Check Endpoint

```bash
GET /health
```

Returns temp file statistics:
```json
{
  "tempFiles": {
    "video": {
      "totalJobs": 3,
      "totalFiles": 15,
      "totalSize": 2048576
    },
    "image": {
      "totalJobs": 5,
      "totalFiles": 25,
      "totalSize": 1048576
    }
  }
}
```

### Manual Cleanup

```typescript
// Clean up orphaned files
await videoProcessingService.cleanupOrphanedTempFiles()

// Get temp file statistics
const stats = videoProcessingService.getTempFileStats()
```

## Configuration

### Environment Variables

```bash
# Temp directory for processing
TEMP_DIR=/tmp

# Cleanup intervals
CLEANUP_INTERVAL_HOURS=6
```

### Queue Configuration

The system automatically creates and manages cleanup queues:

```typescript
{
  download: 'video.processing.download',
  processing: 'video.processing.processing',
  upload: 'video.processing.upload',
  cleanup: 'video.processing.cleanup',    // New cleanup queue
  updates: 'video.processing.updates'
}
```

## Monitoring

### Temp File Statistics

- **Total Jobs**: Number of active jobs with temp files
- **Total Files**: Total number of tracked temp files
- **Total Size**: Combined size of all temp files in bytes

### Cleanup Metrics

- **Files Cleaned**: Number of files removed during cleanup
- **Space Freed**: Amount of disk space freed in bytes
- **Cleanup Time**: Time taken for cleanup operations

## Error Handling

### Graceful Degradation

- If cleanup fails, manual cleanup is attempted
- Orphaned files are detected and cleaned up
- Service continues operating even if cleanup has issues

### Logging

- All temp file operations are logged
- Cleanup failures are logged with details
- Orphaned file detection is logged

## Testing

Run the test script to verify the system:

```bash
node test-temp-file-tracking.js
```

This demonstrates:
- File tracking through stages
- Cleanup operations
- Statistics reporting
- Orphan detection

## Migration

### From Old System

The new system is backward compatible. Existing code will continue to work, but temp files will now be properly tracked and cleaned up.

### Benefits

- **Immediate**: Better disk space management
- **Long-term**: More reliable processing pipeline
- **Monitoring**: Better visibility into system health

## Future Enhancements

### Planned Features

1. **Disk Space Alerts**: Notify when temp directory usage is high
2. **Cleanup Scheduling**: Configurable cleanup intervals
3. **File Compression**: Compress temp files to save space
4. **Cloud Storage**: Move temp files to cloud storage for large jobs

### Integration Points

- **Prometheus Metrics**: Export temp file statistics
- **Alerting**: Integrate with monitoring systems
- **Dashboard**: Web interface for temp file management

## Troubleshooting

### Common Issues

1. **High Temp File Usage**
   - Check for stuck jobs
   - Verify cleanup stage is working
   - Check disk space

2. **Cleanup Failures**
   - Check file permissions
   - Verify temp directory exists
   - Check for file locks

3. **Orphaned Files**
   - Run manual cleanup
   - Check job status
   - Verify queue connectivity

### Debug Commands

```bash
# Check temp file statistics
curl http://localhost:8044/health

# Check service info
curl http://localhost:8044/info

# Monitor logs for cleanup operations
tail -f logs/media-processor.log | grep -i cleanup
```

## Conclusion

The comprehensive temp file tracking system provides:

- **Reliability**: No more disk space issues
- **Visibility**: Real-time monitoring of temp file usage
- **Automation**: Automatic cleanup of all temp files
- **Scalability**: Handles multiple concurrent jobs efficiently

This system ensures the media processor can handle high volumes of media processing without running into disk space issues, while providing comprehensive monitoring and debugging capabilities.
