import React, { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, MessageCircle, Send, Calendar, User, ZoomIn, ZoomOut, Crop, Edit2, Save, X as XIcon } from 'lucide-react'
import { useImageComments, useCreateComment, useAuth, useUpdateImage } from '@/lib/api-hooks'
import { getImageUrl, getImageUrlFromImage } from '@/lib/api'
import { ProgressiveImage } from '../progressive-image'

interface GalleryImage {
  id: string
  url: string
  thumbnail: string
  s3Key?: string
  thumbnailS3Key?: string
  title: string | null
  description: string | null
  createdAt: string
  authorId: string
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
  url: image.s3Key || image.url, // Use S3 key if available, fallback to old URL
  thumbnail: image.thumbnailS3Key || image.thumbnail || image.url, // Use S3 key if available, fallback to old thumbnail
  title: image.altText || image.title,
  description: image.caption || image.description,
  createdAt: image.createdAt,
  authorId: image.authorId,
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
  onImageUpdate?: () => void
  updateImage?: (imageId: string, updates: Partial<any>) => void
}

export function ImageDetailModal({ image, onClose, onImageUpdate, updateImage }: ImageDetailModalProps) {
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
  const [editTags, setEditTags] = useState('')
  const [localTitle, setLocalTitle] = useState(image?.title || '')
  const [localDescription, setLocalDescription] = useState(image?.description || '')
  const [localTags, setLocalTags] = useState<string[]>(image?.tags || [])
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const { data: commentsData, isLoading: commentsLoading } = useImageComments(image.id)
  const createCommentMutation = useCreateComment()
  const updateImageMutation = useUpdateImage()
  const { data: authData } = useAuth()
  
  // Update local state when image prop changes
  useEffect(() => {
    setLocalTitle(image?.title || '')
    setLocalDescription(image?.description || '')
    setLocalTags(image?.tags || [])
  }, [image])
  
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
  
  // Check if current user is the image owner
  const isOwner = authData?.data?.user?.id === image.authorId
  


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
    setEditTags(localTags.join(', '))
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditTitle('')
    setEditDescription('')
    setEditTags('')
  }

  const handleSaveEdit = async () => {
    try {
      // Parse tags from comma-separated string
      const parsedTags = editTags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)
      
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
                      <input
                        type="text"
                        value={editTags}
                        onChange={(e) => setEditTags(e.target.value)}
                        placeholder="Tags (comma separated)..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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