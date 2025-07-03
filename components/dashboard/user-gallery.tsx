'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Download, Trash2, Eye, Calendar, X, Loader2 } from 'lucide-react'
import { usePaginatedUserImages, useDeleteImage } from '../../lib/api-hooks'
import { ImageDetailModal } from './image-detail-modal'

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

interface UserGalleryProps {
  userId: string
}

export function UserGallery({ userId }: UserGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const observerRef = useRef<HTMLDivElement>(null)

  const { 
    images: rawImages, 
    totalImages, 
    hasMore, 
    isLoading, 
    isFetching, 
    loadMore 
  } = usePaginatedUserImages(userId)
  
  const deleteImageMutation = useDeleteImage()

  // Map the raw images to our frontend format
  const images = rawImages.map(mapImageData)

  // Intersection Observer for infinite scroll
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const [target] = entries
    if (target.isIntersecting && hasMore && !isFetching && !isLoading) {
      loadMore()
    }
  }, [hasMore, isFetching, isLoading, loadMore])

  useEffect(() => {
    const element = observerRef.current
    if (!element) return

    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: '100px', // Start loading 100px before reaching the bottom
      threshold: 0.1
    })

    observer.observe(element)

    return () => observer.disconnect()
  }, [handleObserver])

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm('Are you sure you want to delete this image?')) return

    try {
      await deleteImageMutation.mutateAsync(imageId)
    } catch (error) {
      console.error('Failed to delete image:', error)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse"></div>
          <div className="h-8 bg-gray-200 rounded w-24 animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 animate-pulse">
              <div className="w-full h-48 bg-gray-200 rounded-lg mb-3"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-serif font-bold text-gray-900">Your Gallery</h2>
          <p className="text-gray-600 mt-1">
            {totalImages} {(totalImages === 1 ? 'image' : 'images')} in your collection
            {images.length > 0 && images.length < totalImages && (
              <span className="text-gray-500">
                {' '}(showing {images.length} of {totalImages})
              </span>
            )}
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors duration-200 ${
              viewMode === 'grid'
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <div className="grid grid-cols-2 gap-1 w-4 h-4">
              <div className="bg-current rounded-sm"></div>
              <div className="bg-current rounded-sm"></div>
              <div className="bg-current rounded-sm"></div>
              <div className="bg-current rounded-sm"></div>
            </div>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors duration-200 ${
              viewMode === 'list'
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <div className="space-y-1 w-4 h-4">
              <div className="bg-current rounded-sm h-1"></div>
              <div className="bg-current rounded-sm h-1"></div>
              <div className="bg-current rounded-sm h-1"></div>
            </div>
          </button>
        </div>
      </div>

      {/* Images Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {(images ?? []).map((image: GalleryImage, index: number) => (
            <motion.div
              key={image.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden group hover:shadow-md transition-shadow duration-200"
            >
              <div className="relative aspect-square overflow-hidden">
                <img
                  src={image.url}
                  alt={image.title || 'Gallery image'}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                
                {/* Overlay Actions */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center">
                  <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={() => setSelectedImage(image)}
                      className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-colors duration-200"
                    >
                      <Eye className="h-4 w-4 text-gray-700" />
                    </button>
                    <a
                      href={image.url}
                      download
                      className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-colors duration-200"
                    >
                      <Download className="h-4 w-4 text-gray-700" />
                    </a>
                    <button
                      onClick={() => handleDeleteImage(image.id)}
                      disabled={deleteImageMutation.isPending}
                      className="p-2 bg-white rounded-full shadow-lg hover:bg-red-50 transition-colors duration-200"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="p-4">
                <h3 className="font-medium text-gray-900 mb-1 truncate">
                  {image.title || 'Untitled'}
                </h3>
                {image.description && (
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                    {image.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="flex items-center">
                    <Calendar className="h-3 w-3 mr-1" />
                    {formatDate(image.createdAt)}
                  </span>
                  {image.metadata?.size && (
                    <span>{formatFileSize(image.metadata.size)}</span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {(images ?? []).map((image: GalleryImage, index: number) => (
            <motion.div
              key={image.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
            >
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                  <img
                    src={image.url}
                    alt={image.title || 'Gallery image'}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 mb-1 truncate">
                    {image.title || 'Untitled'}
                  </h3>
                  {image.description && (
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                      {image.description}
                    </p>
                  )}
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span className="flex items-center">
                      <Calendar className="h-3 w-3 mr-1" />
                      {formatDate(image.createdAt)}
                    </span>
                    {image.metadata?.size && (
                      <span>{formatFileSize(image.metadata.size)}</span>
                    )}
                    {image.metadata?.width && image.metadata?.height && (
                      <span>{image.metadata.width} × {image.metadata.height}</span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setSelectedImage(image)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <a
                    href={image.url}
                    download
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  <button
                    onClick={() => handleDeleteImage(image.id)}
                    disabled={deleteImageMutation.isPending}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Infinite Scroll Observer */}
      {hasMore && (
        <div 
          ref={observerRef}
          className="flex justify-center py-8"
        >
          {isFetching ? (
            <div className="flex items-center space-x-2 text-gray-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading more images...</span>
            </div>
          ) : (
            <div className="h-4" /> // Invisible element for intersection observer
          )}
        </div>
      )}

      {/* Manual Load More Button (fallback) */}
      {hasMore && !isFetching && (
        <div className="flex justify-center pt-6">
          <button
            onClick={loadMore}
            className="btn-secondary flex items-center space-x-2 px-8 py-3"
          >
            <span>Load More Images</span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {images.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Camera className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No images yet</h3>
          <p className="text-gray-600">Start building your gallery by uploading some images!</p>
        </div>
      )}

      {/* Image Detail Modal */}
      <ImageDetailModal
        image={selectedImage}
        onClose={() => setSelectedImage(null)}
      />
    </div>
  )
} 