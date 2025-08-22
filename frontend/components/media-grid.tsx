'use client'

import React from 'react'
import { Check, Grid3X3, List, Eye, Download, Trash2, Star, Video, Play } from 'lucide-react'
import { LazyMedia } from './lazy-media'
import { getMediaUrlFromMedia, getMediaUrl } from '../lib/api'
import { Media } from '../lib/types'

interface MediaGridProps {
  media: Media[]
  viewMode: 'grid' | 'list'
  selectedMedia: Media[]
  onMediaClick?: (media: Media) => void
  onMediaSelect?: (media: Media, event?: React.MouseEvent) => void
  isSelectable?: boolean
  showAuthor?: boolean
  showTags?: boolean
  onViewModeChange?: (mode: 'grid' | 'list') => void
  showViewModeToggle?: boolean
  className?: string
  existingGalleryMedia?: Media[]
  // Enhanced props for different use cases
  showActions?: boolean
  onViewDetails?: (media: Media) => void
  onDownload?: (media: Media) => void
  onDelete?: (media: Media) => void
  onSetCover?: (media: Media) => void
  isDeleting?: boolean
  coverMediaId?: string
  showCoverIndicator?: boolean
  showMediaInfo?: boolean
  showDate?: boolean
  showFileSize?: boolean
  formatFileSize?: (bytes: number) => string
  formatDate?: (dateString: string) => string
  // Grid customization
  gridCols?: 'default' | 'gallery' | 'compact'
}

export function MediaGrid({
  media,
  viewMode,
  selectedMedia,
  onMediaClick,
  onMediaSelect,
  isSelectable = false,
  showAuthor = false,
  showTags = true,
  onViewModeChange,
  showViewModeToggle = false,
  className = '',
  existingGalleryMedia = [],
  // Enhanced props with defaults
  showActions = false,
  onViewDetails,
  onDownload,
  onDelete,
  onSetCover,
  isDeleting = false,
  coverMediaId,
  showCoverIndicator = false,
  showMediaInfo = false,
  showDate = false,
  showFileSize = false,
  formatFileSize,
  formatDate,
  gridCols = 'default'
}: MediaGridProps) {
  const isMediaSelected = (mediaId: string) => {
    return selectedMedia.some(m => m.id === mediaId)
  }

  const isMediaInGallery = (mediaId: string) => {
    return existingGalleryMedia.some(m => m.id === mediaId)
  }

  const handleMediaClick = (mediaItem: Media, event: React.MouseEvent, index: number) => {
    if (isSelectable && onMediaSelect) {
      // Pass the event to the parent component for shift-click handling
      onMediaSelect(mediaItem, event)
    } else if (onMediaClick) {
      onMediaClick(mediaItem)
    }
  }

  const getMediaIcon = (mediaType: 'IMAGE' | 'VIDEO') => {
    return mediaType === 'VIDEO' ? <Video className="w-4 h-4" /> : null
  }

  const getMediaTypeLabel = (mediaType: 'IMAGE' | 'VIDEO') => {
    return mediaType === 'VIDEO' ? 'Video' : 'Image'
  }

  const getGridColsClass = () => {
    switch (gridCols) {
      case 'gallery':
        return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
      case 'compact':
        return 'grid-cols-3 md:grid-cols-4 lg:grid-cols-6'
      default:
        return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6'
    }
  }

  if (media.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 mb-4">
          <Grid3X3 className="h-12 w-12 mx-auto" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No media found</h3>
        <p className="text-gray-600">No media to display</p>
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
        <div className={`grid ${getGridColsClass()} gap-4`}>
          {media.map((mediaItem, index) => (
            <div
              key={mediaItem.id}
              className={`relative aspect-square bg-gray-200 rounded-lg overflow-hidden group hover:shadow-md transition-shadow duration-200 ${
                isMediaSelected(mediaItem.id) ? 'ring-2 ring-primary-500' : 'hover:ring-2 hover:ring-gray-300'
              }`}
              onClick={(event) => handleMediaClick(mediaItem, event, index)}
            >
              <LazyMedia
                src={getMediaUrlFromMedia(mediaItem, true)}
                alt={mediaItem.altText || 'Media'}
                mediaType={mediaItem.mediaType}
                className={`w-full h-full object-cover ${isMediaInGallery(mediaItem.id) ? 'filter brightness-50' : ''} group-hover:scale-105 transition-transform duration-300`}
              />
              
              {/* Video Play Icon - REMOVED since we have video indicator */}
              
              {/* Media Type Indicator - Only show for videos */}
              {mediaItem.mediaType === 'VIDEO' && (
                <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-full flex items-center space-x-1">
                  {getMediaIcon(mediaItem.mediaType)}
                  <span>{getMediaTypeLabel(mediaItem.mediaType)}</span>
                </div>
              )}
              
              {/* Cover Media Indicator */}
              {showCoverIndicator && coverMediaId === mediaItem.id && (
                <div className="absolute top-2 right-2 bg-yellow-500 text-white rounded-full p-1">
                  <Star className="h-3 w-3" />
                </div>
              )}
              
              {/* Gallery Indicator */}
              {isMediaInGallery(mediaItem.id) && (
                <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                  <div className="bg-white bg-opacity-90 text-gray-800 text-xs px-2 py-1 rounded-full font-medium">
                    Already in Gallery
                  </div>
                </div>
              )}
              
              {/* Selection Indicator */}
              {isSelectable && isMediaSelected(mediaItem.id) && (
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
                          onViewDetails(mediaItem)
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
                          onDownload(mediaItem)
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
                          onDelete(mediaItem)
                        }}
                        disabled={isDeleting}
                        className="p-2 bg-white rounded-full shadow-lg hover:bg-red-50 transition-colors duration-200 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </button>
                    )}
                    {onSetCover && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onSetCover(mediaItem)
                        }}
                        className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-colors duration-200"
                      >
                        <Star className="h-4 w-4 text-gray-700" />
                      </button>
                    )}
                  </div>
                </div>
              )}
              
              {/* Media Info Overlay */}
              {showMediaInfo && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-3 text-white">
                  <div className="text-sm font-medium truncate">
                    {mediaItem.altText || 'Untitled'}
                  </div>
                  {showDate && (
                    <div className="text-xs opacity-75">
                      {formatDate ? formatDate(mediaItem.createdAt) : new Date(mediaItem.createdAt).toLocaleDateString()}
                    </div>
                  )}
                  {showFileSize && mediaItem.size && (
                    <div className="text-xs opacity-75">
                      {formatFileSize ? formatFileSize(mediaItem.size) : `${(mediaItem.size / 1024 / 1024).toFixed(1)} MB`}
                    </div>
                  )}
                  {showTags && mediaItem.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {mediaItem.tags.slice(0, 2).map((tag, index) => (
                        <span key={index} className="text-xs bg-white bg-opacity-20 px-1 rounded">
                          {tag}
                        </span>
                      ))}
                      {mediaItem.tags.length > 2 && (
                        <span className="text-xs opacity-75">+{mediaItem.tags.length - 2}</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        // List View
        <div className="space-y-4">
          {media.map((mediaItem, index) => (
            <div
              key={mediaItem.id}
              className={`flex items-center space-x-4 p-4 bg-white rounded-lg border hover:shadow-md transition-shadow duration-200 ${
                isMediaSelected(mediaItem.id) ? 'ring-2 ring-primary-500' : 'hover:ring-2 hover:ring-gray-300'
              }`}
              onClick={(event) => handleMediaClick(mediaItem, event, index)}
            >
              {/* Thumbnail */}
              <div className="relative w-20 h-20 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                <LazyMedia
                  src={getMediaUrlFromMedia(mediaItem, true)}
                  alt={mediaItem.altText || 'Media'}
                  mediaType={mediaItem.mediaType}
                  className="w-full h-full object-cover"
                />
                {/* Video Play Icon - REMOVED since we have video indicator */}
              </div>
              
              {/* Media Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  {getMediaIcon(mediaItem.mediaType)}
                  <h3 className="text-sm font-medium text-gray-900 truncate">
                    {mediaItem.altText || 'Untitled'}
                  </h3>
                  {mediaItem.mediaType === 'VIDEO' && (
                    <span className="text-xs text-gray-500">
                      ({getMediaTypeLabel(mediaItem.mediaType)})
                    </span>
                  )}
                </div>
                
                {mediaItem.caption && (
                  <p className="text-sm text-gray-600 truncate mb-1">
                    {mediaItem.caption}
                  </p>
                )}
                
                {showTags && mediaItem.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1">
                    {mediaItem.tags.slice(0, 3).map((tag, index) => (
                      <span key={index} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                        {tag}
                      </span>
                    ))}
                    {mediaItem.tags.length > 3 && (
                      <span className="text-xs text-gray-500">+{mediaItem.tags.length - 3}</span>
                    )}
                  </div>
                )}
                
                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  {showDate && (
                    <span>
                      {formatDate ? formatDate(mediaItem.createdAt) : new Date(mediaItem.createdAt).toLocaleDateString()}
                    </span>
                  )}
                  {showFileSize && mediaItem.size && (
                    <span>
                      {formatFileSize ? formatFileSize(mediaItem.size) : `${(mediaItem.size / 1024 / 1024).toFixed(1)} MB`}
                    </span>
                  )}
                  {showAuthor && (
                    <span>by Unknown User</span>
                  )}
                </div>
              </div>
              
              {/* Action Buttons */}
              {showActions && (
                <div className="flex items-center space-x-2">
                  {onViewDetails && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onViewDetails(mediaItem)
                      }}
                      className="p-2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  )}
                  {onDownload && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDownload(mediaItem)
                      }}
                      className="p-2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(mediaItem)
                      }}
                      disabled={isDeleting}
                      className="p-2 text-red-400 hover:text-red-600 transition-colors duration-200 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  {onSetCover && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onSetCover(mediaItem)
                      }}
                      className="p-2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                    >
                      <Star className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
              
              {/* Selection Indicator */}
              {isSelectable && isMediaSelected(mediaItem.id) && (
                <div className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center">
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