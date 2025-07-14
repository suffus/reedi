'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Upload, Image as ImageIcon, Check, Search, Grid3X3, List } from 'lucide-react'
import { ImageUploader } from './image-uploader'
import { useUserImages } from '../../lib/api-hooks'
import { getImageUrl, getImageUrlFromImage } from '../../lib/api'
import { LazyImage } from '../lazy-image'

interface Image {
  id: string
  url: string
  thumbnail: string | null
  altText: string | null
  caption: string | null
  tags: string[]
  createdAt: string
}

interface ImageSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  onImagesSelected: (images: Image[]) => void
  userId: string
}

type TabType = 'upload' | 'gallery'
type ViewMode = 'grid' | 'list'

export function ImageSelectorModal({ isOpen, onClose, onImagesSelected, userId }: ImageSelectorModalProps) {
  const [selectedImages, setSelectedImages] = useState<Image[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [tagQuery, setTagQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [uploadedImages, setUploadedImages] = useState<Image[]>([])

  const { 
    data: galleryData, 
    isLoading: galleryLoading, 
    loadMore, 
    hasMore, 
    isLoadingMore 
  } = useUserImages(userId)
  const galleryImages = galleryData?.data?.images || []
  
  // Determine default tab based on whether user has images in gallery
  const defaultTab: TabType = galleryImages.length > 0 ? 'gallery' : 'upload'
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab)
  
  // Note: Removed automatic tab switching to allow users to manually choose upload or gallery

  // Filter images based on search query and tag
  const filteredImages = galleryImages.filter((image: any) =>
    (
      image.caption?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      image.altText?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      image.tags?.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    ) &&
    (
      !tagQuery.trim() || image.tags?.some((tag: string) => tag.toLowerCase() === tagQuery.toLowerCase())
    )
  )

  // Infinite scroll refs
  const observerRef = useRef<IntersectionObserver | null>(null)
  const lastImageRef = useRef<HTMLDivElement | null>(null)

  // Infinite scroll effect
  useEffect(() => {
    console.log('Infinite scroll effect triggered:', {
      hasMore,
      isLoadingMore,
      galleryImagesLength: galleryImages.length,
      filteredImagesLength: filteredImages.length
    })
    
    if (!hasMore || isLoadingMore) return
    
    if (observerRef.current) observerRef.current.disconnect()
    
    observerRef.current = new window.IntersectionObserver(entries => {
      console.log('Intersection observer triggered:', {
        isIntersecting: entries[0].isIntersecting,
        hasMore,
        isLoadingMore
      })
      if (entries[0].isIntersecting) {
        console.log('Loading more images...')
        loadMore()
      }
    }, {
      rootMargin: '100px' // Start loading 100px before the element is visible
    })
    
    if (lastImageRef.current) {
      console.log('Observing last image ref')
      observerRef.current.observe(lastImageRef.current)
    } else {
      console.log('No last image ref found')
    }
    
    return () => {
      observerRef.current?.disconnect()
    }
  }, [galleryImages.length, hasMore, isLoadingMore, loadMore])

  const handleImageToggle = (image: Image) => {
    setSelectedImages(prev => {
      const isSelected = prev.some(img => img.id === image.id)
      if (isSelected) {
        return prev.filter(img => img.id !== image.id)
      } else {
        return [...prev, image]
      }
    })
  }

  const handleUploadComplete = () => {
    // The ImageUploader doesn't return the uploaded images, so we'll just switch to gallery tab
    setActiveTab('gallery') // Switch to gallery tab to show uploaded images
  }

  const handleConfirmSelection = () => {
    onImagesSelected(selectedImages)
    onClose()
    setSelectedImages([])
    setSearchQuery('')
    setTagQuery('')
  }

  const isImageSelected = (imageId: string) => {
    return selectedImages.some(img => img.id === imageId)
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
                {/* Search and View Controls */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="relative flex-1 max-w-md">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search images..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    {/* Tag search input */}
                    <div className="relative max-w-xs">
                      <input
                        type="text"
                        placeholder="Tag..."
                        value={tagQuery}
                        onChange={e => setTagQuery(e.target.value)}
                        className="w-full pl-3 pr-8 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                      {tagQuery && (
                        <button
                          type="button"
                          onClick={() => setTagQuery('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-700 text-xs"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-2 rounded-md transition-colors duration-200 ${
                        viewMode === 'grid'
                          ? 'bg-white text-primary-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Grid3X3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
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

                {/* Selected Images Preview with Drag & Drop */}
                {selectedImages.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-blue-800 font-medium">
                        {selectedImages.length} image{selectedImages.length !== 1 ? 's' : ''} selected
                      </p>
                      <p className="text-xs text-blue-600">Drag to reorder</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedImages.map((image, index) => (
                        <div
                          key={image.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', index.toString())
                            e.dataTransfer.effectAllowed = 'move'
                          }}
                          onDragOver={(e) => {
                            e.preventDefault()
                            e.dataTransfer.dropEffect = 'move'
                          }}
                          onDrop={(e) => {
                            e.preventDefault()
                            const dragIndex = parseInt(e.dataTransfer.getData('text/plain'))
                            if (dragIndex === index) return
                            
                            const newImages = [...selectedImages]
                            const [draggedItem] = newImages.splice(dragIndex, 1)
                            newImages.splice(index, 0, draggedItem)
                            setSelectedImages(newImages)
                          }}
                          className="relative group cursor-move"
                        >
                          <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden border-2 border-blue-300">
                            <LazyImage
                              src={getImageUrlFromImage(image, true)}
                              alt={image.altText || 'Selected image'}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <button
                            onClick={() => handleImageToggle(image)}
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

                {/* Gallery Images */}
                {galleryLoading ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="aspect-square bg-gray-200 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : filteredImages.length === 0 ? (
                  <div className="text-center py-12">
                    <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {searchQuery ? 'No images found' : 'No images in gallery'}
                    </h3>
                    <p className="text-gray-600">
                      {searchQuery ? 'Try adjusting your search terms' : 'Upload some images to get started'}
                    </p>
                  </div>
                ) : viewMode === 'grid' ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredImages.map((image, idx) => {
                      // Find the index of this image in the original galleryImages array
                      const originalIndex = galleryImages.findIndex((galleryImg: any) => galleryImg.id === image.id)
                      const isLastInGallery = originalIndex === galleryImages.length - 1
                      
                      if (isLastInGallery) {
                        console.log('Last image in gallery found (grid):', {
                          imageId: image.id,
                          originalIndex,
                          galleryImagesLength: galleryImages.length
                        })
                      }
                      
                      return (
                        <div
                          key={image.id}
                          ref={isLastInGallery ? lastImageRef : undefined}
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
                    )
                    })}
                    {isLoadingMore && (
                      <div className="col-span-full flex justify-center py-4">
                        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredImages.map((image, idx) => {
                      // Find the index of this image in the original galleryImages array
                      const originalIndex = galleryImages.findIndex((galleryImg: any) => galleryImg.id === image.id)
                      const isLastInGallery = originalIndex === galleryImages.length - 1
                      
                      if (isLastInGallery) {
                        console.log('Last image in gallery found (list):', {
                          imageId: image.id,
                          originalIndex,
                          galleryImagesLength: galleryImages.length
                        })
                      }
                      
                      return (
                        <div
                          key={image.id}
                          ref={isLastInGallery ? lastImageRef : undefined}
                          className={`flex items-center space-x-4 p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                            isImageSelected(image.id) ? 'bg-primary-50 border border-primary-200' : 'hover:bg-gray-50'
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
                          <p className="font-medium text-gray-900 truncate">
                            {image.caption || image.altText || 'Untitled'}
                          </p>
                          {image.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {image.tags?.slice(0, 3).map((tag: string, index: number) => (
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
                        {isImageSelected(image.id) && (
                          <div className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <Check className="h-4 w-4 text-white" />
                          </div>
                        )}
                      </div>
                    )
                    })}
                    {isLoadingMore && (
                      <div className="flex justify-center py-4">
                        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                      </div>
                    )}
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
              Add {selectedImages.length} Image{selectedImages.length !== 1 ? 's' : ''} to Post
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
} 