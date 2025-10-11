# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Reedi is a social media platform built with a Next.js frontend, Express/TypeScript backend, and a separate media processing service. The project includes real-time messaging, media galleries, group functionality, and advanced media processing capabilities.

## Architecture

### Frontend (`/frontend`)
- **Framework**: Next.js 14 with TypeScript
- **Styling**: TailwindCSS with custom configurations
- **State Management**: React Query for server state, React hooks for local state
- **UI Components**: Custom components with Headless UI and Lucide React icons
- **Real-time**: Socket.io-client for live updates

### Backend (`/backend`)
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT-based with bcrypt password hashing
- **File Storage**: AWS S3 with chunked upload support
- **Real-time**: Socket.io server
- **Message Queue**: RabbitMQ for background tasks

### Media Processor (`/media-processor`)
- **Purpose**: Standalone service for video/image processing
- **Technology**: FFmpeg for video processing, Sharp for images
- **Queue**: Redis/Bull for job processing
- **Integration**: Communicates with backend via RabbitMQ

### Upload Utility (`/reedi-upload.js`)
- **Purpose**: CLI tool for bulk media uploads
- **Features**: Chunked uploads for large files, progress tracking, authentication

## Development Commands

### Frontend Development
```bash
cd frontend
npm run dev          # Start development server on port 3000
npm run build        # Build production bundle
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking
npm test             # Run Jest tests
```

### Backend Development
```bash
cd backend
npm run dev          # Start development server with tsx watch
npm run build        # Compile TypeScript to dist/
npm run start        # Run compiled JavaScript
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema changes to database
npm run db:migrate   # Create and run migrations
npm run db:studio    # Open Prisma Studio
```

### Media Processor
```bash
cd media-processor
npm run dev          # Start with ts-node-dev
npm run build        # Compile TypeScript
npm run start        # Run compiled version
npm run cleanup      # Clean up temporary files
npm run lint         # Run ESLint
```

## Database Schema

The application uses Prisma with PostgreSQL. Key models include:

- **User**: Authentication, profiles, relationships
- **Post**: Content creation with visibility controls
- **Media**: Image/video storage with processing metadata
- **Gallery**: Media collections
- **Group**: Community features with moderation
- **Message/Conversation**: Real-time messaging
- **Notification**: Activity notifications

Media processing involves complex relationships between `Media`, `MediaProcessingJob`, and various processing statuses.

## API Structure

### Authentication Patterns
- JWT tokens stored in localStorage (frontend)
- Bearer token authentication for API requests
- Token refresh handled automatically in API layer

### Media Handling
- Small files (<5MB): Direct upload via `/media/upload`
- Large files (≥5MB): Chunked multipart upload system
- Media serving via `/api/media/serve/:id` with optional thumbnails
- Progressive JPEG support for optimized loading

### Real-time Features
- Socket.io connections for live updates
- Message delivery status tracking
- Notification broadcasts

## Key Configuration Files

- `frontend/.env`: API URLs, feature flags
- `backend/.env`: Database, S3, JWT secrets
- `media-processor/.env`: Processing queue configuration
- `docker-compose.yml`: Full stack orchestration

## Testing Strategy

- **Frontend**: Jest with React Testing Library
- **Backend**: Manual testing with Postman/API calls
- **Media Processor**: Integration tests for processing pipelines

## Deployment

### Production Build Process
```bash
./build-production.sh    # Builds all services for production
./deploy.sh             # Handles deployment (check script for specifics)
```

### Docker Support
- Individual Dockerfiles for each service
- `docker-compose.yml` for local development
- Production nginx configuration included

## Common Patterns

### Media URL Generation
Use `getMediaUrlFromMedia()` helper for consistent URL generation across the frontend. This handles both legacy path-based URLs and new ID-based serving.

### Error Handling
Backend uses structured error responses with success/error flags. Frontend API layer (`lib/api.ts`) handles these consistently.

### File Upload Flow
1. Frontend uploads via chunked system for large files
2. Backend creates MediaProcessingJob
3. Media processor handles transcoding/optimization
4. Job status updates via RabbitMQ
5. Frontend polls or receives real-time updates

## Environment Variables

### Critical Variables
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Token signing secret
- `AWS_*`: S3 storage credentials
- `RABBITMQ_URL`: Message queue connection
- `NEXT_PUBLIC_API_URL`: Frontend API endpoint

## Development Tips

### Database Changes
Always run `npm run db:generate` after schema changes and `npm run db:push` or `npm run db:migrate` to apply changes.

### Media Processing
Check media-processor logs for processing failures. Use cleanup scripts to manage temporary files.

### Real-time Features
Socket.io connections are established per user session. Check browser network tab for connection issues.