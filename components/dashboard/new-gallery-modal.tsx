'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus } from 'lucide-react'
import { useCreateGallery, useAddMediaToGallery, useUserMedia } from '../../lib/api-hooks'
import { MediaGrid } from '../media-grid'
import { Media } from '@/lib/types'
import { mapMediaData } from '@/lib/media-utils'
import { getMediaUrlFromMedia } from '@/lib/api'

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

  // Media selection state
  const [selectedMedia, setSelectedMedia] = useState<Media[]>([])

  const createGalleryMutation = useCreateGallery()
  const addMediaToGalleryMutation = useAddMediaToGallery()
  
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

      // Reset form and close modal
      setGalleryName('')
      setGalleryDescription('')
      setGalleryVisibility('PUBLIC')
      setSelectedMedia([])
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
                </div>

                {/* Use our reusable MediaGrid component */}
                <MediaGrid
                  media={galleryMedia}
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
    </AnimatePresence>
  )
} 