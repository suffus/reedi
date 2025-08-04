# Socket.io + Nginx Setup Guide

## Overview
This guide explains how to configure Nginx to properly handle Socket.io WebSocket connections for the Reedi messaging service.

## Nginx Configuration

### 1. Updated nginx.conf
The main Nginx configuration has been updated to include a dedicated location block for Socket.io connections:

```nginx
# Socket.io WebSocket connections
location /socket.io/ {
    proxy_pass http://fb-backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # WebSocket specific settings
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 86400;
    proxy_send_timeout 86400;
    
    # Socket.io specific headers
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Server $host;
}
```

### 2. Key Configuration Details

#### WebSocket Headers
- `Upgrade $http_upgrade`: Enables WebSocket upgrade
- `Connection "upgrade"`: Tells the server to upgrade the connection
- `proxy_http_version 1.1`: Required for WebSocket support

#### Timeout Settings
- `proxy_read_timeout 86400`: 24-hour read timeout for persistent connections
- `proxy_send_timeout 86400`: 24-hour send timeout for persistent connections

#### Buffering Settings
- `proxy_buffering off`: Disables buffering for real-time communication
- `proxy_cache off`: Disables caching for WebSocket connections

## Environment Variables

### Frontend (.env.local)
Add the following environment variable to your frontend:

```bash
# For development
NEXT_PUBLIC_SOCKET_URL=http://localhost:8088

# For production (replace with your domain)
NEXT_PUBLIC_SOCKET_URL=https://your-domain.com
```

### Backend (.env)
Ensure your backend has the correct CORS settings:

```bash
# Frontend URL for CORS
FRONTEND_URL=https://your-domain.com

# API URL
API_URL=https://your-domain.com
```

## Socket.io Backend Configuration

The backend Socket.io service is configured with CORS to allow connections from the frontend:

```typescript
this.io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  }
});
```

## Testing the Setup

### 1. Development Testing
1. Start your backend server on port 8088
2. Start your frontend on port 3000
3. Open browser dev tools and check the Network tab
4. Navigate to the messaging page
5. Look for WebSocket connections to `/socket.io/`

### 2. Production Testing
1. Deploy with the updated Nginx configuration
2. Set the `NEXT_PUBLIC_SOCKET_URL` environment variable
3. Test WebSocket connections through your domain
4. Monitor Nginx logs for any connection issues

## Troubleshooting

### Common Issues

#### 1. WebSocket Connection Fails
- Check that the `/socket.io/` location block is properly configured
- Verify the backend server is running and accessible
- Check CORS settings in the backend

#### 2. Connection Timeouts
- Ensure `proxy_read_timeout` and `proxy_send_timeout` are set to high values
- Check for any firewall rules blocking WebSocket connections

#### 3. CORS Errors
- Verify the `FRONTEND_URL` environment variable is set correctly
- Check that the frontend domain matches the CORS origin

### Debug Commands

#### Check Nginx Configuration
```bash
nginx -t
```

#### Monitor Nginx Logs
```bash
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

#### Test WebSocket Connection
```bash
# Using curl to test WebSocket upgrade
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Host: your-domain.com" -H "Origin: https://your-domain.com" https://your-domain.com/socket.io/
```

## Security Considerations

### 1. Rate Limiting
Consider adding rate limiting for WebSocket connections:

```nginx
# Add to the socket.io location block
limit_req zone=websocket burst=10 nodelay;
```

### 2. SSL/TLS
For production, always use HTTPS/WSS connections:

```nginx
# In the HTTPS server block
location /socket.io/ {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    # ... other settings
}
```

### 3. Authentication
The Socket.io connection includes JWT authentication:

```typescript
const socket = io(socketUrl, {
  auth: { token },
  transports: ['websocket', 'polling']
});
```

## Performance Optimization

### 1. Connection Pooling
For high-traffic applications, consider using connection pooling:

```nginx
upstream backend {
    server backend1:8088;
    server backend2:8088;
    server backend3:8088;
}
```

### 2. Load Balancing
Socket.io supports sticky sessions for load balancing:

```nginx
upstream backend {
    ip_hash;  # Ensures same client goes to same server
    server backend1:8088;
    server backend2:8088;
}
```

## Monitoring

### 1. Connection Metrics
Monitor WebSocket connections in your application:

```typescript
// In your Socket.io service
this.io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  console.log('Total connections:', this.io.engine.clientsCount);
});
```

### 2. Nginx Metrics
Monitor Nginx for WebSocket traffic:

```bash
# Count WebSocket upgrade requests
grep "Upgrade: websocket" /var/log/nginx/access.log | wc -l
```

This configuration ensures that your Socket.io messaging service works seamlessly with Nginx in both development and production environments. 