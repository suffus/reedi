'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus } from 'lucide-react'
import { useCreateGallery, useAddImagesToGallery, useUserImages } from '../../lib/api-hooks'
import { ImageBrowser } from '../image-browser'
import { useImageSelection } from '../../lib/hooks/use-image-selection'

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

  // Use the reusable image selection hook
  const {
    selectedImages,
    toggleImage,
    clearSelection
  } = useImageSelection([], { allowMultiple: true })

  const createGalleryMutation = useCreateGallery()
  const addImagesToGalleryMutation = useAddImagesToGallery()
  
  const { 
    data: galleryData, 
    isLoading: galleryLoading, 
    loadMore, 
    hasMore, 
    isLoadingMore,
    reset
  } = useUserImages(userId)
  
  const galleryImages = galleryData?.data?.images || []

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

      // If images are selected, add them to the gallery
      if (selectedImages.length > 0) {
        await addImagesToGalleryMutation.mutateAsync({
          galleryId: galleryResult.data.gallery.id,
          imageIds: selectedImages.map(img => img.id)
        })
      }

      // Reset form and close modal
      setGalleryName('')
      setGalleryDescription('')
      setGalleryVisibility('PUBLIC')
      clearSelection()
      setSearchQuery('')
      onClose()
      onGalleryCreated?.()
    } catch (error) {
      console.error('Failed to create gallery:', error)
      alert('Failed to create gallery. Please try again.')
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto">
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
                  Select images from your collection to create a new gallery
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

              {/* Image Selection */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Select Images</h3>
                    <p className="text-sm text-gray-600">
                      {selectedImages.length} image{selectedImages.length !== 1 ? 's' : ''} selected
                    </p>
                  </div>
                </div>

                {/* Use our reusable ImageBrowser component */}
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
                  showSearch={true}
                  showSelection={true}
                  showAuthor={false}
                  showTags={true}
                  showViewModeToggle={true}
                  searchPlaceholder="Search your images..."
                  emptyMessage="No images in your collection"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                {selectedImages.length} image{selectedImages.length !== 1 ? 's' : ''} selected
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
    </AnimatePresence>
  )
} 