import React, { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, MessageCircle, Send, Calendar, User, ZoomIn, ZoomOut, Crop } from 'lucide-react'
import { useImageComments, useCreateComment } from '@/lib/api-hooks'

interface GalleryImage {
  id: string
  url: string
  title: string | null
  description: string | null
  createdAt: string
  tags: string[]
  metadata: {
    width: number
    height: number
    size: number
    format: string
  }
}

// Map backend image data to frontend format
const mapImageData = (image: any): GalleryImage => ({
  id: image.id,
  url: image.url,
  title: image.altText || image.title,
  description: image.caption || image.description,
  createdAt: image.createdAt,
  tags: image.tags || [],
  metadata: {
    width: image.width || 0,
    height: image.height || 0,
    size: image.size || 0,
    format: image.mimeType || 'unknown'
  }
})

interface Comment {
  id: string
  content: string
  authorId: string
  createdAt: string
  author: {
    id: string
    name: string
    username: string | null
    avatar: string | null
  }
}

interface ImageDetailModalProps {
  image: GalleryImage | null
  onClose: () => void
}

export function ImageDetailModal({ image, onClose }: ImageDetailModalProps) {
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
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const { data: commentsData, isLoading: commentsLoading } = useImageComments(image?.id || '')
  const createCommentMutation = useCreateComment()

  // Map the image data if it's in backend format
  const mappedImage = image ? mapImageData(image) : null

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim() || !mappedImage) return

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
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }
  }

  const handleMouseUp = () => {
    if (isCropMode) {
      handleCropMouseUp()
      return
    }
    setIsDragging(false)
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
          {/* Close Button */}
          <button
            onClick={() => {resetView(); onClose()}}
            className="absolute top-4 right-4 z-10 p-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Content */}
          <div className="flex flex-1 overflow-hidden">
            {/* Image Section */}
            <div className="flex-1 flex items-center justify-center bg-gray-100 relative overflow-hidden">
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

              </div>

              {/* Crop Mode Indicator */}
              {isCropMode && (
                <div className="absolute top-4 left-4 z-20 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                  Crop Mode - Click and drag to select area
                </div>
              )}
              {activeCrop && (
                <div className="absolute top-4 left-4 z-20 bg-green-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                  Cropped View - Click Reset to restore original
                </div>
              )}

              {/* Image Container */}
              <div 
                ref={containerRef}
                className="relative w-full h-full flex items-center justify-center p-4 cursor-grab active:cursor-grabbing"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <img
                  ref={imageRef}
                  src={mappedImage.url}
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
                <h4 className="font-medium text-gray-900 mb-2">
                  {mappedImage.title || 'Untitled'}
                </h4>
                {mappedImage.description && (
                  <p className="text-sm text-gray-600 mb-3">
                    {mappedImage.description}
                  </p>
                )}
                <div className="flex items-center text-xs text-gray-500">
                  <Calendar className="h-3 w-3 mr-1" />
                  Posted {formatDate(mappedImage.createdAt)}
                </div>
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