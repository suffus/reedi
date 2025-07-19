'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Upload, Image as ImageIcon, Globe } from 'lucide-react'
import { ImageUploader } from './image-uploader'
import { useUserImages, useSearchImagesByTags } from '../../lib/api-hooks'
import { ImageBrowser } from '../image-browser'
import { useImageSelection } from '../../lib/hooks/use-image-selection'

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

interface ImageSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  onImagesSelected: (images: Image[]) => void
  userId: string
}

type TabType = 'upload' | 'gallery'

export function ImageSelectorModal({ isOpen, onClose, onImagesSelected, userId }: ImageSelectorModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [tagQuery, setTagQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchPage, setSearchPage] = useState(1)
  const [showGlobalSearch, setShowGlobalSearch] = useState(false)

  console.log("userId", userId)

  // Use the reusable image selection hook
  const {
    selectedImages,
    toggleImage,
    clearSelection
  } = useImageSelection([], { allowMultiple: true })

  const { 
    data: galleryData, 
    isLoading: galleryLoading, 
    loadMore, 
    hasMore, 
    isLoadingMore,
    reset
  } = useUserImages(userId)
  const galleryImages = galleryData?.data?.images || []

  // Parse tag query into array
  const tagArray = tagQuery.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
  
  // Search images by tags across all users
  const {
    data: searchData,
    isLoading: searchLoading,
    refetch: refetchSearch
  } = useSearchImagesByTags(tagArray, searchPage, 20)
  
  const searchImages = searchData?.data?.images || []
  const searchHasMore = searchData?.data?.pagination?.hasNext || false

  // Determine default tab based on whether user has images in gallery
  const defaultTab: TabType = galleryImages.length > 0 ? 'gallery' : 'upload'
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
      const localMatches = galleryImages.filter((image: any) =>
        tagArray.some(tag => image.tags?.some((imageTag: string) => 
          imageTag.toLowerCase() === tag.toLowerCase()
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
  }, [tagArray, galleryImages])

  const handleUploadComplete = () => {
    setActiveTab('gallery')
  }

  const handleConfirmSelection = () => {
    onImagesSelected(selectedImages)
    onClose()
    clearSelection()
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
            <h2 className="text-xl font-semibold text-gray-900">Add Images to Post</h2>
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
                <ImageIcon className="h-4 w-4 inline mr-2" />
                Select from Gallery
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {activeTab === 'upload' ? (
              <ImageUploader
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
                        Searching for images with tags: <span className="font-medium">{tagArray.join(', ')}</span> across all users
                      </p>
                    </div>
                  </div>
                )}

                {/* Selected Images Preview */}
                {selectedImages.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-blue-800 font-medium">
                        {selectedImages.length} image{selectedImages.length !== 1 ? 's' : ''} selected
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedImages.map((image, index) => (
                        <div
                          key={image.id}
                          className="relative group"
                        >
                          <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden border-2 border-blue-300">
                            <img
                              src={image.thumbnail || image.url}
                              alt={image.altText || 'Selected image'}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <button
                            onClick={() => toggleImage(image)}
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

                {/* Local Gallery Images */}
                {galleryImages.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Your Images</h3>
                    <ImageBrowser
                      images={galleryImages}
                      hasMore={hasMore}
                      isLoading={galleryLoading}
                      onLoadMore={loadMore}
                      selectedImages={selectedImages}
                      onImageSelect={toggleImage}
                      viewMode={viewMode}
                      onViewModeChange={setViewMode}
                      searchQuery={searchQuery}
                      onSearchChange={setSearchQuery}
                      tagQuery={tagQuery}
                      onTagChange={setTagQuery}
                      showSearch={true}
                      showSelection={true}
                      showAuthor={false}
                      showTags={true}
                      showViewModeToggle={true}
                      searchPlaceholder="Search your images..."
                      emptyMessage="No images in your gallery"
                    />
                  </div>
                )}

                {/* Global Search Results */}
                {showGlobalSearch && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                      <Globe className="h-4 w-4 mr-2" />
                      Images from All Users
                    </h3>
                    <ImageBrowser
                      images={searchImages}
                      hasMore={searchHasMore}
                      isLoading={searchLoading}
                      onLoadMore={handleLoadMoreSearch}
                      selectedImages={selectedImages}
                      onImageSelect={toggleImage}
                      viewMode={viewMode}
                      onViewModeChange={setViewMode}
                      showSearch={false}
                      showSelection={true}
                      showAuthor={true}
                      showTags={true}
                      showViewModeToggle={false}
                      emptyMessage="No images found with these tags"
                    />
                  </div>
                )}

                {/* Empty State for Gallery */}
                {galleryImages.length === 0 && !galleryLoading && !showGlobalSearch && (
                  <div className="text-center py-12">
                    <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {searchQuery ? 'No images found' : 'No images in gallery'}
                    </h3>
                    <p className="text-gray-600">
                      {searchQuery ? 'Try adjusting your search terms' : 'Upload some images to get started'}
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
              disabled={selectedImages.length === 0}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add {selectedImages.length} Image{selectedImages.length !== 1 ? 's' : ''} to XX Post
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
} 