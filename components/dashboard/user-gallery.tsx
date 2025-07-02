'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Camera, Download, Trash2, Eye, Calendar } from 'lucide-react'

interface GalleryImage {
  id: string
  url: string
  title: string | null
  description: string | null
  createdAt: string
  tags: string[]
  metadata: {
    width: number
    height: number
    size: number
    format: string
  }
}

interface UserGalleryProps {
  userId: string
}

export function UserGallery({ userId }: UserGalleryProps) {
  const [images, setImages] = useState<GalleryImage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  useEffect(() => {
    fetchGallery()
  }, [userId])

  const fetchGallery = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/galleries/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        console.log(data.data)
        setImages(data.data?.images ?? [])
      }
    } catch (error) {
      console.error('Failed to fetch gallery:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm('Are you sure you want to delete this image?')) return

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/images/${imageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        setImages(images.filter(img => img.id !== imageId))
      }
    } catch (error) {
      console.error('Failed to delete image:', error)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse"></div>
          <div className="h-8 bg-gray-200 rounded w-24 animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 animate-pulse">
              <div className="w-full h-48 bg-gray-200 rounded-lg mb-3"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-serif font-bold text-gray-900">Your Gallery</h2>
          <p className="text-gray-600 mt-1">
            {(images?.length ?? 0)} {(images?.length === 1 ? 'image' : 'images')} in your collection
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

      {/* Images Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {(images ?? []).map((image, index) => (
            <motion.div
              key={image.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden group hover:shadow-md transition-shadow duration-200"
            >
              <div className="relative aspect-square overflow-hidden">
                <img
                  src={image.url}
                  alt={image.title || 'Gallery image'}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                
                {/* Overlay Actions */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center">
                  <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={() => setSelectedImage(image)}
                      className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-colors duration-200"
                    >
                      <Eye className="h-4 w-4 text-gray-700" />
                    </button>
                    <a
                      href={image.url}
                      download
                      className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-colors duration-200"
                    >
                      <Download className="h-4 w-4 text-gray-700" />
                    </a>
                    <button
                      onClick={() => handleDeleteImage(image.id)}
                      className="p-2 bg-white rounded-full shadow-lg hover:bg-red-50 transition-colors duration-200"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-1 truncate">
                  {image.title || 'Untitled'}
                </h3>
                {image.description && (
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                    {image.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{formatFileSize(image.metadata?.size ?? 0)}</span>
                  <span>{(image.metadata?.format ?? '').toUpperCase()}</span>
                </div>
                {(image.tags?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(image.tags ?? []).slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                    {(image.tags?.length ?? 0) > 3 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                        +{(image.tags?.length ?? 0) - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {(images ?? []).map((image, index) => (
            <motion.div
              key={image.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-center space-x-4"
            >
              <div className="relative w-20 h-20 flex-shrink-0">
                <img
                  src={image.url}
                  alt={image.title || 'Gallery image'}
                  className="w-full h-full object-cover rounded-lg"
                />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 mb-1">
                  {image.title || 'Untitled'}
                </h3>
                {image.description && (
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                    {image.description}
                  </p>
                )}
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span className="flex items-center space-x-1">
                    <Calendar className="h-3 w-3" />
                    <span>{formatDate(image.createdAt)}</span>
                  </span>
                  <span>{formatFileSize(image.metadata?.size ?? 0)}</span>
                  <span>{(image.metadata?.format ?? '').toUpperCase()}</span>
                </div>
                {(image.tags?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(image.tags ?? []).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setSelectedImage(image)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <a
                  href={image.url}
                  download
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                >
                  <Download className="h-4 w-4" />
                </a>
                <button
                  onClick={() => handleDeleteImage(image.id)}
                  className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-200"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {images.length === 0 && !isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Camera className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No images yet</h3>
          <p className="text-gray-600">Start building your gallery by uploading some photos!</p>
        </motion.div>
      )}

      {/* Image Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="relative">
              <img
                src={selectedImage.url}
                alt={selectedImage.title || 'Gallery image'}
                className="w-full h-auto max-h-[70vh] object-contain"
              />
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute top-4 right-4 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-75 transition-colors duration-200"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {selectedImage.title || 'Untitled'}
              </h3>
              {selectedImage.description && (
                <p className="text-gray-600 mb-4">{selectedImage.description}</p>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-500">
                <div>
                  <span className="font-medium">Size:</span> {formatFileSize(selectedImage.metadata?.size ?? 0)}
                </div>
                <div>
                  <span className="font-medium">Format:</span> {(selectedImage.metadata?.format ?? '').toUpperCase()}
                </div>
                <div>
                  <span className="font-medium">Dimensions:</span> {selectedImage.metadata?.width ?? 0} × {selectedImage.metadata?.height ?? 0}
                </div>
                <div>
                  <span className="font-medium">Uploaded:</span> {formatDate(selectedImage.createdAt)}
                </div>
              </div>
              {(selectedImage.tags?.length ?? 0) > 0 && (
                <div className="mt-4">
                  <span className="font-medium text-gray-900">Tags:</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(selectedImage.tags ?? []).map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 bg-primary-100 text-primary-700 text-sm rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 