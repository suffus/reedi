'use client'

import React, { useState, useRef, useEffect } from 'react'

interface LazyImageProps {
  src: string
  alt: string
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
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
}

export function LazyImage(props: LazyImageProps): JSX.Element {
  const {
    src,
    alt,
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
    ...restProps
  } = props

  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [isProgressiveLoading, setIsProgressiveLoading] = useState(false)
  const [progressiveQuality, setProgressiveQuality] = useState(0)
  const imgRef = useRef<HTMLImageElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    const img = imgRef.current
    if (!img) return

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

    observerRef.current.observe(img)

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

  // Progressive loading effect
  useEffect(() => {
    if (showProgressiveEffect && isInView && !isLoaded) {
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
  }, [showProgressiveEffect, isInView, isLoaded])

  const imageSrc = isInView ? src : placeholder

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
        ref={imgRef}
        src={imageSrc}
        alt={alt}
        className={className}
        style={{
          ...style,
          opacity: isLoaded ? 1 : (showProgressiveEffect ? 0.8 : 0.7),
          transform: isLoaded ? 'scale(1)' : 'scale(0.98)',
          transition: 'opacity 0.3s ease-out, transform 0.3s ease-out',
          filter: showProgressiveEffect && isProgressiveLoading ? `blur(${Math.max(0, 10 - (progressiveQuality / 10))}px)` : 'none'
        }}
        onClick={onClick}
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