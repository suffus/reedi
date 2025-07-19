# Production Deployment Guide

This guide explains how to deploy Reedi in production with nginx serving static content and Next.js serving dynamic content.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Nginx (80)    │    │  Next.js (3000) │    │ Backend (8088)  │
│                 │    │                 │    │                 │
│ • Static files  │◄──►│ • Dynamic pages │◄──►│ • API endpoints │
│ • Reverse proxy │    │ • SSR routes    │    │ • Database      │
│ • Load balancer │    │ • API routes    │    │ • File storage  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Components

### 1. Nginx Container (`nginx`)
- **Purpose**: Reverse proxy and static file server
- **Port**: 80 (external)
- **Responsibilities**:
  - Serve static assets (JS, CSS, images, fonts)
  - Proxy API requests to backend
  - Proxy dynamic requests to Next.js
  - Handle SSL termination (in production)
  - Load balancing (if multiple instances)

### 2. Next.js Container (`nextjs`)
- **Purpose**: Dynamic content and server-side rendering
- **Port**: 3000 (internal)
- **Responsibilities**:
  - Server-side rendering for dynamic pages
  - API routes (if any)
  - Dashboard pages
  - User profile pages
  - Search functionality

### 3. Backend Container (`backend`)
- **Purpose**: API server and business logic
- **Port**: 8088 (internal)
- **Responsibilities**:
  - REST API endpoints
  - Database operations
  - File uploads
  - Authentication
  - Image processing

## Deployment Steps

### 1. Build and Deploy

```bash
# Build and start all services
docker-compose up --build -d

# Or build and start step by step
docker-compose build
docker-compose up -d
```

### 2. Check Service Status

```bash
# Check all containers are running
docker-compose ps

# Check logs
docker-compose logs nginx
docker-compose logs nextjs
docker-compose logs backend
```

### 3. Access the Application

- **Main Application**: http://localhost
- **Backend API**: http://localhost/api
- **Health Check**: http://localhost/health

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Database
POSTGRES_PASSWORD=your-secure-password

# JWT
JWT_SECRET=your-jwt-secret-key

# NextAuth (if using)
NEXTAUTH_URL=http://your-domain.com
NEXTAUTH_SECRET=your-nextauth-secret

# API URLs (for external access)
NEXT_PUBLIC_API_URL=http://your-domain.com/api
NEXT_PUBLIC_BACKEND_URL=http://your-domain.com
NEXT_PUBLIC_IMAGE_BASE_URL=http://your-domain.com
```

### Production Considerations

1. **SSL/TLS**: Add SSL certificates to nginx
2. **Domain**: Update `server_name` in nginx config
3. **Security**: Use strong passwords and secrets
4. **Monitoring**: Add health checks and logging
5. **Backup**: Set up database backups
6. **Scaling**: Consider horizontal scaling for high traffic

## Troubleshooting

### Common Issues

1. **Static files not loading**
   - Check if `.next/static` files are copied to nginx
   - Verify nginx configuration

2. **Dynamic routes not working**
   - Ensure Next.js container is running
   - Check nginx proxy configuration

3. **API requests failing**
   - Verify backend container is running
   - Check network connectivity between containers

### Debug Commands

```bash
# Check container logs
docker-compose logs -f [service-name]

# Access container shell
docker-compose exec [service-name] sh

# Check network connectivity
docker-compose exec nginx ping nextjs
docker-compose exec nginx ping backend

# Test nginx configuration
docker-compose exec nginx nginx -t
```

## Performance Optimization

1. **Static Assets**: Nginx serves static files with long cache headers
2. **Gzip Compression**: Enabled for all text-based content
3. **Load Balancing**: Can be extended with multiple Next.js instances
4. **CDN**: Static assets can be served from a CDN

## Security Features

1. **Container Isolation**: Each service runs in its own container
2. **Network Security**: Internal communication only
3. **Security Headers**: XSS protection, content type options, etc.
4. **No Root Access**: Services run as non-root users 