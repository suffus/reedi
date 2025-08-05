'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Play, Video } from 'lucide-react'

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
    ...restProps
  } = props

  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [isProgressiveLoading, setIsProgressiveLoading] = useState(false)
  const [progressiveQuality, setProgressiveQuality] = useState(0)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

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

  const mediaSrc = isInView ? src : placeholder

  if (mediaType === 'VIDEO') {
    return (
      <div className="relative">
        {/* Video element */}
        <video
          ref={mediaRef as React.RefObject<HTMLVideoElement>}
          src={videoUrl || src}
          poster={src} // Use the thumbnail as poster
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
        
        {/* Video play overlay when not playing - REMOVED since we have video indicator */}
        
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