# Temporary File Cleanup

The media processor now includes comprehensive temporary file cleanup to prevent disk space issues and ensure proper resource management.

## Overview

Temporary files are created during media processing for:
- Downloaded media files from S3
- Processed video/image versions
- Thumbnails
- Intermediate processing files

## Automatic Cleanup

### During Processing
- Files are cleaned up immediately after successful upload to S3
- Cleanup occurs after each processing stage (download, processing, upload)
- Cleanup happens on both success and failure scenarios

### Periodic Cleanup
- Runs automatically every 6 hours
- Removes files older than 6 hours by default
- Integrated into the main service lifecycle

### Shutdown Cleanup
- Runs final cleanup when the service shuts down
- Ensures no temporary files are left behind

## Manual Cleanup

### Standalone Cleanup Script

Use the `cleanup-temp-files.js` script to manually clean up temporary files:

```bash
# Show what would be cleaned up (dry run)
node cleanup-temp-files.js --dry-run

# Clean up files older than 24 hours (default)
node cleanup-temp-files.js

# Clean up files older than 6 hours
node cleanup-temp-files.js --max-age=6

# Clean up ALL temporary files (use with caution)
node cleanup-temp-files.js --force --max-age=0

# Skip confirmation prompt
node cleanup-temp-files.js --force
```

### Script Options

- `--dry-run`: Show what would be cleaned up without deleting
- `--force`: Skip confirmation prompt
- `--max-age=N`: Only clean up files older than N hours
- `--help, -h`: Show help message

## Cleanup Methods

### Video Processing Service
- `cleanupJobTempFiles()`: Clean up files for a specific job
- `cleanupMediaIdFiles()`: Clean up files matching a media ID
- `cleanupOldTempFiles()`: Clean up files older than specified age
- `emergencyCleanup()`: Remove all temporary files

### Image Processing Service
- Same cleanup methods as video processing service
- Handles image-specific temporary files

## Configuration

### Environment Variables
- `TEMP_DIR`: Directory for temporary files (default: `/tmp`)

### Cleanup Settings
- Default cleanup interval: 6 hours
- Default max age: 6 hours for periodic cleanup
- Files are cleaned up immediately after successful S3 upload

## Monitoring

### Log Messages
- Debug level: Individual file cleanup operations
- Info level: Cleanup summary and periodic cleanup
- Warn level: Failed cleanup attempts
- Error level: Cleanup errors

### Example Logs
```
[DEBUG] Cleaned up temp file: /tmp/media_123_720p.mp4
[INFO] Cleaned up 5 temp files for job abc-123
[INFO] Periodic cleanup completed: removed 12 old temp files
[WARN] Failed to clean up temp file /tmp/old_file.mp4: ENOENT
```

## Best Practices

### For Production
1. Monitor disk space usage in `/tmp` directory
2. Set up alerts for disk space thresholds
3. Run manual cleanup during maintenance windows if needed
4. Use `--dry-run` to preview cleanup operations

### For Development
1. Use `--dry-run` to see what would be cleaned up
2. Test cleanup with small sets of files first
3. Monitor logs for cleanup operations
4. Use `--max-age=0` sparingly in production

## Troubleshooting

### Common Issues

1. **Permission Denied**
   - Ensure the service has write access to temp directory
   - Check file ownership and permissions

2. **Files Not Being Cleaned Up**
   - Verify cleanup methods are being called
   - Check logs for cleanup errors
   - Ensure files match expected naming patterns

3. **Disk Space Still Full**
   - Run manual cleanup with `--force --max-age=0`
   - Check for files outside temp directory
   - Verify cleanup script is working

### Debug Commands

```bash
# Check temp directory contents
ls -la /tmp | grep -E "(media|thumb|video|image)"

# Check disk usage
df -h /tmp

# Find large files
find /tmp -type f -size +100M -exec ls -lh {} \;

# Check file ages
find /tmp -type f -mtime +1 -exec ls -la {} \;
```

## Integration

The cleanup functionality is integrated into:
- Main service lifecycle
- Error handling
- Success scenarios
- Periodic maintenance
- Graceful shutdown

This ensures comprehensive cleanup coverage and prevents temporary file accumulation. 