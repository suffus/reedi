'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight, Play, Pause, Volume2, VolumeX, Maximize, Minimize, Clock, ZoomIn, ZoomOut, Crop, RotateCcw, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useMediaDetail } from './media-detail-context'
import { LazyMedia } from '../lazy-media'
import { Media } from '@/lib/types'
import { useSlideshow } from '@/lib/hooks/use-slideshow'

// Flexible media type for messages and other contexts
interface FlexibleMedia {
  id: string
  url?: string
  thumbnail?: string
  mimeType?: string
  originalFilename?: string
  mediaType?: 'IMAGE' | 'VIDEO'
  altText?: string
  caption?: string
  width?: number
  height?: number
  tags?: string[]
  authorId?: string
  createdAt?: string
  updatedAt?: string
  duration?: number
}

export function SharedMediaDetailModal() {
  const { isOpen, currentMedia, allMedia, closeMediaDetail, navigateToMedia } = useMediaDetail()
  
  // Image zoom and pan state
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  
  // Crop mode state
  const [isCropMode, setIsCropMode] = useState(false)
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const [isCropping, setIsCropping] = useState(false)
  const [cropStart, setCropStart] = useState({ x: 0, y: 0 })
  const [activeCrop, setActiveCrop] = useState<{ x: number, y: number, width: number, height: number } | null>(null)
  
  // Video player state
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  
  // UI state
  const [isPanelMinimized, setIsPanelMinimized] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  // Convert FlexibleMedia to Media for slideshow hook
  const mediaForSlideshow = currentMedia as Media
  const allMediaForSlideshow = allMedia as Media[]

  // Slideshow functionality
  const slideshow = useSlideshow({
    allMedia: allMediaForSlideshow || [],
    currentMedia: mediaForSlideshow,
    onNavigate: (media: Media) => {
      // Navigate to the media using the context
      navigateToMedia(media)
    },
    slideshowSpeed: 3000
  })

  // Navigation logic
  const canNavigate = allMedia && allMedia.length > 1
  const currentIndex = canNavigate ? allMedia.findIndex(m => m.id === currentMedia?.id) : -1
  const hasNext = canNavigate && currentIndex !== -1 && currentIndex < allMedia.length - 1
  const hasPrev = canNavigate && currentIndex !== -1 && currentIndex > 0

  // Reset state when media changes
  useEffect(() => {
    if (currentMedia?.mediaType === 'VIDEO' || currentMedia?.mimeType?.startsWith('video/')) {
      setIsPlaying(false)
      setCurrentTime(0)
      setDuration(0)
      setVolume(1)
      setIsMuted(false)
      setIsFullscreen(false)
      setShowControls(true)
    }
    
    // Reset image state
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setIsDragging(false)
    setDragStart({ x: 0, y: 0 })
    setIsCropMode(false)
    setCropArea({ x: 0, y: 0, width: 0, height: 0 })
    setIsCropping(false)
    setCropStart({ x: 0, y: 0 })
    setActiveCrop(null)
  }, [currentMedia?.id, currentMedia?.mediaType])

  // Image zoom and pan functions
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.5, 5))
  }

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.5, 0.1))
  }

  const resetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setCropArea({ x: 0, y: 0, width: 0, height: 0 })
    setActiveCrop(null)
    setIsCropMode(false)
  }

  const toggleCropMode = () => {
    setIsCropMode(!isCropMode)
    if (isCropMode) {
      setCropArea({ x: 0, y: 0, width: 0, height: 0 })
      setActiveCrop(null)
    }
  }

  // Mouse event handlers for zoom and pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isCropMode) {
      handleCropMouseDown(e)
      return
    }
    
    if (zoom > 1 && (currentMedia?.mediaType === 'IMAGE' || currentMedia?.mimeType?.startsWith('image/'))) {
      e.preventDefault()
      setIsDragging(true)
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isCropMode) {
      handleCropMouseMove(e)
      return
    }
    
    if (isDragging && (currentMedia?.mediaType === 'IMAGE' || currentMedia?.mimeType?.startsWith('image/'))) {
      e.preventDefault()
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
    }
  }

  const handleMouseUp = (e?: React.MouseEvent) => {
    if (isCropMode) {
      handleCropMouseUp()
      return
    }
    
    setIsDragging(false)
    setDragStart({ x: 0, y: 0 })
  }

  const handleWheel = (e: React.WheelEvent) => {
    if (!(currentMedia?.mediaType === 'IMAGE' || currentMedia?.mimeType?.startsWith('image/'))) return
    
    e.preventDefault()
    e.stopPropagation()
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newZoom = Math.max(1.0, Math.min(8, zoom * delta))
    
    // Zoom towards the center of the viewport
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      const centerX = rect.width / 2
      const centerY = rect.height / 2
      
      const scaleFactor = newZoom / zoom
      setPan(prev => ({
        x: (prev.x) * scaleFactor,
        y: (prev.y) * scaleFactor
      }))
    }
    
    setZoom(newZoom)
  }

  // Crop mode handlers
  const handleCropMouseDown = (e: React.MouseEvent) => {
    if (!isCropMode) return
    
    e.preventDefault()
    setIsCropping(true)
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      setCropStart({ x, y })
      setCropArea({ x, y, width: 0, height: 0 })
    }
  }

  const handleCropMouseMove = (e: React.MouseEvent) => {
    if (!isCropMode || !isCropping) return
    
    e.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const width = x - cropStart.x
      const height = y - cropStart.y
      setCropArea({ x: cropStart.x, y: cropStart.y, width, height })
    }
  }

  const handleCropMouseUp = () => {
    if (!isCropMode) return
    
    setIsCropping(false)
    if (cropArea.width !== 0 && cropArea.height !== 0) {
      setActiveCrop(cropArea)
    }
  }

  // Video player functions
  const handlePlay = () => {
    if (videoRef.current) {
      videoRef.current.play()
      setIsPlaying(true)
    }
  }

  const handlePause = () => {
    if (videoRef.current) {
      videoRef.current.pause()
      setIsPlaying(false)
    }
  }

  const handleTogglePlay = () => {
    if (isPlaying) {
      handlePause()
    } else {
      handlePlay()
    }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (videoRef.current) {
      videoRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    if (videoRef.current) {
      videoRef.current.volume = newVolume
    }
  }

  const handleToggleMute = () => {
    setIsMuted(!isMuted)
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
    }
  }

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Navigation functions
  const handleNext = () => {
    if (hasNext && allMedia) {
      navigateToMedia(allMedia[currentIndex + 1])
    }
  }

  const handlePrev = () => {
    if (hasPrev && allMedia) {
      navigateToMedia(allMedia[currentIndex - 1])
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      // Don't handle keyboard shortcuts if user is typing in an input field
      const activeElement = document.activeElement
      const isTyping = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.getAttribute('contenteditable') === 'true'
      )
      
      if (isTyping) return

      switch (e.key) {
        case 'Escape':
          closeMediaDetail()
          break
        case 'ArrowLeft':
          if (hasPrev) handlePrev()
          break
        case 'ArrowRight':
          if (hasNext) handleNext()
          break
        case ' ':
          if (currentMedia?.mediaType === 'VIDEO' || currentMedia?.mimeType?.startsWith('video/')) {
            e.preventDefault()
            handleTogglePlay()
          } else if (currentMedia?.mediaType === 'IMAGE' || currentMedia?.mimeType?.startsWith('image/')) {
            e.preventDefault()
            slideshow.toggleSlideshow()
          }
          break
        case 'c':
        case 'C':
          if (currentMedia?.mediaType === 'IMAGE' || currentMedia?.mimeType?.startsWith('image/')) {
            toggleCropMode()
          }
          break
        case 'r':
        case 'R':
          if (currentMedia?.mediaType === 'IMAGE' || currentMedia?.mimeType?.startsWith('image/')) {
            resetView()
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, hasNext, hasPrev, currentMedia?.mediaType, closeMediaDetail, slideshow])

  // Auto-hide controls for video
  useEffect(() => {
    if ((currentMedia?.mediaType === 'VIDEO' || currentMedia?.mimeType?.startsWith('video/')) && isPlaying) {
      const timeout = setTimeout(() => {
        setShowControls(false)
      }, 3000)
      controlsTimeoutRef.current = timeout
      return () => clearTimeout(timeout)
    }
  }, [isPlaying, currentMedia?.mediaType])

  const handleVideoMouseMove = () => {
    if (currentMedia?.mediaType === 'VIDEO' || currentMedia?.mimeType?.startsWith('video/')) {
      setShowControls(true)
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }

  const togglePanel = () => {
    setIsPanelMinimized(!isPanelMinimized)
  }

  if (!isOpen || !currentMedia) return null

  // Determine media type from various sources
  const isVideo = currentMedia.mediaType === 'VIDEO' || currentMedia.mimeType?.startsWith('video/')
  const isImage = currentMedia.mediaType === 'IMAGE' || currentMedia.mimeType?.startsWith('image/') || !isVideo

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-90 z-50 flex"
        onClick={closeMediaDetail}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={(e) => {
          handleMouseMove(e)
          handleVideoMouseMove()
        }}
        onMouseUp={handleMouseUp}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative flex-1 flex items-center justify-center p-4"
          onClick={(e) => e.stopPropagation()}
          ref={containerRef}
        >
          {/* Close button */}
          <button
            onClick={closeMediaDetail}
            className="absolute top-4 right-4 z-10 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-all"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Navigation arrows */}
          {hasPrev && (
            <button
              onClick={handlePrev}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-all"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {hasNext && (
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-all"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Media content */}
          <div className="relative max-w-full max-h-full">
            {isVideo ? (
              <video
                ref={videoRef}
                src={currentMedia.url || ''}
                poster={currentMedia.thumbnail || ''}
                className="max-w-full max-h-[80vh] object-contain"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => {
                  setIsPlaying(false)
                  slideshow.handleVideoEnd()
                }}
                onLoad={() => slideshow.handleMediaLoad()}
              />
            ) : isImage ? (
              <div className="relative overflow-hidden">
                <img
                  ref={imageRef}
                  src={currentMedia.url || currentMedia.thumbnail || ''}
                  alt={currentMedia.originalFilename || 'Image'}
                  className="max-w-full max-h-[80vh] object-contain cursor-move"
                  style={{
                    transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                  }}
                  onLoad={() => slideshow.handleMediaLoad()}
                />
                
                {/* Crop overlay */}
                {isCropMode && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div
                      className="absolute border-2 border-white border-dashed"
                      style={{
                        left: cropArea.x,
                        top: cropArea.y,
                        width: cropArea.width,
                        height: cropArea.height
                      }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center p-8 text-white">
                <p>Unsupported media type</p>
              </div>
            )}

            {/* Video controls */}
            {isVideo && (
              <AnimatePresence>
                {showControls && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4"
                  >
                    {/* Progress bar */}
                    <input
                      type="range"
                      min="0"
                      max={duration || 0}
                      value={currentTime}
                      onChange={handleSeek}
                      className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                    />

                    {/* Controls */}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center space-x-4">
                        <button
                          onClick={handleTogglePlay}
                          className="text-white hover:text-gray-300"
                        >
                          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                        </button>

                        <div className="flex items-center space-x-2">
                          <button
                            onClick={handleToggleMute}
                            className="text-white hover:text-gray-300"
                          >
                            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                          </button>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={volume}
                            onChange={handleVolumeChange}
                            className="w-16 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                          />
                        </div>

                        <span className="text-white text-sm">
                          {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                      </div>

                      <button
                        onClick={handleFullscreen}
                        className="text-white hover:text-gray-300"
                      >
                        {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>

          {/* Image controls */}
          {isImage && controlsVisible && (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 rounded-lg p-2 flex items-center space-x-2"
              >
                <button
                  onClick={handleZoomIn}
                  className="p-2 text-white hover:text-gray-300 transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                
                <button
                  onClick={handleZoomOut}
                  className="p-2 text-white hover:text-gray-300 transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                
                <button
                  onClick={resetView}
                  className="p-2 text-white hover:text-gray-300 transition-colors"
                  title="Reset View"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                
                <button
                  onClick={toggleCropMode}
                  className={`p-2 transition-colors ${
                    isCropMode ? 'text-blue-400' : 'text-white hover:text-gray-300'
                  }`}
                  title="Crop Mode"
                >
                  <Crop className="w-4 h-4" />
                </button>
                
                {canNavigate && (
                  <button
                    onClick={slideshow.toggleSlideshow}
                    className={`p-2 transition-colors ${
                      slideshow.isSlideshowActive ? 'text-blue-400' : 'text-white hover:text-gray-300'
                    }`}
                    title="Slideshow"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                )}
              </motion.div>
            </AnimatePresence>
          )}

          {/* Media info */}
          <div className="absolute bottom-4 left-4 text-white">
            <h3 className="text-lg font-medium">
              {currentMedia.originalFilename || 'Media'}
            </h3>
            {currentMedia.caption && (
              <p className="text-sm text-gray-300 mt-1">{currentMedia.caption}</p>
            )}
            {canNavigate && (
              <p className="text-xs text-gray-400 mt-1">
                {currentIndex + 1} of {allMedia.length}
              </p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
} 