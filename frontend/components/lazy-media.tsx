'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Play, Video, Image as ImageIcon } from 'lucide-react'

interface LazyMediaProps {
  src: string
  alt: string
  mediaType: 'IMAGE' | 'VIDEO'
  className?: string
  style?: React.CSSProperties
  onClick?: (e?: React.MouseEvent) => void
  onLoad?: () => void
  onError?: () => void
  placeholder?: string
  threshold?: number
  rootMargin?: string
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onDragOver?: (e: React.DragEvent) => void
  onDragLeave?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
  onDragEnd?: (e: React.DragEvent) => void
  showProgressiveEffect?: boolean
  thumbnailSrc?: string
  videoUrl?: string
  showVideoControls?: boolean
  autoPlay?: boolean
  muted?: boolean
  loop?: boolean
  isMainMedia?: boolean // New prop to indicate if this is the main media item
  showPlayButton?: boolean // New prop to show play button overlay
}

export function LazyMedia(props: LazyMediaProps): JSX.Element {
  const {
    src,
    alt,
    mediaType,
    className = '',
    style,
    onClick,
    onLoad,
    onError,
    placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5YWFhYSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkxvYWRpbmcuLi48L3RleHQ+PC9zdmc+',
    threshold = 0.1,
    rootMargin = '50px',
    draggable = false,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnd,
    showProgressiveEffect = false,
    thumbnailSrc,
    videoUrl,
    showVideoControls = false,
    autoPlay = false,
    muted = true,
    loop = false,
    isMainMedia = false,
    showPlayButton = true,
    ...restProps
  } = props

  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [isProgressiveLoading, setIsProgressiveLoading] = useState(false)
  const [progressiveQuality, setProgressiveQuality] = useState(0)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [thumbnailError, setThumbnailError] = useState(false)
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const videoObserverRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    const media = mediaRef.current
    if (!media) return

    // Create intersection observer
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          // Once in view, we can stop observing
          if (observerRef.current) {
            observerRef.current.disconnect()
          }
        }
      },
      {
        threshold,
        rootMargin,
      }
    )

    observerRef.current.observe(media)

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
      if (videoObserverRef.current) {
        videoObserverRef.current.disconnect()
      }
    }
  }, [threshold, rootMargin])

  const handleLoad = () => {
    setIsLoaded(true)
    setIsProgressiveLoading(false)
    setProgressiveQuality(100)
    onLoad?.()
  }

  const handleError = () => {
    setHasError(true)
    setIsProgressiveLoading(false)
    onError?.()
  }

  const handleThumbnailError = () => {
    setThumbnailError(true)
  }

  const handleVideoPlay = () => {
    setIsVideoPlaying(true)
  }

  const handleVideoPause = () => {
    setIsVideoPlaying(false)
  }

  // Progressive loading effect (only for images)
  useEffect(() => {
    if (mediaType === 'IMAGE' && showProgressiveEffect && isInView && !isLoaded) {
      setIsProgressiveLoading(true)
      setProgressiveQuality(0)
      
      // Simulate progressive loading stages
      const stages = [10, 25, 50, 75, 90, 100]
      let currentStage = 0
      
      const interval = setInterval(() => {
        if (currentStage < stages.length) {
          setProgressiveQuality(stages[currentStage])
          currentStage++
        } else {
          clearInterval(interval)
        }
      }, 200) // 200ms between stages
      
      return () => clearInterval(interval)
    }
  }, [mediaType, showProgressiveEffect, isInView, isLoaded])

  // Video intersection observer for auto-pause when out of viewport
  useEffect(() => {
    if (mediaType === 'VIDEO' && isMainMedia && isInView) {
      const video = mediaRef.current as HTMLVideoElement
      if (!video) return

      // Create intersection observer for video auto-pause
      videoObserverRef.current = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting && !video.paused) {
            // Video is out of viewport and playing, pause it
            video.pause()
            setIsVideoPlaying(false)
          }
        },
        {
          threshold: 0.1, // Trigger when 10% of video is out of view
          rootMargin: '0px'
        }
      )

      videoObserverRef.current.observe(video)

      return () => {
        if (videoObserverRef.current) {
          videoObserverRef.current.disconnect()
        }
      }
    }
  }, [mediaType, isMainMedia, isInView])

  const mediaSrc = isInView ? src : placeholder

  // Generate a video placeholder SVG
  const generateVideoPlaceholder = () => {
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f3f4f6"/>
        <rect x="50" y="50" width="100" height="100" fill="#e5e7eb" rx="8"/>
        <circle cx="100" cy="100" r="25" fill="#6b7280"/>
        <polygon points="95,90 95,110 115,100" fill="white"/>
        <text x="100" y="140" font-family="Arial, sans-serif" font-size="12" fill="#9ca3af" text-anchor="middle">Video</text>
      </svg>
    `)}`
  }

  if (mediaType === 'VIDEO') {
    // If this is the main media item, show the video player
    if (isMainMedia) {
      return (
        <div className="relative">
          {/* Video element */}
          <video
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            src={videoUrl || src}
            poster={thumbnailError ? generateVideoPlaceholder() : (src || generateVideoPlaceholder())}
            className={className}
            style={{
              ...style,
              opacity: isLoaded ? 1 : 0.7,
              transform: isLoaded ? 'scale(1)' : 'scale(0.98)',
              transition: 'opacity 0.3s ease-out, transform 0.3s ease-out',
            }}
            onClick={(e) => onClick?.(e)}
            onLoadStart={handleLoad}
            onLoadedData={handleLoad}
            onError={handleError}
            onPlay={handleVideoPlay}
            onPause={handleVideoPause}
            controls={showVideoControls}
            autoPlay={autoPlay}
            muted={muted}
            loop={loop}
            draggable={draggable}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
            {...restProps}
          />
          
          {/* Video type indicator */}
          <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-full flex items-center space-x-1">
            <Video className="h-3 w-3" />
            <span>Video</span>
          </div>
        </div>
      )
    }

    // For video thumbnails, show as image with play button overlay
    return (
      <div className="relative group">
        {/* Thumbnail image */}
        <img
          ref={mediaRef as React.RefObject<HTMLImageElement>}
          src={thumbnailError ? generateVideoPlaceholder() : mediaSrc}
          alt={alt}
          className={className}
          style={{
            ...style,
            opacity: isLoaded ? 1 : 0.7,
            transform: isLoaded ? 'scale(1)' : 'scale(0.98)',
            transition: 'opacity 0.3s ease-out, transform 0.3s ease-out',
          }}
          onClick={(e) => onClick?.(e)}
          onLoad={handleLoad}
          onError={handleThumbnailError}
          draggable={draggable}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onDragEnd={onDragEnd}
          {...restProps}
        />
        
        {/* Play button overlay */}
        {showPlayButton && !isVideoPlaying && (
          <div className="absolute inset-0 bg-black bg-opacity-20 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
            <div className="bg-white bg-opacity-90 rounded-full p-3 shadow-lg group-hover:scale-110 transition-transform duration-200">
              <Play className="h-6 w-6 text-gray-800 ml-1" fill="currentColor" />
            </div>
          </div>
        )}
        
        {/* Video type indicator */}
        <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-full flex items-center space-x-1">
          <Video className="h-3 w-3" />
          <span>Video</span>
        </div>
      </div>
    )
  }

  // Image rendering
  return (
    <div className="relative">
      {/* Progressive loading overlay */}
      {showProgressiveEffect && isProgressiveLoading && (
        <div 
          className="absolute inset-0 bg-gray-200 rounded-lg overflow-hidden"
          style={{
            opacity: isLoaded ? 0 : 1,
            transition: 'opacity 0.3s ease-out'
          }}
        >
          {/* Blur effect that gets sharper as quality improves */}
          <div 
            className="w-full h-full bg-gray-300"
            style={{
              filter: `blur(${Math.max(0, 20 - (progressiveQuality / 5))}px)`,
              transition: 'filter 0.2s ease-out'
            }}
          />
          {/* Quality indicator */}
          <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
            {progressiveQuality}%
          </div>
        </div>
      )}
      
      {/* Main image */}
      <img
        ref={mediaRef as React.RefObject<HTMLImageElement>}
        src={mediaSrc}
        alt={alt}
        className={className}
        style={{
          ...style,
          opacity: isLoaded ? 1 : (showProgressiveEffect ? 0.8 : 0.7),
          transform: isLoaded ? 'scale(1)' : 'scale(0.98)',
          transition: 'opacity 0.3s ease-out, transform 0.3s ease-out',
          filter: showProgressiveEffect && isProgressiveLoading ? `blur(${Math.max(0, 10 - (progressiveQuality / 10))}px)` : 'none'
        }}
        onClick={(e) => onClick?.(e)}
        onLoad={handleLoad}
        onError={handleError}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        {...restProps}
      />
    </div>
  )
} 