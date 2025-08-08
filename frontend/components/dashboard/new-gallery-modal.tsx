'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus } from 'lucide-react'
import { useCreateGallery, useAddMediaToGallery, useUserMedia } from '../../lib/api-hooks'
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
        setSearchQuery('')
        setFilterTags([])
        setShowFilters(false)
      }, 0)
      
      return () => clearTimeout(timer)
    }
  }, [isOpen])
  
  const { 
    data: galleryData, 
    isLoading: galleryLoading, 
    loadMore, 
    hasMore, 
    isLoadingMore,
    reset
  } = useUserMedia(userId)
  
  // Map the raw media to our frontend format
  const galleryMedia = (galleryData?.data?.media || []).map((mediaItem: any) => {
    const mapped = mapMediaData(mediaItem)
    return {
      ...mapped,
      url: getMediaUrlFromMedia(mapped, false),
      thumbnail: getMediaUrlFromMedia(mapped, true),
    }
  })

  // Filter media based on selected tags
  const filteredMedia = filterTags.length === 0 ? galleryMedia : galleryMedia.filter((mediaItem: any) => {
    // Check if the media has all the selected tags
    return filterTags.every(tag => 
      mediaItem.tags && Array.isArray(mediaItem.tags) && mediaItem.tags.some((mediaTag: string) => 
        mediaTag && typeof mediaTag === 'string' && mediaTag.toLowerCase().includes(tag.toLowerCase())
      )
    )
  })

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
          mediaIds: selectedMedia.map(media => media.id)
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
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Create New Gallery</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Select media from your collection to create a new gallery
                </p>
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
                    <p className="text-sm text-gray-600">
                      {selectedMedia.length} media item{selectedMedia.length !== 1 ? 's' : ''} selected
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
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
                        Showing media that contain all selected tags
                      </p>
                    )}
                  </div>
                )}

                {/* Use our reusable MediaGrid component with infinite scroll */}
                <InfiniteScrollContainer
                  hasMore={hasMore}
                  isLoading={isLoadingMore}
                  onLoadMore={loadMore}
                >
                  <MediaGrid
                    media={filteredMedia}
                    viewMode={viewMode}
                    selectedMedia={selectedMedia}
                    onMediaSelect={(media) => {
                      setSelectedMedia(prev => {
                        const isSelected = prev.some(m => m.id === media.id)
                        if (isSelected) {
                          return prev.filter(m => m.id !== media.id)
                        } else {
                          return [...prev, media]
                        }
                      })
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