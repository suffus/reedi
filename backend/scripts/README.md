# Image Processing Scripts

This directory contains scripts for managing image processing in the Reedi application.

## Scripts

### 1. `reprocess-images.js`

Sends unprocessed images to the media processor for processing.

**Usage:**
```bash
# Process 10 images (default)
node scripts/reprocess-images.js

# Process 50 images
node scripts/reprocess-images.js 50

# Process 100 images
node scripts/reprocess-images.js 100
```

**What it does:**
- Finds images with `imageProcessingStatus` of `null`, `PENDING`, or `FAILED`
- Updates their status to `PENDING`
- Sends them to the RabbitMQ processing queue
- Processes oldest images first
- Provides a summary of success/failure counts

**Prerequisites:**
- RabbitMQ server running
- Media processor service running
- Database connection configured

### 2. `check-image-status.js`

Shows the current status of image processing in the database.

**Usage:**
```bash
node scripts/check-image-status.js
```

**What it shows:**
- Count of images by processing status
- Sample images for each status
- Images that have processed versions
- Quality count for processed images

## Examples

### Check current status
```bash
cd backend
node scripts/check-image-status.js
```

### Process first 10 unprocessed images
```bash
cd backend
node scripts/reprocess-images.js 10
```

### Process first 100 unprocessed images
```bash
cd backend
node scripts/reprocess-images.js 100
```

## Status Meanings

- `null` - Never processed
- `PENDING` - Currently being processed
- `PROCESSING` - In progress
- `COMPLETED` - Successfully processed
- `FAILED` - Processing failed
- `REJECTED` - Processing rejected

## Notes

- Images are processed in order of creation date (oldest first)
- The script includes a small delay between queueing images to avoid overwhelming the processor
- Failed images can be retried by running the script again
- Only images with valid `s3Key` values are processed 