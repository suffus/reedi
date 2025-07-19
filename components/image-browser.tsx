'use client'

import React, { useState, useMemo } from 'react'
import { ImageGrid } from './image-grid'
import { InfiniteScrollContainer } from './infinite-scroll-container'
import { ImageSearch } from './image-search'
import { useImageSelection } from '../lib/hooks/use-image-selection'

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

interface ImageBrowserProps {
  images: Image[]
  hasMore: boolean
  isLoading: boolean
  onLoadMore: () => void
  selectedImages: Image[]
  onImageSelect?: (image: Image) => void
  onImageClick?: (image: Image) => void
  viewMode?: 'grid' | 'list'
  onViewModeChange?: (mode: 'grid' | 'list') => void
  searchQuery?: string
  onSearchChange?: (query: string) => void
  tagQuery?: string
  onTagChange?: (tags: string) => void
  showSearch?: boolean
  showSelection?: boolean
  showAuthor?: boolean
  showTags?: boolean
  showViewModeToggle?: boolean
  className?: string
  searchPlaceholder?: string
  tagPlaceholder?: string
  emptyMessage?: string
}

export function ImageBrowser({
  images,
  hasMore,
  isLoading,
  onLoadMore,
  selectedImages,
  onImageSelect,
  onImageClick,
  viewMode = 'grid',
  onViewModeChange,
  searchQuery = '',
  onSearchChange,
  tagQuery = '',
  onTagChange,
  showSearch = true,
  showSelection = false,
  showAuthor = false,
  showTags = true,
  showViewModeToggle = true,
  className = '',
  searchPlaceholder = "Search images...",
  tagPlaceholder = "Tag (comma separated)...",
  emptyMessage = "No images found"
}: ImageBrowserProps) {
  const [localViewMode, setLocalViewMode] = useState<'grid' | 'list'>(viewMode)

  // Use local view mode if no external control
  const currentViewMode = onViewModeChange ? viewMode : localViewMode
  const handleViewModeChange = onViewModeChange || setLocalViewMode

  // Filter images based on search and tag queries
  const filteredImages = useMemo(() => {
    if (!searchQuery.trim() && !tagQuery.trim()) {
      return images
    }

    return images.filter((image) => {
      // Check search query
      const matchesSearch = !searchQuery.trim() || (
        image.caption?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        image.altText?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        image.tags?.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      )

      // Check tag query
      const tagArray = tagQuery.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
      const matchesTag = !tagQuery.trim() || tagArray.some(tag => 
        image.tags?.some((imageTag: string) => imageTag.toLowerCase() === tag.toLowerCase())
      )

      return matchesSearch && matchesTag
    })
  }, [images, searchQuery, tagQuery])

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search Controls */}
      {showSearch && (onSearchChange || onTagChange) && (
        <div className="flex items-center justify-between">
          <ImageSearch
            searchQuery={searchQuery}
            tagQuery={tagQuery}
            onSearchChange={onSearchChange || (() => {})}
            onTagChange={onTagChange || (() => {})}
            showTagSearch={!!onTagChange}
            placeholder={searchPlaceholder}
            tagPlaceholder={tagPlaceholder}
            className="flex-1"
          />
        </div>
      )}

      {/* Image Grid with Infinite Scroll */}
      <InfiniteScrollContainer
        hasMore={hasMore}
        isLoading={isLoading}
        onLoadMore={onLoadMore}
      >
        <ImageGrid
          images={filteredImages}
          viewMode={currentViewMode}
          selectedImages={selectedImages}
          onImageClick={onImageClick}
          onImageSelect={onImageSelect}
          isSelectable={showSelection}
          showAuthor={showAuthor}
          showTags={showTags}
          onViewModeChange={handleViewModeChange}
          showViewModeToggle={showViewModeToggle}
        />
      </InfiniteScrollContainer>

      {/* Empty State */}
      {filteredImages.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchQuery || tagQuery ? 'No images found' : emptyMessage}
          </h3>
          <p className="text-gray-600">
            {searchQuery || tagQuery ? 'Try adjusting your search terms' : 'No images to display'}
          </p>
        </div>
      )}
    </div>
  )
} 