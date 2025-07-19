'use client'

import React from 'react'
import { Check, Grid3X3, List } from 'lucide-react'
import { LazyImage } from './lazy-image'
import { getImageUrlFromImage } from '../lib/api'

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
  className = ''
}: ImageGridProps) {
  const isImageSelected = (imageId: string) => {
    return selectedImages.some(img => img.id === imageId)
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image) => (
            <div
              key={image.id}
              className={`relative aspect-square bg-gray-200 rounded-lg overflow-hidden cursor-pointer transition-all duration-200 ${
                isImageSelected(image.id) ? 'ring-2 ring-primary-500' : 'hover:ring-2 hover:ring-gray-300'
              }`}
              onClick={() => handleImageClick(image)}
            >
              <LazyImage
                src={getImageUrlFromImage(image, true)}
                alt={image.altText || 'Image'}
                className="w-full h-full object-cover"
              />
              
              {/* Selection Indicator */}
              {isSelectable && isImageSelected(image.id) && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center">
                  <Check className="h-4 w-4 text-white" />
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
              <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                <LazyImage
                  src={getImageUrlFromImage(image, true)}
                  alt={image.altText || 'Image'}
                  className="w-full h-full object-cover"
                />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {image.caption || image.altText || 'Untitled'}
                </p>
                
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