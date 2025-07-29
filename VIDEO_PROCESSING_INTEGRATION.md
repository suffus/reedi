# Video Processing Integration

This document describes the video processing integration between Reedi and the media processor service using RabbitMQ.

## Architecture

The integration consists of:

1. **Reedi Backend** - Sends processing requests and receives progress updates
2. **Media Processor Service** - Processes videos and sends progress updates
3. **RabbitMQ** - Message broker for communication
4. **S3** - Shared storage for input/output files

## Setup

### 1. Install RabbitMQ

```bash
# On Ubuntu/Debian
sudo apt-get install rabbitmq-server

# On macOS with Homebrew
brew install rabbitmq

# Start RabbitMQ
sudo systemctl start rabbitmq-server
# or
brew services start rabbitmq
```

### 2. Configure Environment Variables

#### Media Processor Service (.env)
```bash
# RabbitMQ Configuration
RABBITMQ_URL=amqp://localhost
RABBITMQ_USER=your_rabbitmq_user
RABBITMQ_PASSWORD=your_rabbitmq_password
RABBITMQ_PORT=5672
RABBITMQ_PROCESSING_EXCHANGE=video.processing
RABBITMQ_UPDATES_EXCHANGE=video.updates
RABBITMQ_REQUESTS_QUEUE=video.processing.requests
RABBITMQ_UPDATES_QUEUE=video.processing.updates

# IDRIVE S3 Configuration
IDRIVE_REGION=us-east-1
IDRIVE_ENDPOINT=https://your-idrive-endpoint.com
IDRIVE_ACCESS_KEY_ID=your_idrive_access_key_here
IDRIVE_SECRET_ACCESS_KEY=your_idrive_secret_key_here
IDRIVE_BUCKET_NAME=your_idrive_bucket_name_here

# Server Configuration
PORT=8044

# Processing Configuration
TEMP_DIR=/tmp
PROGRESS_INTERVAL=5

# Logging
NODE_ENV=development
```

#### Reedi Backend (.env)
```bash
# Add to existing .env
RABBITMQ_URL=amqp://localhost
RABBITMQ_USER=your_rabbitmq_user
RABBITMQ_PASSWORD=your_rabbitmq_password
RABBITMQ_PORT=5672
```

### 3. Database Migration

The database schema has been updated with new tables and fields:

```sql
-- New table for video processing jobs
CREATE TABLE video_processing_jobs (
  id TEXT PRIMARY KEY,
  media_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  s3_key TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  progress INTEGER NOT NULL DEFAULT 0,
  current_step TEXT,
  error_message TEXT,
  thumbnails JSON,
  video_versions JSON,
  metadata JSON,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Updated media table with video processing fields
ALTER TABLE media ADD COLUMN video_processing_status TEXT;
ALTER TABLE media ADD COLUMN video_thumbnails JSON;
ALTER TABLE media ADD COLUMN video_versions JSON;
ALTER TABLE media ADD COLUMN video_metadata JSON;
```

## Running the Services

### 1. Start RabbitMQ
```bash
sudo systemctl start rabbitmq-server
```

### 2. Start the Media Processor Service
```bash
cd media-processor
npm install
npm start
```

The service will start on port 8044 by default. You can check if it's running by visiting:
- Health check: http://localhost:8044/health
- Service info: http://localhost:8044/info

### 3. Start the Reedi Backend
```bash
cd backend
npm install
npm run dev
```

## Testing the Integration

### 1. Test RabbitMQ Connection
```bash
cd media-processor
npm run test-rabbitmq
```

### 2. Test Video Processing

1. Upload a video through the Reedi frontend
2. The video will be stored in S3
3. Call the processing API:
   ```bash
   curl -X POST http://localhost:8088/api/video-processing/media/{mediaId}/process-video \
     -H "Authorization: Bearer {token}" \
     -H "Content-Type: application/json" \
     -d '{"requestProgressUpdates": true, "progressInterval": 5}'
   ```

4. Check processing status:
   ```bash
   curl http://localhost:8088/api/video-processing/media/{mediaId}/processing-status \
     -H "Authorization: Bearer {token}"
   ```

5. Get video versions:
   ```bash
   curl http://localhost:8088/api/video-processing/media/{mediaId}/video-versions \
     -H "Authorization: Bearer {token}"
   ```

## API Endpoints

### POST /api/video-processing/media/:id/process-video
Triggers video processing for uploaded media.

**Request Body:**
```json
{
  "requestProgressUpdates": true,
  "progressInterval": 5
}
```

**Response:**
```json
{
  "success": true,
  "job_id": "uuid",
  "message": "Video processing job created successfully"
}
```

### GET /api/video-processing/media/:id/processing-status
Returns current processing status and progress.

**Response:**
```json
{
  "success": true,
  "status": {
    "media_id": "uuid",
    "video_processing_status": "PROCESSING",
    "video_thumbnails": [...],
    "video_versions": [...],
    "video_metadata": {...},
    "latest_job": {
      "job_id": "uuid",
      "status": "PROCESSING",
      "progress": 45,
      "current_step": "generating_thumbnails"
    }
  }
}
```

### GET /api/video-processing/media/:id/video-versions
Returns available video versions and thumbnails.

**Response:**
```json
{
  "success": true,
  "video_versions": [
    {
      "quality": "360p",
      "s3_key": "videos/media_id_360p.mp4",
      "width": 640,
      "height": 360,
      "file_size": 783000
    }
  ],
  "video_thumbnails": [
    {
      "s3_key": "thumbnails/media_id_0.jpg",
      "timestamp": "00:00:15",
      "width": 320,
      "height": 180
    }
  ],
  "video_metadata": {
    "duration": 45,
    "resolution": "1280x720",
    "codec": "h264",
    "bitrate": 168022,
    "framerate": 30
  }
}
```

### GET /api/video-processing/jobs/:jobId
Returns detailed job status.

## Message Format

### Processing Request Message
```json
{
  "type": "video_processing_request",
  "job_id": "uuid",
  "media_id": "uuid",
  "user_id": "uuid",
  "s3_key": "uploads/videos/original.mp4",
  "original_filename": "video.mp4",
  "request_thumbnails": true,
  "request_progress_updates": true,
  "progress_interval": 5,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Progress Update Message
```json
{
  "type": "video_processing_update",
  "job_id": "uuid",
  "media_id": "uuid",
  "status": "processing",
  "progress": 25,
  "current_step": "generating_thumbnails",
  "thumbnails": [...],
  "video_versions": [...],
  "metadata": {...},
  "error_message": null,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Processing Workflow

1. **Upload Video** - User uploads video through Reedi frontend
2. **Store in S3** - Video is stored in S3 bucket
3. **Create Job** - Reedi creates processing job in database
4. **Send Request** - Processing request sent to RabbitMQ
5. **Process Video** - Media processor downloads, processes, and uploads results
6. **Send Updates** - Progress updates sent back to Reedi
7. **Update Database** - Reedi updates job and media records
8. **Complete** - Video versions and thumbnails available for playback

## Error Handling

- Failed processing jobs are marked as `FAILED` with error message
- RabbitMQ messages are acknowledged only after successful processing
- Failed messages are requeued for retry
- S3 upload/download errors are logged and reported back to Reedi

## Monitoring

- Check RabbitMQ management interface: http://localhost:15672
- Monitor processing logs in media processor service
- Check database for job status and error messages
- Monitor S3 bucket for uploaded files

## Troubleshooting

### RabbitMQ Connection Issues
- Ensure RabbitMQ is running: `sudo systemctl status rabbitmq-server`
- Check connection URL in environment variables
- Verify exchanges and queues are created

### S3 Issues
- Verify IDRIVE credentials and permissions
- Check IDRIVE bucket exists and is accessible
- Ensure proper CORS configuration for IDRIVE bucket

### Processing Issues
- Check FFmpeg is installed: `ffmpeg -version`
- Verify temp directory permissions
- Monitor disk space for temporary files
- Check video file format compatibility 