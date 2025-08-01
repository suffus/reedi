'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Upload, Image as ImageIcon, Video, Globe } from 'lucide-react'
import { MediaUploader } from './media-uploader'
import { useUserMedia, useSearchMediaByTags } from '../../lib/api-hooks'
import { MediaGrid } from '../media-grid'
import { Media } from '@/lib/types'
import { mapMediaData } from '@/lib/media-utils'
import { getMediaUrlFromMedia } from '@/lib/api'
import { InfiniteScrollContainer } from '../infinite-scroll-container'
import { TagInput } from '../tag-input'
import { Filter } from 'lucide-react'

interface MediaSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  onMediaSelected: (media: Media[]) => void
  userId: string
  existingGalleryMedia?: Media[]
}

type TabType = 'upload' | 'gallery'

export function MediaSelectorModal({ isOpen, onClose, onMediaSelected, userId, existingGalleryMedia = [] }: MediaSelectorModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [tagQuery, setTagQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchPage, setSearchPage] = useState(1)
  const [showGlobalSearch, setShowGlobalSearch] = useState(false)
  const [selectedMedia, setSelectedMedia] = useState<Media[]>([])
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)

  console.log("userId", userId)

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
      // Use getMediaUrlFromMedia to construct URLs pointing to backend serve endpoints
      url: getMediaUrlFromMedia(mapped, false),
      thumbnail: getMediaUrlFromMedia(mapped, true),
    }
  })

  // Filter local gallery media based on selected tags
  const filteredGalleryMedia = filterTags.length === 0 ? galleryMedia : galleryMedia.filter((mediaItem: any) => {
    // Check if the media has all the selected tags
    return filterTags.every(tag => 
      mediaItem.tags && Array.isArray(mediaItem.tags) && mediaItem.tags.some((mediaTag: string) => 
        mediaTag && typeof mediaTag === 'string' && mediaTag.toLowerCase().includes(tag.toLowerCase())
      )
    )
  })

  // Parse tag query into array
  const tagArray = tagQuery.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
  
  // Search media by tags across all users
  const {
    data: searchData,
    isLoading: searchLoading,
    refetch: refetchSearch
  } = useSearchMediaByTags(tagArray, searchPage, 20)
  
  const searchMedia = (searchData?.data?.media || []).map((mediaItem: any) => {
    const mapped = mapMediaData(mediaItem)
    return {
      ...mapped,
      url: getMediaUrlFromMedia(mapped, false),
      thumbnail: getMediaUrlFromMedia(mapped, true),
    }
  })
  const searchHasMore = searchData?.data?.pagination?.hasNext || false

  // Determine default tab based on whether user has media in gallery
  const defaultTab: TabType = galleryMedia.length > 0 ? 'gallery' : 'upload'
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab)

  // Reset gallery when search query changes
  useEffect(() => {
    if (searchQuery || tagQuery) {
      const timeoutId = setTimeout(() => {
        reset()
        setSearchPage(1)
        setShowGlobalSearch(false)
      }, 500)
      
      return () => clearTimeout(timeoutId)
    }
  }, [searchQuery, tagQuery, reset])

  // Check if we should show global search when tag query changes
  useEffect(() => {
    if (tagArray.length > 0) {
      const localMatches = galleryMedia.filter((media: any) =>
        tagArray.some(tag => media.tags?.some((mediaTag: string) => 
          mediaTag.toLowerCase() === tag.toLowerCase()
        ))
      )
      
      if (localMatches.length < 5) {
        setShowGlobalSearch(true)
      } else {
        setShowGlobalSearch(false)
      }
    } else {
      setShowGlobalSearch(false)
    }
  }, [tagArray, galleryMedia])

  const handleUploadComplete = () => {
    setActiveTab('gallery')
  }

  const handleMediaSelect = (media: Media) => {
    setSelectedMedia(prev => {
      const isSelected = prev.some(m => m.id === media.id)
      if (isSelected) {
        return prev.filter(m => m.id !== media.id)
      } else {
        return [...prev, media]
      }
    })
  }

  const handleConfirmSelection = () => {
    onMediaSelected(selectedMedia)
    onClose()
    setSelectedMedia([])
    setSearchQuery('')
    setTagQuery('')
  }

  const handleLoadMoreSearch = () => {
    setSearchPage(prev => prev + 1)
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Add Media to Gallery</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('upload')}
                className={`px-6 py-3 font-medium transition-colors duration-200 ${
                  activeTab === 'upload'
                    ? 'text-primary-600 border-b-2 border-primary-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Upload className="h-4 w-4 inline mr-2" />
                Upload New
              </button>
              <button
                onClick={() => setActiveTab('gallery')}
                className={`px-6 py-3 font-medium transition-colors duration-200 ${
                  activeTab === 'gallery'
                    ? 'text-primary-600 border-b-2 border-primary-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <div className="flex items-center">
                  <ImageIcon className="h-4 w-4 mr-1" />
                  <Video className="h-4 w-4 mr-2" />
                  Select from Gallery
                </div>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {activeTab === 'upload' ? (
              <MediaUploader
                userId={userId}
                onClose={() => setActiveTab('gallery')}
                onUploadComplete={handleUploadComplete}
                inline={true}
              />
            ) : (
              <div className="space-y-4">
                {/* Global Search Notice */}
                {showGlobalSearch && tagArray.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                      <Globe className="h-4 w-4 text-blue-600" />
                      <p className="text-sm text-blue-800">
                        Searching for media with tags: <span className="font-medium">{tagArray.join(', ')}</span> across all users
                      </p>
                    </div>
                  </div>
                )}

                {/* Selected Media Preview */}
                {selectedMedia.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-blue-800 font-medium">
                        {selectedMedia.length} media item{selectedMedia.length !== 1 ? 's' : ''} selected
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedMedia.map((media, index) => (
                        <div
                          key={media.id}
                          className="relative group"
                        >
                          <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden border-2 border-blue-300">
                            <img
                              src={media.thumbnail || media.url}
                              alt={media.altText || 'Selected media'}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <button
                            onClick={() => handleMediaSelect(media)}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors duration-200 opacity-0 group-hover:opacity-100"
                          >
                            ×
                          </button>
                          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs text-center py-1">
                            {index + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Filter Section */}
                {galleryMedia.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-gray-700">Your Media</h3>
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

                    {/* Filter Controls */}
                    {showFilters && (
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-medium text-gray-700 flex items-center">
                            <Filter className="h-4 w-4 mr-2" />
                            Filter by Tags
                          </h4>
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
                  </div>
                )}

                {/* Local Gallery Media */}
                {galleryMedia.length > 0 && (
                  <div className="mb-6">
                    <InfiniteScrollContainer
                      hasMore={hasMore}
                      isLoading={isLoadingMore}
                      onLoadMore={loadMore}
                    >
                      <MediaGrid
                        media={filteredGalleryMedia}
                        viewMode={viewMode}
                        selectedMedia={selectedMedia}
                        onMediaSelect={handleMediaSelect}
                        isSelectable={true}
                        showActions={false}
                        showMediaInfo={true}
                        showDate={true}
                        showTags={true}
                        showViewModeToggle={true}
                        existingGalleryMedia={existingGalleryMedia}
                      />
                    </InfiniteScrollContainer>
                  </div>
                )}

                {/* Global Search Results */}
                {showGlobalSearch && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                      <Globe className="h-4 w-4 mr-2" />
                      Media from All Users
                    </h3>
                    <InfiniteScrollContainer
                      hasMore={searchHasMore}
                      isLoading={searchLoading}
                      onLoadMore={handleLoadMoreSearch}
                    >
                      <MediaGrid
                        media={searchMedia}
                        viewMode={viewMode}
                        selectedMedia={selectedMedia}
                        onMediaSelect={handleMediaSelect}
                        isSelectable={true}
                        showActions={false}
                        showMediaInfo={true}
                        showDate={true}
                        showTags={true}
                        showViewModeToggle={false}
                        existingGalleryMedia={existingGalleryMedia}
                      />
                    </InfiniteScrollContainer>
                  </div>
                )}

                {/* Empty State for Gallery */}
                {galleryMedia.length === 0 && !galleryLoading && !showGlobalSearch && (
                  <div className="text-center py-12">
                    <div className="flex items-center justify-center space-x-2 mb-4">
                      <ImageIcon className="h-12 w-12 text-gray-400" />
                      <Video className="h-12 w-12 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {searchQuery ? 'No media found' : 'No media in gallery'}
                    </h3>
                    <p className="text-gray-600">
                      {searchQuery ? 'Try adjusting your search terms' : 'Upload some media to get started'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmSelection}
              disabled={selectedMedia.length === 0}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add {selectedMedia.length} Media Item{selectedMedia.length !== 1 ? 's' : ''} to Gallery
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
} 