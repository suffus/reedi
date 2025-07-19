'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Image as ImageIcon, Check, Eye, Trash2 } from 'lucide-react'
import { useCreateGallery, useAddImagesToGallery, useUserImages } from '../../lib/api-hooks'
import { getImageUrlFromImage } from '../../lib/api'
import { LazyImage } from '../lazy-image'

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
  const [selectedImages, setSelectedImages] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

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

  // Filter images based on search query
  const filteredImages = galleryImages.filter((image: any) =>
    image.caption?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    image.altText?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    image.tags?.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const handleImageToggle = (image: any) => {
    setSelectedImages(prev => {
      const isSelected = prev.some(img => img.id === image.id)
      if (isSelected) {
        return prev.filter(img => img.id !== image.id)
      } else {
        return [...prev, image]
      }
    })
  }

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
      setSelectedImages([])
      setSearchQuery('')
      onClose()
      onGalleryCreated?.()
    } catch (error) {
      console.error('Failed to create gallery:', error)
      alert('Failed to create gallery. Please try again.')
    }
  }

  const isImageSelected = (imageId: string) => {
    return selectedImages.some(img => img.id === imageId)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
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
                  
                  <div className="flex items-center space-x-2">
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
                  </div>
                </div>

                {/* Search */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search images..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <ImageIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>

                {/* Images Grid/List */}
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredImages.map((image) => (
                      <div
                        key={image.id}
                        className={`relative aspect-square bg-gray-200 rounded-lg overflow-hidden cursor-pointer transition-all duration-200 ${
                          isImageSelected(image.id) ? 'ring-2 ring-primary-500' : 'hover:ring-2 hover:ring-gray-300'
                        }`}
                        onClick={() => handleImageToggle(image)}
                      >
                        <LazyImage
                          src={getImageUrlFromImage(image, true)}
                          alt={image.altText || 'Gallery image'}
                          className="w-full h-full object-cover"
                        />
                        {isImageSelected(image.id) && (
                          <div className="absolute top-2 right-2 w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center">
                            <Check className="h-4 w-4 text-white" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredImages.map((image) => (
                      <div
                        key={image.id}
                        className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                          isImageSelected(image.id) ? 'bg-primary-50 border border-primary-200' : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                        onClick={() => handleImageToggle(image)}
                      >
                        <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                          <LazyImage
                            src={getImageUrlFromImage(image, true)}
                            alt={image.altText || 'Gallery image'}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">
                            {image.altText || image.caption || 'Untitled'}
                          </h4>
                          {image.caption && (
                            <p className="text-sm text-gray-600 truncate">{image.caption}</p>
                          )}
                          <p className="text-xs text-gray-500">{formatDate(image.createdAt)}</p>
                        </div>
                        
                        {isImageSelected(image.id) && (
                          <div className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <Check className="h-4 w-4 text-white" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Load More */}
                {hasMore && (
                  <div className="flex justify-center pt-4">
                    <button
                      onClick={loadMore}
                      disabled={isLoadingMore}
                      className="btn-secondary flex items-center space-x-2 px-6 py-2"
                    >
                      {isLoadingMore ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Loading...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          <span>Load More</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
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