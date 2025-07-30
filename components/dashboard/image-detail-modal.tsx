import React, { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, MessageCircle, Send, Calendar, User, ZoomIn, ZoomOut, Crop, Edit2, Save, X as XIcon, ChevronLeft, ChevronRight, Play, Pause, FileText, Image as ImageIcon, HardDrive, PanelLeftClose, PanelLeftOpen, Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMediaComments, useCreateComment, useAuth, useUpdateMedia } from '@/lib/api-hooks'
import { getMediaUrlFromMedia } from '@/lib/api'
import { LazyMedia } from '../lazy-media'
import { TagInput } from '../tag-input'
import { Media, Comment } from '@/lib/types'
import { mapMediaData } from '@/lib/media-utils'
import { useSlideshow } from '@/lib/hooks/use-slideshow'

interface ImageDetailModalProps {
  media: Media | null
  onClose: () => void
  onMediaUpdate?: () => void
  updateMedia?: (mediaId: string, updates: Partial<any>) => void
  // Navigation props
  allMedia?: Media[]
  onNavigate?: (media: Media) => void
}

export function ImageDetailModal({ media, onClose, onMediaUpdate, updateMedia, allMedia, onNavigate }: ImageDetailModalProps) {
  // Return early if no media or if it's not an image
  if (!media || media.mediaType !== 'IMAGE') {
    return null
  }

  const router = useRouter()
  const [commentText, setCommentText] = useState('')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isCropMode, setIsCropMode] = useState(false)
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const [isCropping, setIsCropping] = useState(false)
  const [cropStart, setCropStart] = useState({ x: 0, y: 0 })
  const [activeCrop, setActiveCrop] = useState<{ x: number, y: number, width: number, height: number } | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editTags, setEditTags] = useState<string[]>([])
  const [localTitle, setLocalTitle] = useState(media?.altText || '')
  const [localDescription, setLocalDescription] = useState(media?.caption || '')
  const [localTags, setLocalTags] = useState<string[]>(media?.tags || [])
  
  // Unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null)
  

  
  // Update local state when media prop changes (for navigation)
  useEffect(() => {
    setLocalTitle(media?.altText || '')
    setLocalDescription(media?.caption || '')
    setLocalTags(media?.tags || [])
    // Reset edit state when navigating to a new media
    setIsEditing(false)
    setEditTitle('')
    setEditDescription('')
    setEditTags([])
    // Reset unsaved changes tracking
    setHasUnsavedChanges(false)
    setShowUnsavedChangesDialog(false)
    setPendingNavigation(null)
  }, [media?.id, media?.altText, media?.caption, media?.tags])
  const containerRef = useRef<HTMLDivElement>(null)
  
  // UI state
  const [isPanelMinimized, setIsPanelMinimized] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const { data: commentsData, isLoading: commentsLoading } = useMediaComments(media.id)
  const createCommentMutation = useCreateComment()
  const updateMediaMutation = useUpdateMedia()
  const { data: authData } = useAuth()
  
  // Check if current user is the media owner
  const isOwner = authData?.data?.user?.id === media.authorId

  // Slideshow functionality
  const slideshow = useSlideshow({
    allMedia: allMedia || [],
    currentMedia: media,
    onNavigate: onNavigate || (() => {}),
    slideshowSpeed: 3000
  })

  // Navigation logic (for compatibility with existing code)
  const canNavigate = allMedia && allMedia.length > 1 && onNavigate
  const currentIndex = canNavigate ? allMedia.findIndex(m => m.id === media.id) : -1
  const hasNext = canNavigate && currentIndex !== -1 && currentIndex < allMedia.length - 1
  const hasPrev = canNavigate && currentIndex !== -1 && currentIndex > 0

  // Navigation with unsaved changes handling
  const handleNavigationWithUnsavedChanges = useCallback((navigationFunction: () => void) => {
    if (hasUnsavedChanges) {
      setShowUnsavedChangesDialog(true)
      setPendingNavigation(() => navigationFunction)
    } else {
      navigationFunction()
    }
  }, [hasUnsavedChanges])

  const handleConfirmNavigation = useCallback(() => {
    setShowUnsavedChangesDialog(false)
    if (pendingNavigation) {
      pendingNavigation()
      setPendingNavigation(null)
    }
  }, [pendingNavigation])

  const handleCancelNavigation = useCallback(() => {
    setShowUnsavedChangesDialog(false)
    setPendingNavigation(null)
  }, [])

  const handleNext = useCallback(() => {
    if (!canNavigate || !hasNext) return
    const nextIndex = currentIndex + 1
    handleNavigationWithUnsavedChanges(() => onNavigate(allMedia[nextIndex]))
  }, [canNavigate, hasNext, currentIndex, onNavigate, allMedia, handleNavigationWithUnsavedChanges])

  const handlePrev = useCallback(() => {
    if (!canNavigate || !hasPrev) return
    const prevIndex = currentIndex - 1
    handleNavigationWithUnsavedChanges(() => onNavigate(allMedia[prevIndex]))
  }, [canNavigate, hasPrev, currentIndex, onNavigate, allMedia, handleNavigationWithUnsavedChanges])

  const handleFirst = useCallback(() => {
    if (!canNavigate) return
    handleNavigationWithUnsavedChanges(() => onNavigate(allMedia[0]))
  }, [canNavigate, onNavigate, allMedia, handleNavigationWithUnsavedChanges])

  const handleLast = useCallback(() => {
    if (!canNavigate) return
    handleNavigationWithUnsavedChanges(() => onNavigate(allMedia[allMedia.length - 1]))
  }, [canNavigate, onNavigate, allMedia, handleNavigationWithUnsavedChanges])

  // Handle image load for slideshow
  const handleImageLoad = useCallback(() => {
    console.log('Slideshow: Image loaded')
    slideshow.handleMediaLoad()
  }, [slideshow])

  // Slideshow speed control functions
  const formatSlideshowSpeed = (speed: number) => {
    if (speed < 1000) {
      return `${speed}ms`
    } else {
      return `${Math.round(speed / 1000)}s`
    }
  }

  // Logarithmic scale for slideshow speed
  // Convert slider value (0-100) to speed (3000-60000ms)
  const sliderToSpeed = (sliderValue: number) => {
    // Use logarithmic scale: 3s to 60s
    const minSpeed = 3000 // 3 seconds
    const maxSpeed = 60000 // 60 seconds
    const logMin = Math.log(minSpeed)
    const logMax = Math.log(maxSpeed)
    const logValue = logMin + (logMax - logMin) * (sliderValue / 100)
    return Math.round(Math.exp(logValue))
  }

  // Convert speed to slider value
  const speedToSlider = (speed: number) => {
    const minSpeed = 3000
    const maxSpeed = 60000
    const logMin = Math.log(minSpeed)
    const logMax = Math.log(maxSpeed)
    const logSpeed = Math.log(speed)
    return Math.round(((logSpeed - logMin) / (logMax - logMin)) * 100)
  }

  const handleSlideshowSpeedChange = (sliderValue: number) => {
    const newSpeed = sliderToSpeed(sliderValue)
    slideshow.updateSlideshowSpeed(newSpeed)
  }

  const toggleCropMode = () => {
    console.log('toggleCropMode called, current isCropMode:', isCropMode)
    const newCropMode = !isCropMode
    setIsCropMode(newCropMode)
    console.log('Setting isCropMode to:', newCropMode)
    
    if (isCropMode) {
      // Exiting crop mode - reset view
      console.log('Exiting crop mode')
      setCropArea({ x: 0, y: 0, width: 0, height: 0 })
      setActiveCrop(null)
      //resetView()
    } else {
      // Entering crop mode - reset view to start fresh
      console.log('Entering crop mode')
      //resetView()
      setCropArea({ x: 0, y: 0, width: 0, height: 0 })
      setActiveCrop(null)
    }
  }

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
    // Don't reset crop mode here - let toggleCropMode handle it
  }

  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowUnsavedChangesDialog(true)
      setPendingNavigation(() => () => {
        resetView()
        onClose()
      })
    } else {
      resetView()
      onClose()
    }
  }, [hasUnsavedChanges, resetView, onClose])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle keyboard shortcuts if user is typing in an input field
      const activeElement = document.activeElement
      const isTyping = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.getAttribute('contenteditable') === 'true'
      )
      
      if (isTyping) return
      
      if (e.key === 'Escape') {
        handleClose()
      } else if (e.key === 'ArrowRight' && hasNext) {
        handleNext()
      } else if (e.key === 'ArrowLeft' && hasPrev) {
        handlePrev()
      } else if (e.key === 'Home') {
        handleFirst()
      } else if (e.key === 'End') {
        handleLast()
      } else if (e.key === ' ') {
        e.preventDefault()
        slideshow.toggleSlideshow()
      } else if (e.key === 'c' || e.key === 'C') {
        toggleCropMode()
      } else if (e.key === 'r' || e.key === 'R') {
        resetView()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, hasNext, hasPrev, handleNext, handlePrev, handleFirst, handleLast, slideshow.toggleSlideshow, toggleCropMode, resetView])

  // Auto-hide controls
  useEffect(() => {
    const handleMouseMove = () => {
      setControlsVisible(true)
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
      controlsTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false)
      }, 3000)
    }

    document.addEventListener('mousemove', handleMouseMove)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [])

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim()) return

    try {
      await createCommentMutation.mutateAsync({
        content: commentText.trim(),
        mediaId: media.id
      })
      setCommentText('')
    } catch (error) {
      console.error('Failed to create comment:', error)
    }
  }

  // Track changes in edit fields
  const handleEditTitleChange = (value: string) => {
    setEditTitle(value)
    // Only check for changes if we're in editing mode
    if (isEditing) {
      const hasChanges = value !== localTitle || editDescription !== localDescription || JSON.stringify(editTags) !== JSON.stringify(localTags)
      setHasUnsavedChanges(hasChanges)
    }
  }

  const handleEditDescriptionChange = (value: string) => {
    setEditDescription(value)
    // Only check for changes if we're in editing mode
    if (isEditing) {
      setHasUnsavedChanges(editTitle !== localTitle || value !== localDescription || JSON.stringify(editTags) !== JSON.stringify(localTags))
    }
  }

  const handleEditTagsChange = (tags: string[]) => {
    setEditTags(tags)
    // Only check for changes if we're in editing mode
    if (isEditing) {
      setHasUnsavedChanges(editTitle !== localTitle || editDescription !== localDescription || JSON.stringify(tags) !== JSON.stringify(localTags))
    }
  }

  const handleStartEdit = () => {
    setEditTitle(localTitle)
    setEditDescription(localDescription)
    setEditTags([...localTags])
    setIsEditing(true)
    setHasUnsavedChanges(false)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditTitle('')
    setEditDescription('')
    setEditTags([])
    setHasUnsavedChanges(false)
  }

  const handleSaveEdit = async () => {
    try {
      await updateMediaMutation.mutateAsync({
        mediaId: media.id,
        title: editTitle,
        description: editDescription,
        tags: editTags
      })
      
      setLocalTitle(editTitle)
      setLocalDescription(editDescription)
      setLocalTags([...editTags])
      setIsEditing(false)
      setHasUnsavedChanges(false)
      
      // Update the media prop if updateMedia function is provided
      if (updateMedia) {
        updateMedia(media.id, {
          altText: editTitle,
          caption: editDescription,
          tags: editTags
        })
      }
      
      if (onMediaUpdate) {
        onMediaUpdate()
      }
    } catch (error) {
      console.error('Failed to update media:', error)
    }
  }



  const handleCropMouseDown = (e: React.MouseEvent) => {
    if (!isCropMode) return
    
    e.preventDefault()
    e.stopPropagation()
    
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    
    const x = (e.clientX - rect.left)
    const y = (e.clientY - rect.top)
    
    setCropStart({ x, y })
    setIsCropping(true)
    setActiveCrop({ x, y, width: 0, height: 0 })
  }

  const handleCropMouseMove = (e: React.MouseEvent) => {
    if (!isCropMode || !isCropping) return
    e.preventDefault()
    e.stopPropagation()
    
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    
    // For the crop overlay, use coordinates relative to the container
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    setActiveCrop({
      x: Math.min(cropStart.x, x),
      y: Math.min(cropStart.y, y),
      width: Math.abs(x - cropStart.x),
      height: Math.abs(y - cropStart.y)
    })
   
  }

  const handleCropMouseUp = () => {
    if (!isCropMode) return
    
    setIsCropping(false)
    if (activeCrop && activeCrop.width > 10 && activeCrop.height > 10) {
      setCropArea(activeCrop)
      
      // Zoom to fit the crop area in the viewport
      const containerRect = containerRef.current?.getBoundingClientRect()
      if (containerRect) {
        console.log('containerRect activeCrop', containerRect, activeCrop)
        const containerWidth = containerRect.width - 32 // Account for padding
        const containerHeight = containerRect.height - 32
        // Calculate the scale needed to make the crop fill the viewport
        const viewportWidth = containerRect.width 
        const viewportHeight = containerRect.height
        // Calculate the scale to make the crop area fit the viewport
        // The crop dimensions are relative to the original image size
        const viewportAspectRatio = viewportWidth / viewportHeight
        const cropAspectRatio = activeCrop.width / activeCrop.height
        
        let newScale = zoom
        if (viewportAspectRatio > cropAspectRatio) {
          // Viewport is wider than crop, scale to fit height
          newScale *= viewportHeight / activeCrop.height
        } else {
          // Viewport is taller than crop, scale to fit width
          newScale *= viewportWidth / activeCrop.width
        }
        
        // Calculate the center of the crop area
        const cropCenterX = activeCrop.x + activeCrop.width / 2
        const cropCenterY = activeCrop.y + activeCrop.height / 2
        
        // Calculate the pan needed to center the crop area
        // The crop center should be at the viewport center
        const viewportCenterX = viewportWidth / 2
        const viewportCenterY = viewportHeight / 2
        
        // The crop center and pan are in zoomed image coordinates
        // We want this to be at the viewport center, so we need to pan by:
        const newPanX = (pan.x + viewportCenterX - cropCenterX) * newScale / zoom
        const newPanY = (pan.y + viewportCenterY - cropCenterY) * newScale / zoom
        
        // Apply the new scale and pan
        setZoom(newScale)
        setPan({ x: newPanX, y: newPanY })
      }
    }

    toggleCropMode()
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isCropMode) {
      handleCropMouseDown(e)
      return
    }
    
    if (zoom > 1) {
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
    
    if (isDragging) {
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
    e.preventDefault()
    
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleAuthorClick = (authorId: string, authorUsername: string | null) => {
    if (authorUsername) {
      router.push(`/user/${authorUsername}`)
    }
  }

  const togglePanel = () => {
    setIsPanelMinimized(!isPanelMinimized)
  }

  const mappedMedia = mapMediaData(media)

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex"
      >
        <div className="flex-1 flex flex-col bg-black">
          {/* Close Button */}
          <motion.button
            onClick={handleClose}
            className="absolute top-4 left-4 z-10 p-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200"
            animate={{ opacity: controlsVisible ? 1 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <X className="h-5 w-5" />
          </motion.button>
          


          {/* Image Container */}
          <motion.div 
            ref={containerRef}
            className="relative w-full h-full flex items-center justify-center p-4 cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            animate={{ 
              cursor: slideshow.isSlideshowActive && !controlsVisible ? 'none' : 'default'
            }}
            transition={{ duration: 0.3 }}
          >
            {/* Zoom Controls - Positioned on the edge of the image container */}
            <motion.div 
              className="absolute top-4 right-4 z-20 flex flex-col space-y-2 pointer-events-none"
              animate={{ opacity: controlsVisible ? 1 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <button
                onClick={togglePanel}
                className="p-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200 pointer-events-auto"
                title={isPanelMinimized ? "Show Panel" : "Hide Panel"}
              >
                {isPanelMinimized ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
              </button>
              <button
                onClick={handleZoomIn}
                className="p-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200 pointer-events-auto"
                title="Zoom In"
              >
                <ZoomIn className="h-5 w-5" />
              </button>
              <button
                onClick={handleZoomOut}
                className="p-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200 pointer-events-auto"
                title="Zoom Out"
              >
                <ZoomOut className="h-5 w-5" />
              </button>
              {(zoom !== 1 || activeCrop) && (
                <button
                  onClick={resetView}
                  className="p-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200 text-xs font-medium pointer-events-auto"
                  title="Reset View"
                >
                  Reset
                </button>
              )}
              <button
                onClick={toggleCropMode}
                className={`p-2 rounded-full transition-all duration-200 pointer-events-auto ${
                  isCropMode 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-black bg-opacity-50 hover:bg-opacity-70 text-white'
                }`}
                title={isCropMode ? "Exit Crop Mode" : "Crop Image"}
              >
                <Crop className="h-5 w-5" />
              </button>

              {/* Slideshow Controls */}
              {canNavigate && allMedia && allMedia.length > 1 && (
                <>
                  <button
                    onClick={slideshow.toggleSlideshow}
                    className={`p-2 rounded-full transition-all duration-200 pointer-events-auto ${
                      slideshow.isSlideshowActive 
                        ? 'bg-green-600 hover:bg-green-700 text-white' 
                        : 'bg-black bg-opacity-50 hover:bg-opacity-70 text-white'
                    }`}
                    title={slideshow.isSlideshowActive ? "Pause Slideshow" : "Start Slideshow"}
                  >
                    {slideshow.isSlideshowActive ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </button>
                  {/* Loading indicator */}
                  {slideshow.isSlideshowActive && slideshow.isWaitingForMediaLoad && !slideshow.isCurrentMediaLoaded && (
                    <div className="p-2 bg-yellow-600 text-white rounded-full animate-pulse pointer-events-auto" title="Waiting for image to load...">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </>
              )}
            </motion.div>

            {/* Navigation Buttons */}
            {canNavigate && (
              <>
                {/* Previous Button */}
                <motion.button
                  onClick={handlePrev}
                  className={`absolute left-4 top-1/2 transform -translate-y-1/2 z-10 p-3 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200 pointer-events-auto ${
                    !hasPrev ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'
                  }`}
                  disabled={!hasPrev}
                  title="Previous image (←)"
                  animate={{ opacity: controlsVisible ? 1 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <ChevronLeft className="h-6 w-6" />
                </motion.button>

                {/* Next Button */}
                <motion.button
                  onClick={handleNext}
                  className={`absolute right-4 top-1/2 transform -translate-y-1/2 z-10 p-3 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200 pointer-events-auto ${
                    !hasNext ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'
                  }`}
                  disabled={!hasNext}
                  title="Next image (→)"
                  animate={{ opacity: controlsVisible ? 1 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <ChevronRight className="h-6 w-6" />
                </motion.button>

                {/* Image Counter */}
                <motion.div 
                  className="absolute bottom-4 left-4 z-10 px-3 py-1 bg-black bg-opacity-50 text-white text-sm rounded-full pointer-events-auto"
                  animate={{ opacity: controlsVisible ? 1 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {currentIndex + 1} / {allMedia.length}
                </motion.div>
              </>
            )}

            <img
              src={getMediaUrlFromMedia(media, false)}
              alt={mappedMedia.altText || 'Gallery image'}
              className={dragStart.x === 0 ? "transition-transform duration-200 ease-out" : ""}
              style={{
                maxWidth: isPanelMinimized ? '100vw' : 'calc(100vw - 450px)', // Account for comments sidebar
                maxHeight: '100vh', // Full viewport height since no header
                width: 'auto',
                height: 'auto',
                transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                cursor: slideshow.isSlideshowActive && !controlsVisible ? 'none' : (isCropMode ? 'crosshair' : (zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'))
              }}
              onLoad={handleImageLoad}
            />
            
            {/* Crop Overlay */}
            {isCropMode && (
              <>
                {/* Show active crop area while dragging */}
                {activeCrop && activeCrop.width > 0 && activeCrop.height > 0 && (
                  <div
                    className="absolute border-2 border-blue-500 bg-blue-500 bg-opacity-20 pointer-events-none"
                    style={{
                      left: activeCrop.x,
                      top: activeCrop.y,
                      width: activeCrop.width,
                      height: activeCrop.height
                    }}
                  />
                )}
                {/* Show final crop area */}
                {cropArea.width > 0 && cropArea.height > 0 && (
                  <div
                    className="absolute border-2 border-green-500 bg-green-500 bg-opacity-20 pointer-events-none"
                    style={{
                      left: cropArea.x,
                      top: cropArea.y,
                      width: cropArea.width,
                      height: cropArea.height
                    }}
                  />
                )}
                {/* Show crop mode indicator */}
                {!activeCrop && cropArea.width === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-black bg-opacity-50 text-white px-4 py-2 rounded-lg text-sm">
                      Click and drag to select crop area
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </div>

        {/* Comments Section */}
        <motion.div 
          className={`border-l border-gray-200 flex flex-col bg-white overflow-hidden z-30 ${
            isPanelMinimized ? 'w-0' : 'w-[450px]'
          }`}
          animate={{ width: isPanelMinimized ? 0 : 450 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          {/* Image Info */}
          {isPanelMinimized ? (
            <div className="flex items-center justify-center h-8 border-b border-gray-200">
              <MessageCircle className="h-4 w-4 text-gray-400" />
            </div>
          ) : (
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-start justify-between mb-2">
                {isEditing ? (
                  <div className="flex-1 space-y-3">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => handleEditTitleChange(e.target.value)}
                      placeholder="Image title..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-medium"
                    />
                    <textarea
                      value={editDescription}
                      onChange={(e) => handleEditDescriptionChange(e.target.value)}
                      placeholder="Image description..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                    />
                    <TagInput
                      tags={editTags}
                      onTagsChange={handleEditTagsChange}
                      placeholder="Add tags..."
                      className="w-full"
                    />
                    <div className="flex space-x-2">
                      <button
                        onClick={handleSaveEdit}
                        disabled={updateMediaMutation.isPending}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm"
                      >
                        {updateMediaMutation.isPending ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors duration-200 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {localTitle || 'Untitled Image'}
                    </h3>
                    {localDescription && (
                      <p className="text-gray-600 text-sm mb-2">{localDescription}</p>
                    )}
                    {localTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {localTags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span className="flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        {formatDate(media.createdAt)}
                      </span>
                      <span className="flex items-center">
                        <User className="h-3 w-3 mr-1" />
                        <button
                          onClick={() => handleAuthorClick(media.authorId, null)}
                          className="hover:text-blue-600 transition-colors duration-200"
                        >
                          Unknown User
                        </button>
                      </span>
                    </div>
                  </div>
                )}
                
                {!isEditing && isOwner && (
                  <button
                    onClick={handleStartEdit}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                    title="Edit Image"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Slideshow Speed Control */}
                        {slideshow.isSlideshowActive && canNavigate && allMedia && allMedia.length > 1 && (
            <div className="p-4 border-b border-gray-200 bg-blue-50">
              <div className="flex items-center space-x-2 mb-3">
                <Clock className="h-4 w-4 text-blue-600" />
                <h4 className="text-sm font-medium text-gray-900">Slideshow Speed</h4>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">3s</span>
                  <span className="text-xs text-gray-600">60s</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={speedToSlider(slideshow.currentSlideshowSpeed)}
                  onChange={(e) => handleSlideshowSpeedChange(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${speedToSlider(slideshow.currentSlideshowSpeed)}%, #e5e7eb ${speedToSlider(slideshow.currentSlideshowSpeed)}%, #e5e7eb 100%)`
                  }}
                />
                <div className="text-center">
                  <span className="text-sm font-medium text-blue-600">
                    {formatSlideshowSpeed(slideshow.currentSlideshowSpeed)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Comments</h4>
              
              {commentsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="flex items-start space-x-3">
                        <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                        <div className="flex-1">
                          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                          <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : commentsData?.data?.comments?.length ? (
                <div className="space-y-4">
                  {commentsData.data.comments.map((comment: Comment) => (
                    <div key={comment.id} className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
                        {comment.author?.username?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <button
                            onClick={() => handleAuthorClick(comment.authorId, comment.author?.username || null)}
                            className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors duration-200"
                          >
                            {comment.author?.username || 'Unknown User'}
                          </button>
                          <span className="text-xs text-gray-500">
                            {formatDate(comment.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No comments yet. Be the first to comment!</p>
              )}
            </div>
          </div>

          {/* Comment Form */}
          <div className="p-4 border-t border-gray-200">
            <form onSubmit={handleSubmitComment} className="flex space-x-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                disabled={createCommentMutation.isPending}
              />
              <button
                type="submit"
                disabled={!commentText.trim() || createCommentMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 text-sm"
              >
                {createCommentMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </form>
          </div>
        </motion.div>
      </motion.div>

            {/* Unsaved Changes Dialog */}
      <AnimatePresence>
        {showUnsavedChangesDialog && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Unsaved Changes
              </h3>
              <p className="text-gray-600 mb-6">
                You have unsaved changes to this media. Do you want to save them before continuing?
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={handleCancelNavigation}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmNavigation}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
                >
                  Discard Changes
                </button>
                <button
                  onClick={async () => {
                    await handleSaveEdit()
                    if (pendingNavigation) {
                      pendingNavigation()
                      setPendingNavigation(null)
                    }
                    setShowUnsavedChangesDialog(false)
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  Save & Continue
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  )
} 