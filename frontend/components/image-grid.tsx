'use client'

import React from 'react'
import { Check, Grid3X3, List, Eye, Download, Trash2, Star } from 'lucide-react'
import { LazyImage } from './lazy-image'
import { getImageUrlFromImage, getImageUrl } from '../lib/api'

interface Image {
  id: string
  url: string
  thumbnail: string | null
  altText: string | null
  caption: string | null
  tags: string[]
  createdAt: string
  author?: {
    id: string
    name: string
    username: string
    avatar: string | null
  }
}

interface ImageGridProps {
  images: Image[]
  viewMode: 'grid' | 'list'
  selectedImages: Image[]
  onImageClick?: (image: Image) => void
  onImageSelect?: (image: Image) => void
  isSelectable?: boolean
  showAuthor?: boolean
  showTags?: boolean
  onViewModeChange?: (mode: 'grid' | 'list') => void
  showViewModeToggle?: boolean
  className?: string
  existingGalleryImages?: Image[]
  // Enhanced props for different use cases
  showActions?: boolean
  onViewDetails?: (image: Image) => void
  onDownload?: (image: Image) => void
  onDelete?: (image: Image) => void
  onSetCover?: (image: Image) => void
  isDeleting?: boolean
  coverImageId?: string
  showCoverIndicator?: boolean
  showImageInfo?: boolean
  showDate?: boolean
  showFileSize?: boolean
  formatFileSize?: (bytes: number) => string
  formatDate?: (dateString: string) => string
}

export function ImageGrid({
  images,
  viewMode,
  selectedImages,
  onImageClick,
  onImageSelect,
  isSelectable = false,
  showAuthor = false,
  showTags = true,
  onViewModeChange,
  showViewModeToggle = false,
  className = '',
  existingGalleryImages = [],
  // Enhanced props with defaults
  showActions = false,
  onViewDetails,
  onDownload,
  onDelete,
  onSetCover,
  isDeleting = false,
  coverImageId,
  showCoverIndicator = false,
  showImageInfo = false,
  showDate = false,
  showFileSize = false,
  formatFileSize,
  formatDate
}: ImageGridProps) {
  const isImageSelected = (imageId: string) => {
    return selectedImages.some(img => img.id === imageId)
  }

  const isImageInGallery = (imageId: string) => {
    return existingGalleryImages.some(img => img.id === imageId)
  }

  const handleImageClick = (image: Image) => {
    if (isSelectable && onImageSelect) {
      onImageSelect(image)
    } else if (onImageClick) {
      onImageClick(image)
    }
  }

  if (images.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 mb-4">
          <Grid3X3 className="h-12 w-12 mx-auto" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No images found</h3>
        <p className="text-gray-600">No images to display</p>
      </div>
    )
  }

  return (
    <div className={className}>
      {/* View Mode Toggle */}
      {showViewModeToggle && onViewModeChange && (
        <div className="flex items-center justify-end mb-4">
          <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => onViewModeChange('grid')}
              className={`p-2 rounded-md transition-colors duration-200 ${
                viewMode === 'grid'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => onViewModeChange('list')}
              className={`p-2 rounded-md transition-colors duration-200 ${
                viewMode === 'list'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {images.map((image) => (
            <div
              key={image.id}
              className={`relative aspect-square bg-gray-200 rounded-lg overflow-hidden group hover:shadow-md transition-shadow duration-200 ${
                isImageSelected(image.id) ? 'ring-2 ring-primary-500' : 'hover:ring-2 hover:ring-gray-300'
              }`}
              onClick={() => handleImageClick(image)}
            >
              <LazyImage
                src={getImageUrlFromImage(image, true)}
                alt={image.altText || 'Image'}
                className={`w-full h-full object-cover ${isImageInGallery(image.id) ? 'filter brightness-50' : ''} group-hover:scale-105 transition-transform duration-300`}
              />
              
              {/* Cover Image Indicator */}
              {showCoverIndicator && coverImageId === image.id && (
                <div className="absolute top-2 right-2 bg-yellow-500 text-white rounded-full p-1">
                  <Star className="h-3 w-3" />
                </div>
              )}
              
              {/* Gallery Indicator */}
              {isImageInGallery(image.id) && (
                <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                  <div className="bg-white bg-opacity-90 text-gray-800 text-xs px-2 py-1 rounded-full font-medium">
                    Already in Gallery
                  </div>
                </div>
              )}
              
              {/* Selection Indicator */}
              {isSelectable && isImageSelected(image.id) && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center">
                  <Check className="h-4 w-4 text-white" />
                </div>
              )}
              
              {/* Action Buttons Overlay */}
              {showActions && (
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center">
                  <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {onViewDetails && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onViewDetails(image)
                        }}
                        className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-colors duration-200"
                      >
                        <Eye className="h-4 w-4 text-gray-700" />
                      </button>
                    )}
                    {onDownload && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onDownload(image)
                        }}
                        className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-colors duration-200"
                      >
                        <Download className="h-4 w-4 text-gray-700" />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(image)
                        }}
                        disabled={isDeleting}
                        className="p-2 bg-white rounded-full shadow-lg hover:bg-red-50 transition-colors duration-200"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </button>
                    )}
                    {onSetCover && coverImageId !== image.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onSetCover(image)
                        }}
                        className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-colors duration-200"
                        title="Set as cover image"
                      >
                        <Star className="h-4 w-4 text-gray-700" />
                      </button>
                    )}
                  </div>
                </div>
              )}
              
              {/* Author Info */}
              {showAuthor && image.author && (
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                  {image.author.name}
                </div>
              )}
              
              {/* Tags */}
              {showTags && image.tags && image.tags.length > 0 && (
                <div className="absolute top-2 left-2">
                  <div className="flex flex-wrap gap-1">
                    {image.tags.slice(0, 2).map((tag, index) => (
                      <span
                        key={index}
                        className="inline-block px-2 py-1 text-xs bg-black bg-opacity-50 text-white rounded"
                      >
                        {tag}
                      </span>
                    ))}
                    {image.tags.length > 2 && (
                      <span className="inline-block px-2 py-1 text-xs bg-black bg-opacity-50 text-white rounded">
                        +{image.tags.length - 2}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="space-y-3">
          {images.map((image) => (
            <div
              key={image.id}
              className={`flex items-center space-x-4 p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                isImageSelected(image.id) ? 'bg-primary-50 border border-primary-200' : 'hover:bg-gray-50'
              }`}
              onClick={() => handleImageClick(image)}
            >
              <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0 relative">
                <LazyImage
                  src={getImageUrlFromImage(image, true)}
                  alt={image.altText || 'Image'}
                  className={`w-full h-full object-cover ${isImageInGallery(image.id) ? 'filter brightness-50' : ''}`}
                />
                {isImageInGallery(image.id) && (
                  <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                    <div className="bg-white bg-opacity-90 text-gray-800 text-xs px-1 py-0.5 rounded text-center">
                      In Gallery
                    </div>
                  </div>
                )}
                {showCoverIndicator && coverImageId === image.id && (
                  <div className="absolute top-1 right-1 bg-yellow-500 text-white rounded-full p-0.5">
                    <Star className="h-2 w-2" />
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {image.caption || image.altText || 'Untitled'}
                </p>
                
                {showImageInfo && (
                  <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                    {showDate && formatDate && (
                      <span>{formatDate(image.createdAt)}</span>
                    )}
                    {showFileSize && formatFileSize && (image as any).size && (
                      <span>{formatFileSize((image as any).size)}</span>
                    )}
                  </div>
                )}
                
                {showAuthor && image.author && (
                  <p className="text-sm text-gray-600">by {image.author.name}</p>
                )}
                
                {showTags && image.tags && image.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {image.tags.slice(0, 3).map((tag, index) => (
                      <span
                        key={index}
                        className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                    {image.tags.length > 3 && (
                      <span className="text-xs text-gray-500">+{image.tags.length - 3} more</span>
                    )}
                  </div>
                )}
              </div>
              
              {/* Action Buttons */}
              {showActions && (
                <div className="flex space-x-2 flex-shrink-0">
                  {onViewDetails && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onViewDetails(image)
                      }}
                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors duration-200"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  )}
                  {onDownload && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDownload(image)
                      }}
                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors duration-200"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(image)
                      }}
                      disabled={isDeleting}
                      className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors duration-200"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  {onSetCover && coverImageId !== image.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onSetCover(image)
                      }}
                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors duration-200"
                      title="Set as cover image"
                    >
                      <Star className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
              
              {/* Selection Indicator */}
              {isSelectable && isImageSelected(image.id) && (
                <div className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Check className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 