'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Download, Trash2, Eye, Calendar, X, Loader2, Plus, FolderOpen, Filter } from 'lucide-react'
import { useUserImages, useDeleteImage, useMyGalleries, useGallery } from '../../lib/api-hooks'
import { ImageDetailModal } from './image-detail-modal'
import { NewGalleryModal } from './new-gallery-modal'
import { GalleryDetailModal } from './gallery-detail-modal'
import { getImageUrl, getImageUrlFromImage } from '@/lib/api'
import { LazyImage } from '../lazy-image'
import { GalleryImage } from '@/lib/types'
import { mapImageData } from '@/lib/image-utils'
import { TagInput } from '../tag-input'


interface UserGalleryProps {
  userId: string
}

export function UserGallery({ userId }: UserGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [isNewGalleryModalOpen, setIsNewGalleryModalOpen] = useState(false)
  const [activeView, setActiveView] = useState<'images' | 'galleries'>('images')
  const [selectedGallery, setSelectedGallery] = useState<any>(null)
  const [isGalleryDetailModalOpen, setIsGalleryDetailModalOpen] = useState(false)
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)

  const { 
    data, 
    isLoading, 
    isFetching, 
    error, 
    loadMore, 
    hasMore, 
    isLoadingMore,
    nextPageSize,
    updateImage
  } = useUserImages(userId)

  const { data: galleriesData, isLoading: galleriesLoading } = useMyGalleries()
  const galleries = galleriesData?.data?.galleries || []

  const { data: selectedGalleryData, isLoading: selectedGalleryLoading } = useGallery(
    selectedGallery?.id || ''
  )

  const deleteImageMutation = useDeleteImage()

  const handleGalleryClick = (gallery: any) => {
    setSelectedGallery(gallery)
    setIsGalleryDetailModalOpen(true)
  }

  // Map the raw images to our frontend format and use backend serve endpoints
  const images = (data?.data?.images || []).map((image: any) => {
    const mapped = mapImageData(image)
    return {
      ...mapped,
      // Keep the original S3 keys for the ImageDetailModal
      s3Key: image.s3Key || image.url,
      thumbnailS3Key: image.thumbnailS3Key || image.thumbnail || image.url,
      // Use getImageUrlFromImage to construct URLs pointing to backend serve endpoints
      url: getImageUrlFromImage(mapped, false),
      thumbnail: getImageUrlFromImage(mapped, true), // Use thumbnail endpoint
    }
  })

  // Filter images based on selected tags
  const filteredImages = useMemo(() => {
    if (filterTags.length === 0) {
      return images
    }
    
    return images.filter((image: any) => {
      // Check if the image has all the selected tags
      return filterTags.every(tag => 
        image.tags && Array.isArray(image.tags) && image.tags.some((imageTag: string) => 
          imageTag && typeof imageTag === 'string' && imageTag.toLowerCase().includes(tag.toLowerCase())
        )
      )
    })
  }, [images, filterTags])

  const totalImages = data?.data?.pagination?.total || 0
  const filteredTotalImages = filteredImages.length

  // Create ghost placeholders for predictive loading
  // Show ghosts when we have more images to load, not just when currently loading
  const ghostPlaceholders = hasMore && nextPageSize > 0 ? Array.from({ length: 1 }, (_, i) => ({
    id: `ghost-${i}`,
    isGhost: true,
    index: i
  })) : []

  // Combine real images with ghost placeholders
  const displayImages = [...filteredImages, ...ghostPlaceholders]
  
  // Intersection Observer for infinite scroll - trigger when any ghost placeholder is visible
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const hasVisibleGhost = entries.some(entry => 
      entry.isIntersecting && 
      entry.target.getAttribute('data-ghost') === 'true'
    )
    
    // Trigger loading when any ghost is visible and we're not already loading
    if (hasVisibleGhost && hasMore && !isFetching && !isLoadingMore) {
      console.log('Loading more images...')
      loadMore()
    }
  }, [hasMore, isFetching, isLoadingMore, loadMore])

  useEffect(() => {
    // Observe all ghost placeholder elements
    const ghostElements = document.querySelectorAll('[data-ghost="true"]')
    
    console.log('Setting up observer:', {
      ghostElementsCount: ghostElements.length,
      displayImagesLength: displayImages.length,
      hasMore,
      nextPageSize
    })
    
    if (ghostElements.length === 0) return

    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: '100px', // Start loading when ghost is 100px from viewport
      threshold: 0.1
    })

    ghostElements.forEach(element => observer.observe(element))

    return () => observer.disconnect()
  }, [handleObserver, displayImages.length]) // Re-run when displayImages changes

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
        <div className="text-gray-500 text-sm"><b>Loading...</b></div>
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
            {activeView === 'images' ? (
              <>
                {filteredTotalImages} {(filteredTotalImages === 1 ? 'image' : 'images')} in your collection
                {filterTags.length > 0 && (
                  <span className="text-gray-500">
                    {' '}(filtered from {totalImages} total)
                  </span>
                )}
                {filterTags.length === 0 && images.length > 0 && images.length < totalImages && (
                  <span className="text-gray-500">
                    {' '}(showing {images.length} of {totalImages})
                  </span>
                )}
              </>
            ) : (
              <>
                {galleries.length} {(galleries.length === 1 ? 'gallery' : 'galleries')} created
              </>
            )}
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* View Toggle */}
          <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveView('images')}
              className={`px-3 py-1 text-sm rounded-md transition-colors duration-200 ${
                activeView === 'images'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Camera className="h-4 w-4 inline mr-1" />
              Images
            </button>
            <button
              onClick={() => setActiveView('galleries')}
              className={`px-3 py-1 text-sm rounded-md transition-colors duration-200 ${
                activeView === 'galleries'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FolderOpen className="h-4 w-4 inline mr-1" />
              Galleries
            </button>
          </div>

          {/* New Gallery Button */}
          {activeView === 'galleries' && (
            <button
              onClick={() => setIsNewGalleryModalOpen(true)}
              className="btn-primary flex items-center space-x-2 px-4 py-2"
            >
              <Plus className="h-4 w-4" />
              <span>New Gallery</span>
            </button>
          )}

          {/* View Mode Toggle (only for images) */}
          {activeView === 'images' && (
            <>
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
              
              {/* Filter Toggle Button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg transition-colors duration-200 ${
                  filterTags.length > 0
                    ? 'bg-blue-100 text-blue-700'
                    : showFilters
                    ? 'bg-gray-100 text-gray-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
                title={filterTags.length > 0 ? `${filterTags.length} filter(s) active` : 'Filter by tags'}
              >
                <Filter className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter Section */}
      <AnimatePresence>
        {activeView === 'images' && showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
          >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700 flex items-center">
              <Filter className="h-4 w-4 mr-2" />
              Filter by Tags
            </h3>
            {filterTags.length > 0 && (
              <button
                onClick={() => setFilterTags([])}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Clear filters
              </button>
            )}
          </div>
          <TagInput
            tags={filterTags}
            onTagsChange={setFilterTags}
            placeholder="Enter tags to filter by (comma-separated)..."
            className="w-full"
          />
                      {filterTags.length > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                Showing images that contain all selected tags
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      {activeView === 'images' ? (
        <>
          {/* Images Grid/List */}
          {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {(displayImages ?? []).map((image: any, index: number) => {
            // Handle ghost placeholders
            if (image.isGhost) {
              return (
                <motion.div
                  key={image.id}
                  data-ghost="true"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-xl border-4 border-dashed border-blue-400 overflow-hidden animate-pulse relative"
                  style={{ minHeight: '300px' }}
                >
                  <div className="relative aspect-square overflow-hidden">
                    <div className="w-full h-full bg-gradient-to-br from-blue-100 to-blue-200 flex flex-col items-center justify-center">
                      <div className="text-blue-600 text-xl font-bold mb-2">Loading Image...</div>
                      <div className="text-blue-500 text-sm">Predictive Loading</div>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <div className="h-4 bg-blue-200 rounded mb-2 animate-pulse"></div>
                    <div className="h-3 bg-blue-200 rounded mb-2 w-3/4 animate-pulse"></div>
                    <div className="flex items-center justify-between">
                      <div className="h-3 bg-blue-200 rounded w-1/3 animate-pulse"></div>
                      <div className="h-3 bg-blue-200 rounded w-1/4 animate-pulse"></div>
                    </div>
                  </div>
                  
                  {/* Debug indicator */}
                  <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                    GHOST
                  </div>
                  <div className="absolute bottom-2 left-2 bg-blue-400 text-white text-xs px-2 py-1 rounded">
                    {image.index + 1}
                  </div>
                </motion.div>
              )
            }

            // Handle real images
            return (
              <motion.div
                key={image.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden group hover:shadow-md transition-shadow duration-200"
              >
                <div className="relative aspect-square overflow-hidden">
                  <LazyImage
                    src={getImageUrlFromImage(image, true)}
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
                        href={getImageUrl(image.url)}
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
            )
          })}
          

        </div>
      ) : (
        <div className="space-y-4">
          {(displayImages ?? []).map((image: any, index: number) => {
            // Handle ghost placeholders
            if (image.isGhost) {
              return (
                <motion.div
                  key={image.id}
                  data-ghost="true"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg shadow-xl border-4 border-dashed border-blue-400 p-4 animate-pulse relative"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-200 to-blue-300 rounded-lg flex-shrink-0 flex items-center justify-center">
                      <div className="text-blue-600 text-lg font-bold">...</div>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-blue-200 rounded w-3/4 animate-pulse"></div>
                      <div className="h-3 bg-blue-200 rounded w-1/2 animate-pulse"></div>
                      <div className="h-3 bg-blue-200 rounded w-1/3 animate-pulse"></div>
                    </div>
                  </div>
                  
                  {/* Debug indicator */}
                  <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                    GHOST
                  </div>
                  <div className="absolute bottom-2 left-2 bg-blue-400 text-white text-xs px-2 py-1 rounded">
                    {image.index + 1}
                  </div>
                </motion.div>
              )
            }

            // Handle real images
            return (
              <motion.div
                key={image.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                    <LazyImage
                      src={getImageUrlFromImage(image, true)}
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
                      href={getImageUrl(image.url)}
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
            )
          })}
          

        </div>
      )}

      {/* Manual Load More Button (fallback) - only show if intersection observer fails */}
      {hasMore && !isLoadingMore && ghostPlaceholders.length === 0 && (
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
      {images.length === 0 && !isLoading && !isFetching && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Camera className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No images yet</h3>
          <p className="text-gray-600">Start building your gallery by uploading some images!</p>
        </div>
      )}

      {/* Refetching State */}
      {isFetching && images.length > 0 && (
        <div className="text-center py-8">
          <div className="flex items-center justify-center space-x-2 text-gray-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Updating gallery...</span>
          </div>
        </div>
      )}
        </>
      ) : (
        <>
          {/* Galleries View */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {galleries.map((gallery: any) => (
              <motion.div
                key={gallery.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden group hover:shadow-md transition-shadow duration-200 cursor-pointer"
                onClick={() => {
                  setSelectedGallery(gallery)
                  setIsGalleryDetailModalOpen(true)
                }}
              >
                <div className="relative aspect-video overflow-hidden">
                  {gallery.coverImage ? (
                    <LazyImage
                      src={getImageUrlFromImage(gallery.coverImage, true)}
                      alt={gallery.coverImage.altText || 'Gallery cover'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <FolderOpen className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                  
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button 
                        className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-colors duration-200"
                        onClick={e => {
                          e.stopPropagation()
                          setSelectedGallery(gallery)
                          setIsGalleryDetailModalOpen(true)
                        }}
                      >
                        <Eye className="h-4 w-4 text-gray-700" />
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="p-4">
                  <h3 className="font-medium text-gray-900 mb-1 truncate">
                    {gallery.name}
                  </h3>
                  {gallery.description && (
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                      {gallery.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="flex items-center">
                      <Calendar className="h-3 w-3 mr-1" />
                      {formatDate(gallery.createdAt)}
                    </span>
                    <span>{gallery._count.images} images</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Empty State for Galleries */}
          {galleries.length === 0 && !galleriesLoading && (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <FolderOpen className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No galleries yet</h3>
              <p className="text-gray-600 mb-4">Create your first gallery to organize your images!</p>
              <button
                onClick={() => setIsNewGalleryModalOpen(true)}
                className="btn-primary flex items-center space-x-2 mx-auto"
              >
                <Plus className="h-4 w-4" />
                <span>Create Gallery</span>
              </button>
            </div>
          )}

          {/* Loading State for Galleries */}
          {galleriesLoading && (
            <div className="text-center py-12">
              <div className="flex items-center justify-center space-x-2 text-gray-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading galleries...</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Image Detail Modal */}
      <ImageDetailModal
        image={selectedImage}
        onClose={() => setSelectedImage(null)}
        onImageUpdate={() => {
          // The optimistic update will handle this automatically
        }}
        updateImage={updateImage}
        allImages={images}
        onNavigate={(image: any) => setSelectedImage(image)}
      />

      {/* New Gallery Modal */}
      <NewGalleryModal
        isOpen={isNewGalleryModalOpen}
        onClose={() => setIsNewGalleryModalOpen(false)}
        userId={userId}
        onGalleryCreated={() => {
          // The query will automatically refetch
        }}
      />

      {/* Gallery Detail Modal */}
      <GalleryDetailModal
        isOpen={isGalleryDetailModalOpen}
        onClose={() => {
          setIsGalleryDetailModalOpen(false)
          setSelectedGallery(null)
        }}
        galleryId={selectedGallery?.id || ''}
        onGalleryDeleted={() => {
          // The query will automatically refetch
        }}
      />
    </div>
  )
}