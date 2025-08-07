import { useState, useRef, useCallback, useEffect } from 'react'
import { Media } from '@/lib/types'

interface UseSlideshowProps {
  allMedia: Media[]
  currentMedia: Media | null
  onNavigate: (media: Media) => void
  slideshowSpeed?: number
}

export function useSlideshow({ 
  allMedia, 
  currentMedia, 
  onNavigate, 
  slideshowSpeed = 3000 
}: UseSlideshowProps) {
  const [isSlideshowActive, setIsSlideshowActive] = useState(false)
  const [currentSlideshowSpeed, setCurrentSlideshowSpeed] = useState(slideshowSpeed)
  const slideshowIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const videoEndTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isWaitingForMediaLoad, setIsWaitingForMediaLoad] = useState(false)
  const [isCurrentMediaLoaded, setIsCurrentMediaLoaded] = useState(false)

  // Navigation logic
  const canNavigate = allMedia && allMedia.length > 1
  const currentIndex = canNavigate ? allMedia.findIndex(m => m.id === currentMedia?.id) : -1
  const hasNext = canNavigate && currentIndex !== -1 && currentIndex < allMedia.length - 1
  const hasPrev = canNavigate && currentIndex !== -1 && currentIndex > 0

  const handleNext = useCallback(() => {
    if (hasNext) {
      onNavigate(allMedia[currentIndex + 1])
    } else {
      onNavigate(allMedia[0]) // Loop to first
    }
  }, [hasNext, currentIndex, allMedia, onNavigate])

  const handlePrev = useCallback(() => {
    if (hasPrev) {
      onNavigate(allMedia[currentIndex - 1])
    } else {
      onNavigate(allMedia[allMedia.length - 1]) // Loop to last
    }
  }, [hasPrev, currentIndex, allMedia, onNavigate])

  const handleFirst = useCallback(() => {
    if (canNavigate) {
      onNavigate(allMedia[0])
    }
  }, [canNavigate, allMedia, onNavigate])

  const handleLast = useCallback(() => {
    if (canNavigate) {
      onNavigate(allMedia[allMedia.length - 1])
    }
  }, [canNavigate, allMedia, onNavigate])

  // Calculate delay based on media type
  const getDelayForMedia = useCallback((media: Media) => {
    if (media.mediaType === 'VIDEO' && media.duration) {
      // For videos, wait for the video duration plus a small buffer
      return (media.duration * 1000) + 500 // Add 500ms buffer
    }
    // For images, use the slideshow speed
    return currentSlideshowSpeed
  }, [currentSlideshowSpeed])

  // Advance to next media
  const advanceToNext = useCallback(() => {
    if (!isSlideshowActive || !currentMedia) return

    console.log('Slideshow: Advancing to next media')
    handleNext()
    setIsWaitingForMediaLoad(true)
  }, [isSlideshowActive, currentMedia, handleNext])

  // Start slideshow
  const startSlideshow = useCallback(() => {
    if (!canNavigate || !allMedia || allMedia.length <= 1) return
    
    console.log('Slideshow: Starting slideshow')
    setIsSlideshowActive(true)
    
    // Initial advance
    const advanceToNext = () => {
      console.log('Slideshow: Initial advance')
      handleNext()
      setIsWaitingForMediaLoad(true)
    }
    
    // Start the slideshow
    slideshowIntervalRef.current = setTimeout(advanceToNext, getDelayForMedia(currentMedia!))
  }, [canNavigate, allMedia, handleNext, getDelayForMedia, currentMedia])

  // Stop slideshow
  const stopSlideshow = useCallback(() => {
    setIsSlideshowActive(false)
    if (slideshowIntervalRef.current) {
      clearTimeout(slideshowIntervalRef.current)
      slideshowIntervalRef.current = null
    }
    if (videoEndTimeoutRef.current) {
      clearTimeout(videoEndTimeoutRef.current)
      videoEndTimeoutRef.current = null
    }
  }, [])

  // Toggle slideshow
  const toggleSlideshow = useCallback(() => {
    if (isSlideshowActive) {
      stopSlideshow()
    } else {
      startSlideshow()
    }
  }, [isSlideshowActive, startSlideshow, stopSlideshow])

  // Handle media load (for both images and videos)
  const handleMediaLoad = useCallback(() => {
    console.log('Slideshow: Media loaded')
    setIsCurrentMediaLoaded(true)
    setIsWaitingForMediaLoad(false)
  }, [])

  // Handle video end
  const handleVideoEnd = useCallback(() => {
    if (isSlideshowActive && currentMedia?.mediaType === 'VIDEO') {
      console.log('Slideshow: Video ended, advancing to next')
      // Add a small delay before advancing to next
      videoEndTimeoutRef.current = setTimeout(() => {
        advanceToNext()
      }, 500)
    }
  }, [isSlideshowActive, currentMedia, advanceToNext])

  // Continue slideshow after media loads
  useEffect(() => {
    if (isSlideshowActive && isCurrentMediaLoaded && !isWaitingForMediaLoad) {
      console.log('Slideshow: Media loaded, scheduling next advance')
      
      // Clear any existing timeout
      if (slideshowIntervalRef.current) {
        clearTimeout(slideshowIntervalRef.current)
      }
      
      // Schedule the next advance
      slideshowIntervalRef.current = setTimeout(() => {
        if (isSlideshowActive) {
          advanceToNext()
        }
      }, getDelayForMedia(currentMedia!))
    }
  }, [isSlideshowActive, isCurrentMediaLoaded, isWaitingForMediaLoad, advanceToNext, getDelayForMedia, currentMedia])

  // Reset slideshow state when media changes
  useEffect(() => {
    setIsCurrentMediaLoaded(false)
    setIsWaitingForMediaLoad(false)
    
    // Clear any existing timeouts when media changes
    if (slideshowIntervalRef.current) {
      clearTimeout(slideshowIntervalRef.current)
      slideshowIntervalRef.current = null
    }
    if (videoEndTimeoutRef.current) {
      clearTimeout(videoEndTimeoutRef.current)
      videoEndTimeoutRef.current = null
    }
  }, [currentMedia?.id])

  // Update slideshow speed
  const updateSlideshowSpeed = useCallback((newSpeed: number) => {
    setCurrentSlideshowSpeed(newSpeed)
    console.log('Slideshow speed changed to:', newSpeed, 'ms')
    
    // If slideshow is active, restart it with the new speed
    if (isSlideshowActive) {
      if (slideshowIntervalRef.current) {
        clearTimeout(slideshowIntervalRef.current)
        slideshowIntervalRef.current = null
      }
      
      // Restart slideshow with new speed
      slideshowIntervalRef.current = setTimeout(() => {
        if (isSlideshowActive) {
          advanceToNext()
        }
      }, getDelayForMedia(currentMedia!))
    }
  }, [isSlideshowActive, advanceToNext, getDelayForMedia, currentMedia])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (slideshowIntervalRef.current) {
        clearTimeout(slideshowIntervalRef.current)
      }
      if (videoEndTimeoutRef.current) {
        clearTimeout(videoEndTimeoutRef.current)
      }
    }
  }, [])

  return {
    // State
    isSlideshowActive,
    isWaitingForMediaLoad,
    isCurrentMediaLoaded,
    currentSlideshowSpeed,
    
    // Navigation
    canNavigate,
    currentIndex,
    hasNext,
    hasPrev,
    handleNext,
    handlePrev,
    handleFirst,
    handleLast,
    
    // Slideshow controls
    startSlideshow,
    stopSlideshow,
    toggleSlideshow,
    updateSlideshowSpeed,
    
    // Media event handlers
    handleMediaLoad,
    handleVideoEnd
  }
} 