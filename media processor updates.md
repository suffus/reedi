# Media Processor Update Messages

This document describes all possible message formats that the media processor can send to the backend via RabbitMQ.

## Message Types

The media processor sends four types of messages:

1. **Progress Updates** (`messageType: "progress"`) - In-progress status updates
2. **Result Messages** (`messageType: "result"`) - Final completion/failure results
3. **Error Messages** (`messageType: "error"`) - Error notifications
4. **Request Messages** (`messageType: "request"`) - Processing requests (not sent to backend)

## 1. Progress Updates

### Image Processing Progress
**Generated when:** Image processing is in progress
**Message Type:** `progress`
**Media Type:** `image`

```json
{
  "messageType": "progress",
  "mediaType": "image",
  "mediaId": "cmgv...",
  "userId": "cmgqg0yh0000kmubdoly80xyh",
  "timestamp": "2025-10-17T21:49:31.294Z",
  "status": "PROCESSING",
  "progress": 50,
  "message": "Processing image versions",
  "stage": "processing",
  "details": {
    "jobId": "img_1760716151461_ric4mgj50"
  }
}
```

**Progress Stages:**
- 10% - "Starting image processing"
- 30% - "Downloaded image from S3"
- 50% - "Processing image versions"
- 80% - "Uploading processed versions to S3"
- 90% - "Uploaded all versions to S3"

### Video Processing Progress
**Generated when:** Video processing is in progress
**Message Type:** `progress`
**Media Type:** `video`

```json
{
  "messageType": "progress",
  "mediaType": "video",
  "mediaId": "cmgv...",
  "userId": "cmgqg0yh0000kmubdoly80xyh",
  "timestamp": "2025-10-17T21:49:31.294Z",
  "status": "PROCESSING",
  "progress": 75,
  "message": "Uploading processed video to S3",
  "stage": "processing",
  "details": {
    "jobId": "video_1760716151461_abc123"
  }
}
```

**Progress Stages:**
- 10% - "Starting video processing"
- 30% - "Downloaded video from S3"
- 90% - "Uploaded processed video to S3"

### Zip Processing Progress
**Generated when:** Zip file processing is in progress
**Message Type:** `progress`
**Media Type:** `zip`

```json
{
  "messageType": "progress",
  "mediaType": "zip",
  "mediaId": "cmgv...",
  "userId": "cmgqg0yh0000kmubdoly80xyh",
  "timestamp": "2025-10-17T21:49:31.294Z",
  "status": "PROCESSING",
  "progress": 60,
  "message": "Processed 15/25 files",
  "stage": "processing",
  "details": {
    "jobId": "zip_1760716151461_def456"
  }
}
```

**Progress Stages:**
- 10% - "Starting zip processing"
- 20% - "Downloaded zip from S3"
- 40% - "Extracted X files from zip"
- 40-90% - "Processed X/Y files" (dynamic based on file count)
- 90% - Final processing stage

## 2. Result Messages

### Image Processing Result
**Generated when:** Image processing completes successfully
**Message Type:** `result`
**Media Type:** `image`
**Status:** `COMPLETED`

```json
{
  "messageType": "result",
  "mediaType": "image",
  "mediaId": "cmgv...",
  "userId": "cmgqg0yh0000kmubdoly80xyh",
  "timestamp": "2025-10-17T21:49:31.294Z",
  "status": "COMPLETED",
  "result": {
    "s3Key": "processed/images/cmgv.../1080p_optimized.jpg",
    "thumbnailS3Key": "processed/images/cmgv.../thumbnail.jpg",
    "width": 1920,
    "height": 1080,
    "metadata": {
      "imageVersions": [
        {
          "quality": "thumbnail",
          "s3Key": "processed/images/cmgv.../thumbnail.jpg",
          "width": 300,
          "height": 300,
          "fileSize": 12345
        },
        {
          "quality": "180p",
          "s3Key": "processed/images/cmgv.../180p.jpg",
          "width": 180,
          "height": 270,
          "fileSize": 5678
        },
        {
          "quality": "360p",
          "s3Key": "processed/images/cmgv.../360p.jpg",
          "width": 360,
          "height": 540,
          "fileSize": 12345
        },
        {
          "quality": "720p",
          "s3Key": "processed/images/cmgv.../720p.jpg",
          "width": 720,
          "height": 1080,
          "fileSize": 45678
        },
        {
          "quality": "1080p_optimized",
          "s3Key": "processed/images/cmgv.../1080p_optimized.jpg",
          "width": 1920,
          "height": 1080,
          "fileSize": 123456
        }
      ],
      "processingTime": 1234,
      "originalMetadata": {
        "width": 1920,
        "height": 1080,
        "fileSize": 500000,
        "mimeType": "image/jpeg",
        "format": "jpeg",
        "colorSpace": "srgb",
        "hasAlpha": false
      }
    }
  },
  "details": {
    "jobId": "img_1760716151461_ric4mgj50"
  }
}
```

### Video Processing Result
**Generated when:** Video processing completes successfully
**Message Type:** `result`
**Media Type:** `video`
**Status:** `COMPLETED`

```json
{
  "messageType": "result",
  "mediaType": "video",
  "mediaId": "cmgv...",
  "userId": "cmgqg0yh0000kmubdoly80xyh",
  "timestamp": "2025-10-17T21:49:31.294Z",
  "status": "COMPLETED",
  "result": {
    "s3Key": "processed/videos/cmgv.../original.mp4",
    "thumbnailS3Key": "processed/videos/cmgv.../thumbnail.jpg",
    "width": 1920,
    "height": 1080,
    "duration": 120.5,
    "metadata": {
      "videoVersions": [
        {
          "quality": "360p",
          "s3Key": "processed/videos/cmgv.../360p.mp4",
          "width": 640,
          "height": 360,
          "fileSize": 1234567,
          "mimeType": "video/mp4"
        },
        {
          "quality": "720p",
          "s3Key": "processed/videos/cmgv.../720p.mp4",
          "width": 1280,
          "height": 720,
          "fileSize": 4567890,
          "mimeType": "video/mp4"
        },
        {
          "quality": "1080p",
          "s3Key": "processed/videos/cmgv.../1080p.mp4",
          "width": 1920,
          "height": 1080,
          "fileSize": 12345678,
          "mimeType": "video/mp4"
        }
      ],
      "thumbnails": [
        {
          "quality": "thumbnail",
          "s3Key": "processed/videos/cmgv.../thumbnail_0.jpg",
          "width": 300,
          "height": 300,
          "fileSize": 12345,
          "mimeType": "image/jpeg"
        },
        {
          "quality": "thumbnail",
          "s3Key": "processed/videos/cmgv.../thumbnail_1.jpg",
          "width": 300,
          "height": 300,
          "fileSize": 12345,
          "mimeType": "image/jpeg"
        }
      ],
      "processingTime": 5678,
      "originalMetadata": {
        "width": 1920,
        "height": 1080,
        "duration": 120.5,
        "fileSize": 50000000,
        "mimeType": "video/mp4",
        "codec": "h264",
        "bitrate": 2000000,
        "framerate": 30
      }
    }
  },
  "details": {
    "jobId": "video_1760716151461_abc123"
  }
}
```

### Zip Processing Result
**Generated when:** Zip file processing completes successfully
**Message Type:** `result`
**Media Type:** `zip`
**Status:** `COMPLETED`

```json
{
  "messageType": "result",
  "mediaType": "zip",
  "mediaId": "cmgv...",
  "userId": "cmgqg0yh0000kmubdoly80xyh",
  "timestamp": "2025-10-17T21:49:31.294Z",
  "status": "COMPLETED",
  "result": {
    "extractedMedia": [
      {
        "s3Key": "uploads/user123/1234567890.zip.image1.jpg",
        "thumbnailS3Key": "uploads/user123/1234567890.zip.image1.jpg.image1.jpg_thumbnail.jpg",
        "originalFilename": "image1.jpg",
        "mimeType": "image/jpeg",
        "width": 1920,
        "height": 1080,
        "duration": 0,
        "versions": [
          {
            "quality": "thumbnail",
            "s3Key": "uploads/user123/1234567890.zip.image1.jpg.image1.jpg_thumbnail.jpg",
            "width": 300,
            "height": 300,
            "fileSize": 12345,
            "mimeType": "image/jpeg"
          },
          {
            "quality": "180p",
            "s3Key": "uploads/user123/1234567890.zip.image1.jpg.image1.jpg_180p.jpg",
            "width": 180,
            "height": 270,
            "fileSize": 5678,
            "mimeType": "image/jpeg"
          }
          // ... more versions
        ],
        "metadata": {
          "originalPath": "folder/image1.jpg",
          "fileSize": 500000,
          "processingTime": 1234,
          "originalMetadata": {
            "width": 1920,
            "height": 1080,
            "fileSize": 500000,
            "mimeType": "image/jpeg",
            "format": "jpeg",
            "colorSpace": "srgb",
            "hasAlpha": false
          }
        }
      }
      // ... more extracted media items
    ],
    "metadata": {
      "extractedCount": 25,
      "totalFiles": 30,
      "userId": "cmgqg0yh0000kmubdoly80xyh"
    }
  },
  "details": {
    "jobId": "zip_1760716151461_def456"
  }
}
```

## 3. Error Messages

### Processing Error
**Generated when:** Any processing fails (image, video, or zip)
**Message Type:** `error`
**Media Type:** `image` | `video` | `zip`

```json
{
  "messageType": "error",
  "mediaType": "image",
  "mediaId": "cmgv...",
  "userId": "cmgqg0yh0000kmubdoly80xyh",
  "timestamp": "2025-10-17T21:49:31.294Z",
  "error": "Failed to process image: Invalid file format",
  "details": {
    "jobId": "img_1760716151461_ric4mgj50"
  },
  "retryable": false
}
```

**Common Error Scenarios:**
- Invalid file format
- S3 download/upload failures
- Processing timeouts
- Insufficient disk space
- Corrupted files
- Unsupported media types

## 4. Failure Results

### Processing Failure Result
**Generated when:** Processing completes but fails
**Message Type:** `result`
**Media Type:** `image` | `video` | `zip`
**Status:** `FAILED`

```json
{
  "messageType": "result",
  "mediaType": "image",
  "mediaId": "cmgv...",
  "userId": "cmgqg0yh0000kmubdoly80xyh",
  "timestamp": "2025-10-17T21:49:31.294Z",
  "status": "FAILED",
  "error": "Processing failed: Invalid file format",
  "details": {
    "jobId": "img_1760716151461_ric4mgj50"
  }
}
```

## Message Flow Summary

### Image Processing
1. **Request** → Media Processor
2. **Progress Updates** (10%, 30%, 50%, 80%, 90%) → Backend
3. **Result** (COMPLETED with imageVersions) → Backend

### Video Processing
1. **Request** → Media Processor
2. **Progress Updates** (10%, 30%, 90%) → Backend
3. **Result** (COMPLETED with videoVersions) → Backend

### Zip Processing
1. **Request** → Media Processor
2. **Progress Updates** (10%, 20%, 40%, 40-90%, 90%) → Backend
3. **Result** (COMPLETED with extractedMedia array) → Backend

### Error Handling
- **Processing Errors** → Error message → Backend
- **Failure Results** → Result with FAILED status → Backend

## Key Differences

- **Images**: Only send completed results, no intermediate progress
- **Videos**: Send progress updates during processing
- **Zips**: Send progress updates and final result with extractedMedia array
- **All Types**: Send error messages on failure
