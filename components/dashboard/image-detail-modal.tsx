import React, { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, MessageCircle, Send, Calendar, User, ZoomIn, ZoomOut, Crop, Edit2, Save, X as XIcon, ChevronLeft, ChevronRight, Play, Pause, FileText, Image as ImageIcon, HardDrive } from 'lucide-react'
import { useImageComments, useCreateComment, useAuth, useUpdateImage } from '@/lib/api-hooks'
import { getImageUrl, getImageUrlFromImage } from '@/lib/api'
import { ProgressiveImage } from '../progressive-image'
import { TagInput } from '../tag-input'
import { GalleryImage, Comment } from '@/lib/types'
import { mapImageData } from '@/lib/image-utils'



interface ImageDetailModalProps {
  image: GalleryImage | null
  onClose: () => void
  onImageUpdate?: () => void
  updateImage?: (imageId: string, updates: Partial<any>) => void
  // Navigation props
  allImages?: GalleryImage[]
  onNavigate?: (image: GalleryImage) => void
}

export function ImageDetailModal({ image, onClose, onImageUpdate, updateImage, allImages, onNavigate }: ImageDetailModalProps) {
  // Return early if no image
  if (!image) {
    return null
  }

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
  const [localTitle, setLocalTitle] = useState(image?.title || '')
  const [localDescription, setLocalDescription] = useState(image?.description || '')
  const [localTags, setLocalTags] = useState<string[]>(image?.tags || [])
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Slideshow state
  const [isSlideshowActive, setIsSlideshowActive] = useState(false)
  const [slideshowSpeed, setSlideshowSpeed] = useState(3000) // milliseconds
  const slideshowIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [isCurrentImageLoaded, setIsCurrentImageLoaded] = useState(false)
  const [isSlideshowWaitingForLoad, setIsSlideshowWaitingForLoad] = useState(false)
  
  const { data: commentsData, isLoading: commentsLoading } = useImageComments(image.id)
  const createCommentMutation = useCreateComment()
  const updateImageMutation = useUpdateImage()
  const { data: authData } = useAuth()
  
  // Check if current user is the image owner
  const isOwner = authData?.data?.user?.id === image.authorId

  // Navigation logic
  const canNavigate = allImages && allImages.length > 1 && onNavigate
  const currentIndex = canNavigate ? allImages.findIndex(img => img.id === image.id) : -1
  const hasNext = canNavigate && currentIndex !== -1 && currentIndex < allImages.length - 1
  const hasPrev = canNavigate && currentIndex !== -1 && currentIndex > 0

  const handleNext = useCallback(() => {
    if (!canNavigate || !hasNext) return
    const nextIndex = currentIndex + 1
    onNavigate(allImages[nextIndex])
  }, [canNavigate, hasNext, currentIndex, onNavigate, allImages])

  const handlePrev = useCallback(() => {
    if (!canNavigate || !hasPrev) return
    const prevIndex = currentIndex - 1
    onNavigate(allImages[prevIndex])
  }, [canNavigate, hasPrev, currentIndex, onNavigate, allImages])

  const handleFirst = useCallback(() => {
    if (!canNavigate) return
    onNavigate(allImages[0])
  }, [canNavigate, onNavigate, allImages])

  const handleLast = useCallback(() => {
    if (!canNavigate) return
    onNavigate(allImages[allImages.length - 1])
  }, [canNavigate, onNavigate, allImages])

  // Slideshow handlers
  const startSlideshow = useCallback(() => {
    if (!canNavigate || !allImages || allImages.length <= 1) return
    
    setIsSlideshowActive(true)
    
    const advanceToNext = () => {
      if (currentIndex < allImages.length - 1) {
        handleNext()
      } else {
        // Loop back to first image
        handleFirst()
      }
    }

    const scheduleNext = () => {
      if (isCurrentImageLoaded) {
        // Image is loaded, schedule next advance
        slideshowIntervalRef.current = setTimeout(() => {
          advanceToNext()
        }, slideshowSpeed)
      } else {
        // Image not loaded yet, wait for it
        setIsSlideshowWaitingForLoad(true)
      }
    }

    // Start the slideshow cycle
    scheduleNext()
  }, [canNavigate, allImages, currentIndex, handleNext, handleFirst, slideshowSpeed, isCurrentImageLoaded])

  const stopSlideshow = useCallback(() => {
    setIsSlideshowActive(false)
    setIsSlideshowWaitingForLoad(false)
    if (slideshowIntervalRef.current) {
      clearTimeout(slideshowIntervalRef.current)
      slideshowIntervalRef.current = null
    }
  }, [])

  const toggleSlideshow = useCallback(() => {
    if (isSlideshowActive) {
      stopSlideshow()
    } else {
      startSlideshow()
    }
  }, [isSlideshowActive, startSlideshow, stopSlideshow])

  // Handle image load completion
  const handleImageLoad = useCallback(() => {
    setIsCurrentImageLoaded(true)
  }, [])
  
  // Update local state when image prop changes
  useEffect(() => {
    setLocalTitle(image?.title || '')
    setLocalDescription(image?.description || '')
    setLocalTags(image?.tags || [])
    
    // Reset view state when image changes (for navigation)
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setActiveCrop(null)
    setIsDragging(false)
    setIsCropping(false)
    setIsCropMode(false)
    setCropArea({ x: 0, y: 0, width: 0, height: 0 })
    
    // Reset image loading state when image changes
    setIsCurrentImageLoaded(false)
  }, [image])

  // Cleanup slideshow interval on unmount
  useEffect(() => {
    return () => {
      if (slideshowIntervalRef.current) {
        clearInterval(slideshowIntervalRef.current)
      }
    }
  }, [])

  // Restart slideshow with new speed when slideshowSpeed changes
  useEffect(() => {
    if (isSlideshowActive && slideshowIntervalRef.current) {
      stopSlideshow()
      startSlideshow()
    }
  }, [slideshowSpeed, isSlideshowActive, stopSlideshow, startSlideshow])

  // Advance slideshow when current image finishes loading
  useEffect(() => {
    if (isSlideshowActive && isSlideshowWaitingForLoad && isCurrentImageLoaded) {
      setIsSlideshowWaitingForLoad(false)
      // Schedule next advance after the configured delay
      slideshowIntervalRef.current = setTimeout(() => {
        if (currentIndex < (allImages?.length || 0) - 1) {
          handleNext()
        } else {
          handleFirst()
        }
      }, slideshowSpeed)
    }
  }, [isSlideshowActive, isSlideshowWaitingForLoad, isCurrentImageLoaded, slideshowSpeed, currentIndex, allImages, handleNext, handleFirst])
  
  // Add global mouse event listeners for smooth dragging
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging && zoom > 1 && !isCropMode) {
        e.preventDefault()
        setPan({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y
        })
      }
    }

    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false)
      }
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove)
      document.addEventListener('mouseup', handleGlobalMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove)
      document.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [isDragging, zoom, dragStart, isCropMode])

  // Add keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if any input element is focused (comment box, search, etc.)
      const activeElement = document.activeElement
      const isInputFocused = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        (activeElement as HTMLElement).contentEditable === 'true' ||
        activeElement.classList.contains('ProseMirror') // For rich text editors
      )
      
      // If an input is focused, don't handle navigation/slideshow shortcuts
      if (isInputFocused) return
      
      if (!canNavigate) return
      
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault()
          handleNext()
          break
        case 'ArrowLeft':
          e.preventDefault()
          handlePrev()
          break
        case 'Home':
          e.preventDefault()
          handleFirst()
          break
        case 'End':
          e.preventDefault()
          handleLast()
          break
        case ' ': // Spacebar
          e.preventDefault()
          if (allImages && allImages.length > 1) {
            toggleSlideshow()
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [canNavigate, handleNext, handlePrev, handleFirst, handleLast, toggleSlideshow, allImages])


  


  // Map image to include full URL and use local state for updated fields
  const mappedImage = {
    ...image,
    title: localTitle,
    description: localDescription,
    tags: localTags,
    url: getImageUrlFromImage(image, false),
    thumbnail: getImageUrlFromImage(image, true), // Use thumbnail endpoint
  }



  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim()) return

    try {
      await createCommentMutation.mutateAsync({
        content: commentText.trim(),
        imageId: mappedImage.id
      })
      setCommentText('')
    } catch (error) {
      console.error('Failed to create comment:', error)
    }
  }

  const handleStartEdit = () => {
    // Use the local state which reflects the latest updates
    setEditTitle(localTitle || '')
    setEditDescription(localDescription || '')
    setEditTags([...localTags])
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditTitle('')
    setEditDescription('')
    setEditTags([])
  }

  const handleSaveEdit = async () => {
    try {
      // Use tags directly from the TagInput component
      const parsedTags = editTags.filter(tag => tag.length > 0)
      
      await updateImageMutation.mutateAsync({
        imageId: mappedImage.id,
        title: editTitle || undefined,
        description: editDescription || undefined,
        tags: parsedTags,
        onOptimisticUpdate: updateImage
      })
      setIsEditing(false)
      
      // Update local state to reflect changes immediately
      setLocalTitle(editTitle || '')
      setLocalDescription(editDescription || '')
      setLocalTags(parsedTags)
      
      // Notify parent component that image was updated
      onImageUpdate?.()
    } catch (error) {
      console.error('Failed to update image:', error)
      alert('Failed to update image. Please try again.')
    }
  }

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.5, 8))
  }

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.5, 0.5))
  }

  const resetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setActiveCrop(null)
    setIsDragging(false)
    setIsCropping(false)
    setIsCropMode(false)
    setCropArea({ x: 0, y: 0, width: 0, height: 0 })

  }

  const toggleCropMode = () => {
    setIsCropMode(!isCropMode)
    if (isCropMode) {
      setCropArea({ x: 0, y: 0, width: 0, height: 0 })
      setActiveCrop(null)
    }
  }

  const handleCropMouseDown = (e: React.MouseEvent) => {
    if (!isCropMode) return
    
    e.preventDefault()
    e.stopPropagation()
    
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    
    // For the crop overlay, use coordinates relative to the container
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    setIsCropping(true)
    setCropStart({ x, y })
    setCropArea({ x, y, width: 0, height: 0 })
  }

  const handleCropMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isCropMode || !isCropping) return
    
    e.preventDefault()
    e.stopPropagation()
    
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    
    // For the crop overlay, use coordinates relative to the container
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    setCropArea({
      x: Math.min(cropStart.x, x),
      y: Math.min(cropStart.y, y),
      width: Math.abs(x - cropStart.x),
      height: Math.abs(y - cropStart.y)
    })
  }, [isCropMode, isCropping, cropStart])

  const handleCropMouseUp = () => {
    setIsCropping(false)
    
    // Apply the crop if we have a valid selection
    if (cropArea.width > 10 && cropArea.height > 10) {
      // Get the image element's actual position and size
        const containerRect = containerRef.current?.getBoundingClientRect()
      
        if(!containerRect) {
            return
        }
        const cropX = cropArea.x 
        const cropY = cropArea.y 
        const cropWidth = cropArea.width
        const cropHeight = cropArea.height

          
        // Calculate the scale needed to make the crop fill the viewport
        const viewportWidth = containerRect.width 
        const viewportHeight = containerRect.height
        // Calculate the scale to make the crop area fit the viewport
        // The crop dimensions are relative to the original image size
        const viewportAspectRatio = viewportWidth / viewportHeight
        const cropAspectRatio = cropWidth / cropHeight
        
        let newScale = zoom
        if (viewportAspectRatio > cropAspectRatio) {
          // Viewport is wider than crop, scale to fit height
          newScale *= viewportHeight / cropHeight
        } else {
          // Viewport is taller than crop, scale to fit width
          newScale *= viewportWidth / cropWidth
        }
        
        // Calculate the center of the crop area
        const cropCenterX = cropX + cropWidth / 2
        const cropCenterY = cropY + cropHeight / 2
        
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
        
        // Store the crop info for reference
        setActiveCrop({
          x: cropX,
          y: cropY,
          width: cropWidth,
          height: cropHeight
        })
      }
      
      setIsCropMode(false)
      setCropArea({ x: 0, y: 0, width: 0, height: 0 })
    
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
    
    if (isDragging && zoom > 1) {
      e.preventDefault()
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }
  }

  const handleMouseUp = (e?: React.MouseEvent) => {
    if (isCropMode) {
      handleCropMouseUp()
      return
    }
    setIsDragging(false)
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newZoom = Math.max(0.5, Math.min(8, zoom * delta))
    
    // Calculate zoom center point
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      
      // Adjust pan to keep mouse position fixed
      const scaleChange = newZoom / zoom
      const newPanX = pan.x - (mouseX * (scaleChange - 1))
      const newPanY = pan.y - (mouseY * (scaleChange - 1))
      
      setZoom(newZoom)
      setPan({ x: newPanX, y: newPanY })
    }
  }



  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!mappedImage) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-white w-full h-full flex flex-col"
        >
          {/* Content */}
          <div className="flex flex-1 overflow-hidden">
            {/* Image Section */}
            <div className="flex-1 flex items-center justify-center bg-gray-100 relative overflow-hidden">
              {/* Close Button */}
              <button
                onClick={() => {resetView(); onClose()}}
                className="absolute top-4 left-4 z-10 p-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Navigation Buttons */}
              {canNavigate && (
                <>
                  {/* Previous Button */}
                  <button
                    onClick={handlePrev}
                    className={`absolute left-4 top-1/2 transform -translate-y-1/2 z-10 p-3 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200 ${
                      !hasPrev ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'
                    }`}
                    disabled={!hasPrev}
                    title="Previous image (←)"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>

                  {/* Next Button */}
                  <button
                    onClick={handleNext}
                    className={`absolute right-4 top-1/2 transform -translate-y-1/2 z-10 p-3 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200 ${
                      !hasNext ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'
                    }`}
                    disabled={!hasNext}
                    title="Next image (→)"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>

                  {/* Image Counter */}
                  <div className="absolute bottom-4 left-4 z-10 px-3 py-1 bg-black bg-opacity-50 text-white text-sm rounded-full">
                    {currentIndex + 1} / {allImages.length}
                  </div>
                </>
              )}
              {/* Zoom Controls */}
              <div className="absolute top-4 right-4 z-20 flex flex-col space-y-2">
                <button
                  onClick={handleZoomIn}
                  className="p-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200"
                  title="Zoom In"
                >
                  <ZoomIn className="h-5 w-5" />
                </button>
                <button
                  onClick={handleZoomOut}
                  className="p-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-5 w-5" />
                </button>
                {(zoom !== 1 || activeCrop) && (
                  <button
                    onClick={resetView}
                    className="p-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200 text-xs font-medium"
                    title="Reset View"
                  >
                    Reset
                  </button>
                )}
                <button
                  onClick={toggleCropMode}
                  className={`p-2 rounded-full transition-all duration-200 ${
                    isCropMode 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                      : 'bg-black bg-opacity-50 hover:bg-opacity-70 text-white'
                  }`}
                  title={isCropMode ? "Exit Crop Mode" : "Crop Image"}
                >
                  <Crop className="h-5 w-5" />
                </button>

                {/* Slideshow Controls */}
                {canNavigate && allImages && allImages.length > 1 && (
                  <>
                    <button
                      onClick={toggleSlideshow}
                      className={`p-2 rounded-full transition-all duration-200 ${
                        isSlideshowActive 
                          ? 'bg-green-600 hover:bg-green-700 text-white' 
                          : 'bg-black bg-opacity-50 hover:bg-opacity-70 text-white'
                      }`}
                      title={isSlideshowActive ? "Pause Slideshow" : "Start Slideshow"}
                    >
                      {isSlideshowActive ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                    </button>
                    {/* Loading indicator */}
                    {isSlideshowActive && isSlideshowWaitingForLoad && !isCurrentImageLoaded && (
                      <div className="p-2 bg-yellow-600 text-white rounded-full animate-pulse" title="Waiting for image to load...">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </>
                )}
              </div>



              {/* Image Container */}
              <div 
                ref={containerRef}
                className="relative w-full h-full flex items-center justify-center p-4 cursor-grab active:cursor-grabbing"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
              >
                <ProgressiveImage
                  src={mappedImage.url}
                  thumbnailSrc={mappedImage.thumbnail}
                  alt={mappedImage.title || 'Gallery image'}
                  className="transition-transform duration-200 ease-out"
                  style={{
                    maxWidth: 'calc(100vw - 450px)', // Account for comments sidebar
                    maxHeight: '100vh', // Full viewport height since no header
                    width: 'auto',
                    height: 'auto',
                    transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                    cursor: isCropMode ? 'crosshair' : (zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default')
                  }}
                  showQualityIndicator={true}
                  showBlurEffect={true}
                  onLoad={handleImageLoad}
                />
                
                {/* Crop Overlay */}
                {isCropMode && cropArea.width > 0 && cropArea.height > 0 && (
                  <div
                    className="absolute border-2 border-blue-500 bg-blue-500 bg-opacity-20 pointer-events-none"
                    style={{
                      left: cropArea.x,
                      top: cropArea.y,
                      width: cropArea.width,
                      height: cropArea.height
                    }}
                  />
                )}
              </div>
            </div>

            {/* Comments Section */}
            <div className="w-[450px] border-l border-gray-200 flex flex-col bg-white">
              {/* Image Info */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-start justify-between mb-2">
                  {isEditing ? (
                    <div className="flex-1 space-y-3">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Image title..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-medium"
                      />
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Image description..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                      />
                      <TagInput
                        tags={editTags}
                        onTagsChange={setEditTags}
                        placeholder="Enter tags..."
                        className="w-full"
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={handleSaveEdit}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-1"
                        >
                          <Save className="h-3 w-3" />
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600 transition-colors duration-200 flex items-center space-x-1"
                        >
                          <XIcon className="h-3 w-3" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h4 className="font-medium text-gray-900 flex-1">
                        {localTitle || 'Untitled'}
                      </h4>
                      {isOwner && (
                        <button
                          onClick={handleStartEdit}
                          className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors duration-200 border border-blue-200 hover:border-blue-300"
                          title="Edit image details"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>
                
                {!isEditing && localDescription && (
                  <p className="text-sm text-gray-600 mb-3">
                    {localDescription}
                  </p>
                )}
                
                {!isEditing && localTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {localTags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                
                <div className="flex items-center text-xs text-gray-500">
                  <Calendar className="h-3 w-3 mr-1" />
                  Posted {formatDate(mappedImage.createdAt)}
                </div>

                {/* Image Metadata */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="space-y-2 text-xs text-gray-600">
                    {mappedImage.originalFilename && (
                      <div className="flex items-center">
                        <FileText className="h-3 w-3 mr-2 flex-shrink-0" />
                        <span className="truncate" title={mappedImage.originalFilename}>
                          {mappedImage.originalFilename}
                        </span>
                      </div>
                    )}
                    {mappedImage.metadata.width > 0 && mappedImage.metadata.height > 0 && (
                      <div className="flex items-center">
                        <ImageIcon className="h-3 w-3 mr-2 flex-shrink-0" />
                        <span>{mappedImage.metadata.width} × {mappedImage.metadata.height}</span>
                      </div>
                    )}
                    {mappedImage.metadata.size > 0 && (
                      <div className="flex items-center">
                        <HardDrive className="h-3 w-3 mr-2 flex-shrink-0" />
                        <span>{(mappedImage.metadata.size / 1024 / 1024).toFixed(1)} MB</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Slideshow Speed Control */}
                {canNavigate && allImages && allImages.length > 1 && isSlideshowActive && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Slideshow Speed</span>
                      <span className="text-xs text-gray-500">{slideshowSpeed / 1000}s</span>
                    </div>
                    <input
                      type="range"
                      min="1000"
                      max="10000"
                      step="500"
                      value={slideshowSpeed}
                      onChange={(e) => setSlideshowSpeed(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                      title={`${slideshowSpeed / 1000} seconds per image`}
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>1s</span>
                      <span>10s</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Comments List */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex items-center space-x-2 mb-4">
                  <MessageCircle className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">
                    Comments ({commentsData?.data?.comments?.length || 0})
                  </span>
                </div>

                {commentsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                    <p className="text-sm text-gray-500 mt-2">Loading comments...</p>
                  </div>
                ) : commentsData?.data?.comments?.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageCircle className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No comments yet</p>
                    <p className="text-xs text-gray-400">Be the first to comment!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {commentsData?.data?.comments?.map((comment: Comment) => (
                      <div key={comment.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-start space-x-2">
                          <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="h-3 w-3 text-gray-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="text-sm font-medium text-gray-900">
                                {comment.author.name}
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatDate(comment.createdAt)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700">{comment.content}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center space-x-1"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}