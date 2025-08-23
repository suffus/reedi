'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, RefreshCw } from 'lucide-react'
import { useCreateGallery, useAddMediaToGallery, useInfiniteFilteredUserMedia } from '../../lib/api-hooks'
import { MediaGrid } from '../media-grid'
import { Media } from '@/lib/types'
import { mapMediaData } from '@/lib/media-utils'
import { getMediaUrlFromMedia } from '@/lib/api'
import { InfiniteScrollContainer } from '../infinite-scroll-container'
import { TagInput } from '../tag-input'
import { Filter } from 'lucide-react'

interface NewGalleryModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  onGalleryCreated?: () => void
}

export function NewGalleryModal({ isOpen, onClose, userId, onGalleryCreated }: NewGalleryModalProps) {
  const [galleryName, setGalleryName] = useState('')
  const [galleryDescription, setGalleryDescription] = useState('')
  const [galleryVisibility, setGalleryVisibility] = useState<'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE'>('PUBLIC')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)

  // Media selection state
  const [selectedMedia, setSelectedMedia] = useState<Media[]>([])
  const [lastSelectedMediaId, setLastSelectedMediaId] = useState<string | null>(null)

  const createGalleryMutation = useCreateGallery()
  const addMediaToGalleryMutation = useAddMediaToGallery()
  
  // Reset form state when modal opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure proper state reset
      const timer = setTimeout(() => {
        setGalleryName('')
        setGalleryDescription('')
        setGalleryVisibility('PUBLIC')
        setSelectedMedia([])
        setLastSelectedMediaId(null)
        setSearchQuery('')
        setFilterTags([])
        setShowFilters(false)
      }, 0)
      
      return () => clearTimeout(timer)
    }
  }, [isOpen])
  
  // Build filters for the backend
  const mediaFilters = {
    tags: filterTags.length > 0 ? filterTags : undefined,
    title: searchQuery.trim() || undefined,
    // Add other filters as needed
  }

  const { 
    data: galleryData, 
    isLoading: galleryLoading, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage,
    refetch
  } = useInfiniteFilteredUserMedia(userId, mediaFilters)

  // Debounced search effect
  useEffect(() => {
    if (!isOpen) return
    
    const timer = setTimeout(() => {
      refetch()
    }, 300) // 300ms delay
    
    return () => clearTimeout(timer)
  }, [searchQuery, isOpen, refetch])

  // Refetch data when tags change (immediate)
  useEffect(() => {
    if (isOpen) {
      refetch()
    }
  }, [filterTags, isOpen, refetch])
  
  // Map the raw media to our frontend format (flatten pages from infinite query)
  const galleryMedia = (galleryData?.pages || []).flatMap((page: any) => 
    (page.data?.media || []).map((mediaItem: any) => {
      const mapped = mapMediaData(mediaItem)
      return {
        ...mapped,
        url: getMediaUrlFromMedia(mapped, false),
        thumbnail: getMediaUrlFromMedia(mapped, true),
      }
    })
  )

  // Since filtering is now done server-side, we can use the media directly
  const filteredMedia = galleryMedia

  const handleCreateGallery = async () => {
    if (!galleryName.trim()) {
      alert('Please enter a gallery name')
      return
    }

    try {
      // Create the gallery first
      const galleryResult = await createGalleryMutation.mutateAsync({
        name: galleryName.trim(),
        description: galleryDescription.trim() || undefined,
        visibility: galleryVisibility
      })

      // If media is selected, add it to the gallery
      if (selectedMedia.length > 0) {
        await addMediaToGalleryMutation.mutateAsync({
          galleryId: galleryResult.data.gallery.id,
          mediaIds: selectedMedia.map(media => media.id).filter((id): id is string => id !== undefined)
        })
      }

      // Close modal and notify parent
      onClose()
      onGalleryCreated?.()
    } catch (error) {
      console.error('Failed to create gallery:', error)
      alert('Failed to create gallery. Please try again.')
    }
  }

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <div key="new-gallery-modal" className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-screen items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Create New Gallery</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Select media from your collection to create a new gallery
                    <span className="block text-xs text-blue-600 mt-1">
                      💡 Tip: Shift+click to select ranges of media
                    </span>
                  </p>
                </div>
                {/* Refresh Button */}
                <button
                  onClick={() => refetch()}
                  disabled={galleryLoading}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Refresh media"
                >
                  <RefreshCw className={`h-4 w-4 ${galleryLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              {/* Gallery Details Form */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gallery Name *
                  </label>
                  <input
                    type="text"
                    value={galleryName}
                    onChange={(e) => setGalleryName(e.target.value)}
                    placeholder="Enter gallery name..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description (optional)
                  </label>
                  <textarea
                    value={galleryDescription}
                    onChange={(e) => setGalleryDescription(e.target.value)}
                    placeholder="Describe your gallery..."
                    rows={3}
                    className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Visibility
                  </label>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => setGalleryVisibility('PUBLIC')}
                      className={`px-3 py-1 text-sm rounded-none transition-colors ${
                        galleryVisibility === 'PUBLIC'
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Public
                    </button>
                    <button
                      type="button"
                      onClick={() => setGalleryVisibility('FRIENDS_ONLY')}
                      className={`px-3 py-1 text-sm rounded-none transition-colors ${
                        galleryVisibility === 'FRIENDS_ONLY'
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Friends Only
                    </button>
                    <button
                      type="button"
                      onClick={() => setGalleryVisibility('PRIVATE')}
                      className={`px-3 py-1 text-sm rounded-none transition-colors ${
                        galleryVisibility === 'PRIVATE'
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Private
                    </button>
                  </div>
                </div>
              </div>

              {/* Media Selection */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Select Media</h3>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>{selectedMedia.length} media item{selectedMedia.length !== 1 ? 's' : ''} selected</p>
                      {(filterTags.length > 0 || searchQuery.trim()) && (
                        <p className="text-xs text-blue-600">
                          Showing {filteredMedia.length} result{(filteredMedia.length !== 1 ? 's' : '')} from backend filtering
                          {galleryData?.pages?.[0]?.data?.pagination?.total && (
                            <span className="ml-1 text-gray-500">
                              (of {galleryData.pages[0].data.pagination.total} total)
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {/* Search Input */}
                    <div className="relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search media by title..."
                        className="px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      {galleryLoading && (
                        <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                        </div>
                      )}
                    </div>
                    {/* Filter Toggle Button */}
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={`p-2 rounded-lg transition-colors duration-200 ${
                        showFilters
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                      }`}
                      title={filterTags.length > 0 ? `${filterTags.length} filter(s) active` : 'Filter by tags'}
                    >
                      <Filter className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Filter Section */}
                {showFilters && (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-gray-700 flex items-center">
                        <Filter className="h-4 w-4 mr-2" />
                        Filter by Tags
                      </h3>
                      {(filterTags.length > 0 || searchQuery.trim()) && (
                        <button
                          onClick={() => {
                            setFilterTags([])
                            setSearchQuery('')
                          }}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          Clear all filters
                        </button>
                      )}
                    </div>
                    <TagInput
                      tags={filterTags}
                      onTagsChange={setFilterTags}
                      placeholder="Enter tags to filter by (comma-separated)..."
                      className="w-full"
                    />
                    {(filterTags.length > 0 || searchQuery.trim()) && (
                      <p className="text-xs text-gray-500 mt-2">
                        {filterTags.length > 0 && searchQuery.trim() 
                          ? `Showing media that contain all selected tags and match "${searchQuery}"`
                          : filterTags.length > 0 
                            ? 'Showing media that contain all selected tags'
                            : `Showing media that match "${searchQuery}"`
                        }
                      </p>
                    )}
                  </div>
                )}

                {/* Loading State */}
                {galleryLoading && (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    <span className="ml-3 text-gray-600">
                      {searchQuery.trim() || filterTags.length > 0 ? 'Searching...' : 'Loading media...'}
                    </span>
                  </div>
                )}

                {/* No Results State */}
                {!galleryLoading && filteredMedia.length === 0 && (filterTags.length > 0 || searchQuery.trim()) && (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No media found matching your filters.</p>
                    <button
                      onClick={() => {
                        setFilterTags([])
                        setSearchQuery('')
                      }}
                      className="text-primary-600 hover:text-primary-700 text-sm mt-2"
                    >
                      Clear filters
                    </button>
                  </div>
                )}

                {/* Use our reusable MediaGrid component with infinite scroll */}
                <InfiniteScrollContainer
                  hasMore={hasNextPage}
                  isLoading={isFetchingNextPage}
                  onLoadMore={fetchNextPage}
                >
                  <MediaGrid
                    media={filteredMedia}
                    viewMode={viewMode}
                    selectedMedia={selectedMedia}
                    onMediaSelect={(media, event) => {
                      // Check if shift key is pressed and we have a last selected item
                      if (event?.shiftKey && lastSelectedMediaId && lastSelectedMediaId !== media.id) {
                        // Find the indices of the last selected item and current item
                        const lastIndex = filteredMedia.findIndex(m => m.id === lastSelectedMediaId)
                        const currentIndex = filteredMedia.findIndex(m => m.id === media.id)
                        
                        if (lastIndex !== -1 && currentIndex !== -1) {
                          // Determine the range (start and end indices)
                          const startIndex = Math.min(lastIndex, currentIndex)
                          const endIndex = Math.max(lastIndex, currentIndex)
                          
                          // Get all items in the range
                          const rangeMedia = filteredMedia.slice(startIndex, endIndex + 1)
                          
                          // Add all items in the range to selection
                          setSelectedMedia(prev => {
                            const newSelection = [...prev]
                            rangeMedia.forEach(mediaItem => {
                              if (!newSelection.some(m => m.id === mediaItem.id)) {
                                newSelection.push(mediaItem)
                              }
                            })
                            return newSelection
                          })
                        }
                      } else {
                        // Normal selection/deselection
                        setSelectedMedia(prev => {
                          const isSelected = prev.some(m => m.id === media.id)
                          if (isSelected) {
                            return prev.filter(m => m.id !== media.id)
                          } else {
                            return [...prev, media]
                          }
                        })
                      }
                      
                      setLastSelectedMediaId(media.id)
                    }}
                    isSelectable={true}
                    showActions={false}
                    showMediaInfo={true}
                    showDate={true}
                    showTags={true}
                    showViewModeToggle={true}
                  />
                </InfiniteScrollContainer>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                {selectedMedia.length} media item{selectedMedia.length !== 1 ? 's' : ''} selected
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateGallery}
                  disabled={!galleryName.trim() || createGalleryMutation.isPending}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {createGalleryMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      <span>Create Gallery</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
      )}
    </AnimatePresence>
  )
} 