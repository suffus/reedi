# Staged Video Processing System

## Overview

The staged video processing system breaks down video processing into smaller, independently acknowledged steps to prevent RabbitMQ message timeouts during long-running video processing jobs.

## Problem Solved

**Previous Issue**: Video processing jobs could take 30+ minutes, causing RabbitMQ acknowledgments to timeout (default: 30 minutes), leading to message redelivery and duplicate processing.

**Solution**: Break processing into stages with early acknowledgments:

1. **Download Stage** (2-5 minutes) - Acknowledge after download
2. **Processing Stage** (10-30 minutes) - Acknowledge after FFmpeg processing  
3. **Upload Stage** (2-5 minutes) - Acknowledge after S3 upload

## Architecture

### Queues
- `video.processing.download` - Initial download jobs
- `video.processing.processing` - FFmpeg processing jobs
- `video.processing.upload` - S3 upload jobs
- `video.processing.updates` - Progress updates to backend

### Stages

#### Stage 1: Download
- Downloads video from S3
- Extracts basic metadata
- **Acknowledges original message**
- Sends job to processing queue

#### Stage 2: Processing  
- Processes video with FFmpeg (360p, 540p, 720p)
- Generates thumbnails
- **Acknowledges processing message**
- Sends job to upload queue

#### Stage 3: Upload
- Uploads processed videos to S3
- Updates database with results
- **Acknowledges upload message**
- Sends completion update

## Benefits

1. **No Timeouts**: Each stage acknowledges quickly (2-30 minutes vs 30+ minutes)
2. **Better Error Isolation**: Failed processing doesn't lose download work
3. **Progress Tracking**: Backend can track which stage each video is in
4. **Retry Granularity**: Each stage can be retried independently
5. **Resource Management**: Can scale different stages independently

## Implementation

### Media Processor Changes

- `StagedVideoProcessingService` - Main service handling staged processing
- `EnhancedRabbitMQService` - Extended RabbitMQ service with multiple queues
- `stagedProcessing.ts` - Type definitions for staged jobs

### Backend Changes

- `StagedVideoProcessingService` - Backend service for creating staged jobs
- Updated media upload to use new service
- Enhanced RabbitMQ service with `sendMessage` method

## Usage

### Starting the Service

```bash
cd media-processor
npm start
```

### Testing

```bash
cd media-processor
node test-staged-processing.js
```

### Monitoring

Check RabbitMQ management interface:
- http://localhost:15672 (guest/guest)
- Monitor queue depths and message rates

## Database Schema

The system uses existing `VideoProcessingJob` table with enhanced status tracking:

- `status`: PENDING → PROCESSING → COMPLETED/FAILED
- `currentStep`: Tracks current stage (download_complete, processing_video, etc.)
- `progress`: 0-100% progress through entire pipeline

## Error Handling

- Each stage handles errors independently
- Failed jobs are sent to updates queue with error details
- Backend updates database with failure status
- No message loss due to timeouts

## Performance

- **Download**: 2-5 minutes (depends on file size)
- **Processing**: 10-30 minutes (depends on video length/complexity)  
- **Upload**: 2-5 minutes (depends on number of outputs)
- **Total**: 15-40 minutes (same as before, but with early acks)

## Migration

The system is backward compatible:
- Existing single-stage processing still works
- New staged processing is opt-in
- Can run both systems in parallel during migration 