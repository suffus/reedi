# Specification of Video Upload Features for Reedi

Videos are to be uploadable and shareable in posts and galleries just as images are.  
When uploaded, videos will be processed and added to the user's gallery, just like images.
Just like immages, videos may have a title, description and tags.  Just like images,
videos may be added to posts and galleries.

## Implementation plan

1  Renaming the Image schema to Media.

1.1 First we shall rename the Image schema and table to Media in the backend (in prisma as well as the source code).  We shall extend the new Media model (renamed from Image) by adding various video-specific fields such as duration, codec, bitrate and framerate.  We shall also add a mediaType enum field to distinguish video from images.  There should also be a processing status field for videos including the enum states PENDING, PROCESSING, COMPLETED, REJECTED and FAILED. 

1.2  Rename PostImage as PostMedia for semantic coherence, but no new fields are needed.

1.2 Rename /images route to /media, and add support for uploading videos to /media/upload.  Other /images route methods should be renamed /media, and return types should be extended to reflect the fields we have added to the model.  The /images/upload route shoudl be renamed /media/upload, and support the uploading of videos.  In the case of videos they should be enetered into the Media table with a status of PENDING.  The imageServe (/images/serve) routes should be renamed to /media/serve, and /image/serve/{id}/thumbnail renamed to /media/serve/{id}/thumbnail.  For streaming video a /media/serve/{id}/stream route should be added.

1.3  The frontend models and hooks for RawImage and GalleryImage should be updated and renamed as Media and GalleryMedia, and made to work with the new routes.  We shall not yet add frontend support for streaming videos because we want to test several technologies first to see what works best.  

2  Implement a video processing pipe

2.1 Once videos are uploaded, they go into the PENDING state and a message is sent to the VideoProcessing service to generate different sized versions for streaming, to generate thumbnails and to add and/or extract metadata. This service will also publish the processed media to a content distribution network for more efficient streaming.  This shall be architected as a separate "media-processor" backend which communicates with the existing web application backend via a message queue and/or web hooks.




#Implementation Plan for Video Features

## Phase 1: Database Schema Migration (Backend)

1.1. Prisma Schema Updates
Rename Image model to Media and add video-specific fields:
Apply to video-featur...
Rename PostImage to PostMedia for semantic coherence
Update all related models (User, Gallery, Comment) to reference Media instead of Image

1.2. Database Migration
Create Prisma migration to:
Rename images table to media
Add new video-specific columns
Add new enums
Rename post_images table to post_media
Update all foreign key references

## Phase 2: Backend API Updates
2.1 Route Renaming and Extension
Rename /images routes to /media:
GET /api/images/* → GET /api/media/*
POST /api/images/upload → POST /api/media/upload
DELETE /api/images/:id → DELETE /api/media/:id
Update /imageServe to /mediaServe:
GET /api/images/serve/:id → GET /api/media/serve/:id
GET /api/images/serve/:id/thumbnail → GET /api/media/serve/:id/thumbnail
Add new video streaming route: GET /api/media/serve/:id/stream

2.2 Upload Handler Updates
Extend file upload validation to accept video formats:
Supported formats: MP4, WebM, MOV, AVI, MPEG-1, MPEG-2 (legacy formats will be automatically converted to MP4 for browser compatibility)
Increase file size limit to 500MB for videos
Add video-specific validation (duration limits, codec checks)
Update upload processing:
For images: Process immediately (existing flow)
For videos: Store with PENDING status, trigger async processing

2.3 New Video Processing Service
Create separate media-processor service:
Accepts processing requests via message queue (Redis/RabbitMQ)
Generates multiple video qualities (1080p, 720p, 480p)
Extracts video metadata (duration, codec, bitrate, framerate)
Generates video thumbnails
Uploads processed videos to CDN/S3
Updates media record with processing results


Phase 3: Frontend Updates
3.1 Type System Updates
Update lib/types.ts:
Apply to video-featur...
3.2 API Hooks Updates
Rename and update all image-related hooks:
useUserImages → useUserMedia
useUploadImage → useUploadMedia
useDeleteImage → useDeleteMedia
Add video-specific functionality (streaming, processing status)
3.3 Component Updates
Update upload components to handle video files:
ImageUploader → MediaUploader
Add video preview capabilities
Show processing status for videos
Update display components:
ImageGrid → MediaGrid
LazyImage → LazyMedia
Add video player component for video playback
Phase 4: Video Processing Infrastructure
4.1 Media Processor Service
Create standalone service with:
FFmpeg integration for video processing
Multiple quality generation
Thumbnail extraction
Metadata extraction
Progress tracking and status updates
4.2 Message Queue Integration
Implement async processing:
Redis/RabbitMQ for job queuing
Webhook callbacks for status updates
Retry logic for failed processing
4.3 CDN Integration
Set up content distribution:
CloudFront/Akamai for video streaming
Multiple quality streams for adaptive bitrate
Caching strategies for processed videos
Phase 5: Video Playback Features
5.1 Video Player Component
Create custom video player with:
HTML5 video element integration
Custom controls and styling
Fullscreen support
Quality selection (when multiple qualities available)
Progress tracking
5.2 Streaming Implementation
Implement video streaming:
Range request support
Adaptive bitrate streaming
Thumbnail generation for video scrubbing
Mobile-optimized playback
Phase 6: Testing and Optimization
6.1 Testing Strategy
Unit tests for all new components and utilities
Integration tests for video upload and processing pipeline
Performance tests for video streaming
Cross-browser testing for video playback
6.2 Performance Optimization
Video optimization:
Efficient encoding settings
Compression optimization
Lazy loading for video thumbnails
Progressive loading for video content
Implementation Order
Start with Phase 1 (Database schema) - This is foundational
Phase 2 (Backend API) - Core functionality
Phase 3 (Frontend types/hooks) - Basic integration
Phase 4 (Video processing) - Advanced features
Phase 5 (Video playback) - User experience
Phase 6 (Testing/optimization) - Quality assurance
Key Considerations
Backward compatibility: Ensure existing image functionality continues to work
Gradual migration: Implement changes incrementally to minimize disruption
Error handling: Robust error handling for video processing failures
Security: Validate video files and prevent malicious uploads
Performance: Optimize for large video files and streaming
Mobile support: Ensure video playback works well on mobile devices
This plan provides a structured approach to implementing video features while maintaining the existing image functionality and ensuring a smooth user experience throughout the transition