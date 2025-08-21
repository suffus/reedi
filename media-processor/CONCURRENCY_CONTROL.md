# Concurrency Control in Media Processor

## Overview

The media processor now implements intelligent concurrency control that automatically manages RabbitMQ subscriptions based on the current processing load. This ensures that the system never processes more than a configurable maximum number of videos/images simultaneously, while maintaining optimal queue performance.

## How It Works

### 1. **Immediate Message Acknowledgment**
- Messages are acknowledged immediately upon receipt from RabbitMQ
- This prevents RabbitMQ from redelivering messages due to timeouts
- Messages are queued internally for processing

### 2. **Concurrency Tracking**
- Each service tracks active jobs using a `Set<string>`
- Jobs are counted when they start processing and removed when they complete
- The system maintains an accurate count of currently processing media

### 3. **Dynamic Subscription Management**
- **At Capacity**: When the number of active jobs reaches the maximum, the service unsubscribes from its own RabbitMQ queues
- **Below Capacity**: When jobs complete and capacity becomes available, the service resubscribes to its queues
- **Independent**: Each service manages only its own queues, so video processing doesn't affect image processing
- **Automatic**: This happens automatically without manual intervention

### 4. **Queue Behavior During High Load**
- Messages continue to accumulate in RabbitMQ queues when the processor is at capacity
- No messages are lost - they're preserved until processing capacity becomes available
- The queue acts as a natural buffer during high load periods

## Configuration

### Environment Variables

```bash
# Maximum number of concurrent video processing jobs
MAX_CONCURRENT_VIDEO_JOBS=3

# Maximum number of concurrent image processing jobs
MAX_CONCURRENT_IMAGE_JOBS=10

# Defaults: 3 for video, 10 for image if not specified
```

### Service Configuration

Each service has its own independent concurrency limit:
- **Video Processing Service**: Limits concurrent video processing jobs (default: 3)
- **Image Processing Service**: Limits concurrent image processing jobs (default: 10)

**Why Different Limits?**
- Video processing is CPU and memory intensive, requiring careful resource management
- Image processing is much lighter and can handle higher concurrency
- Independent limits ensure that heavy video processing doesn't block lightweight image processing

## Benefits

### 1. **Independent Resource Management**
- Video and image processing have separate concurrency limits
- Video processing at capacity doesn't block image processing
- Image processing at capacity doesn't block video processing
- Each service can operate at its optimal capacity independently

### 2. **Resource Protection**
- Prevents system overload by limiting concurrent processing
- Ensures stable performance under high load
- Protects against memory and CPU exhaustion

### 2. **Queue Resilience**
- Messages are never lost due to processor overload
- Natural backpressure handling through queue accumulation
- System can handle traffic spikes gracefully

### 3. **Operational Simplicity**
- No manual intervention required
- Automatic scaling based on current load
- Clear visibility into processing capacity

### 4. **Fault Tolerance**
- If the processor crashes, unprocessed messages remain in RabbitMQ
- Messages can be manually resubmitted if needed
- No automatic redelivery that could cause duplicate processing

### 5. **Service Independence**
- Video and image processing services operate completely independently
- Heavy video processing doesn't impact lightweight image processing
- Each service can be scaled and managed separately

## Monitoring

### Health Check Endpoint

```http
GET /health
```

Response includes concurrency information:

```json
{
  "status": "OK",
  "service": "video-processing",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "rabbitmq": true,
  "concurrency": {
    "video": {
      "maxConcurrentJobs": 3,
      "activeJobs": 2
    },
    "image": {
      "maxConcurrentJobs": 10,
      "activeJobs": 1
    }
  }
}
```

### Log Messages

The system logs all subscription changes:

```
INFO: Concurrency check: 3/3 active jobs, at capacity: true
INFO: Unsubscribed from queue video.processing.download due to capacity limit
INFO: Unsubscribed from queue video.processing.processing due to capacity limit
INFO: Unsubscribed from queue video.processing.upload due to capacity limit

INFO: Concurrency check: 2/3 active jobs, at capacity: false
INFO: Resubscribed to queue video.processing.download - capacity available
INFO: Resubscribed to queue video.processing.processing - capacity available
INFO: Resubscribed to queue video.processing.upload - capacity available
```

## Architecture Details

### Service Structure

```
StagedVideoProcessingService (max 3 concurrent)
├── maxConcurrentJobs: number
├── activeJobs: Set<string>
├── jobCallbacks: Map<string, Function>
└── checkConcurrencyAndManageSubscriptions()
    ├── unsubscribeFromAllQueues() // Only video queues
    └── resubscribeToAllQueues()   // Only video queues

StagedImageProcessingService (max 10 concurrent)
├── maxConcurrentJobs: number
├── activeJobs: Set<string>
├── jobCallbacks: Map<string, Function>
└── checkConcurrencyAndManageSubscriptions()
    ├── unsubscribeFromAllQueues() // Only image queues
    └── resubscribeToAllQueues()   // Only image queues
```

### Independent Operation

- **Video Service**: Manages only video processing queues
- **Image Service**: Manages only image processing queues
- **No Cross-Service Dependencies**: Each service operates independently
- **Separate Concurrency Limits**: Can be tuned independently based on system capabilities

### Queue Management

**Video Processing Queues:**
- **Download Queue**: Handles S3 video downloads
- **Processing Queue**: Handles FFmpeg video processing
- **Upload Queue**: Handles S3 video uploads
- **Updates Queue**: Handles video progress updates

**Image Processing Queues:**
- **Download Queue**: Handles S3 image downloads
- **Processing Queue**: Handles image processing
- **Upload Queue**: Handles S3 image uploads
- **Updates Queue**: Handles image progress updates

**Independent Management:**
- Each service manages only its own queues
- Video processing at capacity doesn't affect image queue subscriptions
- Image processing at capacity doesn't affect video queue subscriptions

## Testing

### Manual Test

```bash
# Build the project
npm run build

# Run the concurrency test
node test-concurrency.js
```

### Expected Behavior

**Video Processing (max 3 concurrent):**
1. Start 3 video jobs → Video queues unsubscribed
2. Start 2 more video jobs → Still unsubscribed (at capacity)
3. Finish 2 video jobs → Video queues resubscribed (below capacity)

**Image Processing (max 10 concurrent):**
1. Start 10 image jobs → Image queues unsubscribed
2. Start 5 more image jobs → Still unsubscribed (at capacity)
3. Finish 5 image jobs → Image queues resubscribed (below capacity)

**Independent Operation:**
- Video processing at capacity doesn't affect image processing
- Image processing at capacity doesn't affect video processing
- Each service manages only its own queues

## Troubleshooting

### Common Issues

1. **Jobs not processing**: Check if queues are unsubscribed due to capacity
2. **High queue depth**: Normal during high load - will process when capacity available
3. **Subscription errors**: Check RabbitMQ connection and permissions

### Debug Commands

```bash
# Check current concurrency status
curl http://localhost:8044/health

# Monitor logs for subscription changes
tail -f logs/media-processor.log | grep "Concurrency check\|subscribed\|unsubscribed"
```

## Configuration Recommendations

### Concurrency Limits

**Video Processing**: Start with 3 concurrent jobs
- Video processing is CPU and memory intensive
- 3 concurrent jobs typically provide good resource utilization
- Increase only if you have high-end hardware and monitoring shows underutilization

**Image Processing**: Start with 10 concurrent jobs
- Image processing is much lighter than video processing
- 10 concurrent jobs can typically run without significant resource contention
- Can be increased to 15-20 on systems with good I/O performance

### Monitoring and Tuning

1. **Watch the health endpoint**: Monitor `/health` for active job counts
2. **Check queue depths**: High queue depths indicate processing bottlenecks
3. **Monitor system resources**: CPU, memory, and I/O usage during processing
4. **Adjust gradually**: Change limits by 1-2 at a time and monitor impact

## Future Enhancements

1. **Per-queue concurrency limits**: Different limits for different stages
2. **Priority queuing**: Process high-priority jobs first
3. **Dynamic scaling**: Adjust concurrency based on system resources
4. **Metrics collection**: Track processing times and queue depths
5. **Alerting**: Notify when queues are consistently at capacity

## Implementation Notes

- Uses RabbitMQ's `channel.cancel()` for clean unsubscription
- Maintains callback references for resubscription
- Thread-safe job counting with Set operations
- Graceful error handling for subscription operations
- Comprehensive logging for operational visibility
