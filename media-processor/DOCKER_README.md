# Media Processor Docker Setup

This directory contains Docker configuration for running the Reedi Media Processor as a standalone service.

## Quick Start

### 1. Build and Run with Docker Compose (Recommended)

```bash
# Copy environment variables
cp env.example .env

# Edit .env with your configuration
nano .env

# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f media-processor
```

### 2. Build Docker Image Manually

```bash
# Build the image
docker build -t reedi-media-processor .

# Run the container
docker run -d \
  --name reedi-media-processor \
  -p 8044:8044 \
  --env-file .env \
  reedi-media-processor
```

## Environment Variables

Create a `.env` file based on `env.example` with the following required variables:

### Required Variables
```bash
# IDRIVE S3 Configuration
IDRIVE_REGION=us-east-1
IDRIVE_ENDPOINT=https://your-idrive-endpoint.com
IDRIVE_ACCESS_KEY_ID=your_access_key_id
IDRIVE_SECRET_ACCESS_KEY=your_secret_access_key
IDRIVE_BUCKET_NAME=your_bucket_name

# API Backend Configuration
API_BASE_URL=http://host.docker.internal:8088
```

### Optional Variables (with defaults)
```bash
# RabbitMQ Configuration
RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest

# Processing Configuration
MAX_CONCURRENT_JOBS=3
VIDEO_MAX_DURATION=300
VIDEO_MAX_FILE_SIZE=500000000
IMAGE_MAX_FILE_SIZE=50000000

# Video Processing Settings
VIDEO_QUALITIES=1080p,720p,480p
VIDEO_BITRATES=5000k,2500k,1000k
THUMBNAIL_TIME=00:00:05

# Logging
LOG_LEVEL=info
```

## Services Included

### Media Processor
- **Port**: 8044
- **Health Check**: `http://localhost:8044/health`
- **Features**: Video processing, thumbnail generation, S3 integration

### RabbitMQ
- **Port**: 5672 (AMQP), 15672 (Management UI)
- **Management UI**: `http://localhost:15672`
- **Default Credentials**: guest/guest

## Docker Commands

### Build
```bash
# Build with docker-compose
docker-compose build

# Build manually
docker build -t reedi-media-processor .
```

### Run
```bash
# Start all services
docker-compose up -d

# Start only media processor (if RabbitMQ is running elsewhere)
docker-compose up -d media-processor
```

### Stop
```bash
# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### Logs
```bash
# View all logs
docker-compose logs

# Follow media processor logs
docker-compose logs -f media-processor

# View specific service logs
docker-compose logs rabbitmq
```

### Shell Access
```bash
# Access media processor container
docker-compose exec media-processor sh

# Access RabbitMQ container
docker-compose exec rabbitmq sh
```

## Health Checks

The media processor includes a health check endpoint:

```bash
# Check health
curl http://localhost:8044/health

# Expected response
{"status":"healthy","service":"media-processor","timestamp":"2025-07-29T08:25:15.067Z"}
```

## Troubleshooting

### Common Issues

1. **FFmpeg not found**
   - The Dockerfile includes FFmpeg binaries
   - Verify with: `docker-compose exec media-processor ffmpeg -version`

2. **RabbitMQ connection failed**
   - Check RabbitMQ is running: `docker-compose ps`
   - Check logs: `docker-compose logs rabbitmq`

3. **S3 connection issues**
   - Verify environment variables are set correctly
   - Check network connectivity from container

4. **Permission issues**
   - The container runs as non-root user (nodejs:1001)
   - Ensure volume mounts have correct permissions

### Debug Commands

```bash
# Check container status
docker-compose ps

# View resource usage
docker stats

# Check container logs
docker-compose logs media-processor

# Access container shell
docker-compose exec media-processor sh

# Test FFmpeg
docker-compose exec media-processor ffmpeg -version

# Test Node.js
docker-compose exec media-processor node --version
```

## Production Deployment

For production deployment:

1. **Use proper secrets management**
   ```bash
   # Use Docker secrets or external secret management
   docker secret create idrive_access_key_id ./secrets/access_key_id
   ```

2. **Configure proper networking**
   ```bash
   # Use external networks for service discovery
   docker network create reedi-network
   ```

3. **Set up monitoring**
   ```bash
   # Add monitoring containers (Prometheus, Grafana, etc.)
   # Configure log aggregation
   ```

4. **Resource limits**
   ```yaml
   # Add to docker-compose.yml
   deploy:
     resources:
       limits:
         memory: 2G
         cpus: '2.0'
   ```

## Development

For development with hot reloading:

```bash
# Run in development mode
docker-compose -f docker-compose.dev.yml up

# Or mount source code for live development
docker run -it \
  -v $(pwd)/src:/app/src \
  -v $(pwd)/package.json:/app/package.json \
  -p 8044:8044 \
  --env-file .env \
  reedi-media-processor npm run dev
``` 