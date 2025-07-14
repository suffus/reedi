'use client'

import React, { useState, useRef, useEffect } from 'react'

interface ProgressiveImageProps {
  src: string
  alt: string
  thumbnailSrc?: string
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
  onLoad?: () => void
  onError?: () => void
  showQualityIndicator?: boolean
  showBlurEffect?: boolean
}

export function ProgressiveImage({
  src,
  alt,
  thumbnailSrc,
  className = '',
  style,
  onClick,
  onLoad,
  onError,
  showQualityIndicator = true,
  showBlurEffect = true
}: ProgressiveImageProps): JSX.Element {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [currentSrc, setCurrentSrc] = useState(src) // Always start with full-size image
  const [progressiveStage, setProgressiveStage] = useState(0)
  const [hasError, setHasError] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const loadingTimeoutRef = useRef<NodeJS.Timeout>()

  // Progressive loading stages
  const stages = [
    { quality: 0, blur: 20, delay: 0 },
    { quality: 15, blur: 15, delay: 100 },
    { quality: 30, blur: 10, delay: 200 },
    { quality: 50, blur: 5, delay: 300 },
    { quality: 70, blur: 2, delay: 400 },
    { quality: 85, blur: 0, delay: 500 },
    { quality: 100, blur: 0, delay: 600 }
  ]

  useEffect(() => {
    if (src && !isLoaded) {
      setIsLoading(true)
      setProgressiveStage(0)
      setCurrentSrc(src)
      
      // Start progressive loading simulation
      let currentStage = 0
      
      const progressInterval = setInterval(() => {
        if (currentStage < stages.length) {
          setProgressiveStage(currentStage)
          currentStage++
        } else {
          clearInterval(progressInterval)
        }
      }, 150) // Slightly faster than the LazyImage for better UX
      
      return () => clearInterval(progressInterval)
    }
  }, [src, isLoaded])

  const handleLoad = () => {
    setIsLoaded(true)
    setIsLoading(false)
    setProgressiveStage(stages.length - 1) // Set to final stage
    onLoad?.()
  }

  const handleError = () => {
    setHasError(true)
    setIsLoading(false)
    onError?.()
  }

  const currentStage = stages[progressiveStage] || stages[stages.length - 1]

  return (
    <div className="relative">
      {/* Loading overlay with progressive effect */}
      {isLoading && !isLoaded && (
        <div 
          className="absolute inset-0 bg-gray-100 rounded-lg overflow-hidden"
          style={{
            opacity: isLoaded ? 0 : 1,
            transition: 'opacity 0.3s ease-out'
          }}
        >
          {/* Progressive blur effect */}
          {showBlurEffect && (
            <div 
              className="w-full h-full bg-gray-200"
              style={{
                filter: `blur(${currentStage.blur}px)`,
                transition: 'filter 0.15s ease-out'
              }}
            />
          )}
          
          {/* Quality indicator */}
          {showQualityIndicator && (
            <div className="absolute bottom-4 right-4 bg-black bg-opacity-70 text-white text-sm px-3 py-2 rounded-lg font-medium">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span>Loading... {currentStage.quality}%</span>
              </div>
              <div className="mt-1 w-full bg-gray-600 rounded-full h-1">
                <div 
                  className="bg-green-400 h-1 rounded-full transition-all duration-150 ease-out"
                  style={{ width: `${currentStage.quality}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main image */}
      <img
        ref={imgRef}
        src={currentSrc}
        alt={alt}
        className={className}
        style={{
          ...style,
          opacity: isLoaded ? 1 : 0.9,
          // Don't override transform if it's already set (for zoom functionality)
          transform: style?.transform || (isLoaded ? 'scale(1)' : 'scale(0.99)'),
          transition: 'opacity 0.3s ease-out, transform 0.3s ease-out',
          filter: showBlurEffect && isLoading ? `blur(${Math.max(0, currentStage.blur / 2)}px)` : 'none'
        }}
        onClick={onClick}
        onLoad={handleLoad}
        onError={handleError}
      />

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 bg-gray-100 rounded-lg flex items-center justify-center">
          <div className="text-center text-gray-500">
            <div className="text-4xl mb-2">📷</div>
            <div className="text-sm">Failed to load image</div>
          </div>
        </div>
      )}
    </div>
  )
} 