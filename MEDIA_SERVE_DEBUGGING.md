# MediaServe Routes Debugging Implementation

## Overview
This document describes the logging implementation added to debug the mediaServe routes unresponsiveness issue. The implementation focuses on testing two key hypotheses:

1. **Stream Errors and Hanging Connections** - Comprehensive stream error handling and connection tracking
2. **Database Connection Pool Saturation** - Database query performance monitoring and connection pool tracking

## What Was Added

### 1. Stream Error Monitoring (Hypothesis 2)
- **Connection Tracking**: Each stream request gets a unique ID for tracing
- **Stream Event Logging**: Logs all stream lifecycle events (start, error, end, close)
- **Response Event Logging**: Logs all response lifecycle events (error, close, finish)
- **Connection Statistics**: Tracks active, total, and failed connections
- **Automatic Cleanup**: Ensures connections are properly closed even on errors
- **Connection Timeouts**: 30-second timeout for videos, 15-second for images to prevent hanging
- **Client Disconnect Detection**: Handles client disconnections and request abortions
- **Guaranteed Cleanup**: Each connection can only be cleaned up once, preventing negative counts

### 2. Database Performance Monitoring (Hypothesis 3)
- **Query Timing**: Measures database query execution time
- **Permission Check Timing**: Tracks permission verification performance
- **S3 Operation Timing**: Measures S3 fetch operations
- **Connection Pool Monitoring**: Tracks active database connections
- **Overall Request Timing**: Measures total request processing time

## Log Format

### Stream Operations
```
🎥 [123] Starting video stream for uploads/user123/1234567890.mp4
🎥 [123] S3 request prepared, sending command...
🎥 [123] S3 response received, setting up stream...
🎥 [123] Starting pipe operation...
🎥 [123] Stream ended successfully
🎥 [123] Response finished successfully
🎥 [123] Connection cleaned up, active connections: 5
```

### Image Operations
```
🖼️ [123] Starting image stream for uploads/user123/1234567890.jpg
🖼️ [123] S3 request prepared, sending command...
🖼️ [123] S3 response received, setting up stream...
🖼️ [123] Starting pipe operation...
🖼️ [123] Stream ended successfully
🖼️ [123] Response finished successfully
🖼️ [123] Connection cleaned up, active connections: 3
```

### Media Requests
```
📺 [123] Media serve request started for user: user123
📺 [123] Starting database queries...
📺 [123] Database queries completed in 45ms
📺 [123] Media type: VIDEO, Processing status: COMPLETED
📺 [123] Serving media with S3 key: uploads/user123/1234567890.mp4
```

### Thumbnail Requests
```
🖼️ [123] Thumbnail request started for user: user123
🖼️ [123] Checking permissions...
🖼️ [123] Permission check completed in 23ms, result: true
🖼️ [123] Fetching media from database...
🖼️ [123] Database query completed in 12ms
🖼️ [123] Using processed video thumbnail: uploads/user123/1234567890_thumb.jpg
🖼️ [123] Fetching thumbnail from S3: uploads/user123/1234567890_thumb.jpg
🖼️ [123] S3 fetch completed in 156ms, buffer size: 45678 bytes
🖼️ [123] Thumbnail served successfully in 234ms
```

### Connection Statistics
```
🔗 MediaServe Connection Stats: Active: 5, Total: 1234, Failed: 12
```

### Database Health
```
📊 Database Health: 5678 requests, 23 errors, Pool: 8 active connections
```

### Connection Timeouts and Disconnections
```
🎥 [123] Client disconnected
🎥 [123] Connection cleaned up, active connections: 4
🎥 [124] Connection timeout - forcing cleanup
🎥 [124] Connection cleaned up, active connections: 3
```

## How to Use

### 1. Deploy the Changes
The logging has been added to the existing codebase. Deploy these changes to your production environment.

### 2. Monitor During Normal Operation
Watch the logs during normal operation to establish baseline performance:
- Typical database query times
- Typical S3 operation times
- Normal connection counts
- Connection cleanup patterns

### 3. Monitor During Unresponsiveness
When the mediaServe routes become unresponsive, check for:

#### Stream Issues (Hypothesis 2)
- High number of active connections that never decrease
- Stream errors that don't properly close connections
- Connections stuck in "Starting pipe operation" state
- Failed connections accumulating
- **NEW**: Connection timeouts forcing cleanup
- **NEW**: Client disconnections being detected

#### Database Issues (Hypothesis 3)
- Database query times suddenly increasing
- High number of active database connections
- Permission checks taking unusually long
- Database health check failures

### 4. Key Metrics to Watch

#### Connection Health
- **Active Connections**: Should return to 0 after each request
- **Failed Connections**: Should be low relative to total connections
- **Connection Duration**: Should complete within reasonable time
- **Connection Cleanup**: Should see "Connection cleaned up" for every request

#### Performance Thresholds
- **Database Queries**: Should complete in <100ms normally
- **S3 Operations**: Should complete in <500ms for images, <2s for videos
- **Total Request Time**: Should complete in <1s for images, <5s for videos
- **Connection Timeouts**: Videos timeout after 30s, images after 15s

## Expected Findings

### If Hypothesis 2 is Correct (Stream Errors)
You should see:
- Connections stuck in "Starting pipe operation" state
- High active connection counts that don't decrease
- Stream error events without proper cleanup
- Failed connections accumulating over time
- **NEW**: Connection timeouts being triggered
- **NEW**: Client disconnections being detected

### If Hypothesis 3 is Correct (Database Pool Saturation)
You should see:
- Database query times increasing dramatically
- Permission checks taking longer and longer
- High active database connection counts
- Database health check failures

## Connection Lifecycle Improvements

### Timeout Protection
- **Videos**: 30-second timeout with automatic cleanup
- **Images**: 15-second timeout with automatic cleanup
- **Forced Cleanup**: Prevents connections from hanging indefinitely

### Client Disconnect Detection
- **Request Close**: Detects when client closes the connection
- **Request Abort**: Detects when client aborts the request
- **Automatic Cleanup**: Ensures server-side cleanup even on client disconnect

### Guaranteed Cleanup
- **Single Cleanup**: Each connection can only be cleaned up once
- **Event-Driven**: Multiple cleanup events won't cause negative counts
- **Timeout Fallback**: Timeout ensures cleanup even if events don't fire

## Next Steps After Analysis

### For Stream Issues
1. **Already Implemented**: Connection timeouts and disconnect detection
2. Implement retry logic for failed streams
3. Implement circuit breaker pattern
4. Add request queuing for high load

### For Database Issues
1. Optimize database queries
2. Implement connection pooling improvements
3. Add database read replicas
4. Implement caching for permission checks

## Monitoring Commands

### View Real-time Logs
```bash
# Follow backend logs
docker logs -f reedi-backend

# Filter for media serve logs
docker logs -f reedi-backend | grep -E "(🎥|🖼️|📺|🔗|📊)"

# Filter for connection timeouts and disconnections
docker logs -f reedi-backend | grep -E "(timeout|disconnected|aborted)"
```

### Check Connection Status
```bash
# Check active connections in database
docker exec -it reedi-postgres psql -U postgres -d reedi -c "SELECT count(*) as active_connections FROM pg_stat_activity WHERE state = 'active';"
```

## Notes
- The logging is designed to be lightweight and not impact performance significantly
- Connection tracking uses simple counters that reset on server restart
- Database pool monitoring may not work on all Prisma versions
- **NEW**: Connection timeouts prevent indefinite hanging
- **NEW**: Client disconnect detection improves cleanup reliability
- Consider removing detailed logging after identifying the root cause
