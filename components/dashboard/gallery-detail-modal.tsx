'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, Eye, Download, Trash2, Calendar, Settings, Users, Lock, Globe, 
  Edit3, Save, X as XIcon, ChevronUp, ChevronDown, Star, StarOff,
  Plus, Image as ImageIcon, Check, Tag, Type, FileText
} from 'lucide-react'
import { 
  useGallery, 
  useRemoveImagesFromGallery, 
  useDeleteGallery, 
  useUpdateGallery,
  useReorderGalleryImages,
  useSetGalleryCover,
  useUserImages,
  useAuth,
  useBulkUpdateImages
} from '../../lib/api-hooks'
import { ImageDetailModal } from './image-detail-modal'
import { ImageSelectorModal } from './image-selector-modal'
import { getImageUrlFromImage, API_BASE_URL, getAuthHeaders } from '../../lib/api'
import { LazyImage } from '../lazy-image'
import { useImageSelection } from '../../lib/hooks/use-image-selection'
import { FullScreenWrapper } from '../full-screen-wrapper'
import { TagInput } from '../tag-input'
import { GalleryImage } from '@/lib/types'
import { mapImageData } from '@/lib/image-utils'

interface GalleryDetailModalProps {
  isOpen: boolean
  onClose: () => void
  galleryId: string
  onGalleryDeleted?: () => void
}

export function GalleryDetailModal({ isOpen, onClose, galleryId, onGalleryDeleted }: GalleryDetailModalProps) {
  const [selectedImage, setSelectedImage] = useState<any>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', description: '', visibility: 'PUBLIC' as const })
  const [showImageSelector, setShowImageSelector] = useState(false)
  const [reorderMode, setReorderMode] = useState(false)
  const [orderedImages, setOrderedImages] = useState<any[]>([])
  const [isReordering, setIsReordering] = useState(false)
  const [draggedImage, setDraggedImage] = useState<any>(null)
  const [dragOverImage, setDragOverImage] = useState<any>(null)
  
  // Bulk editing state
  const [bulkEditMode, setBulkEditMode] = useState(false)
  const [bulkEditForm, setBulkEditForm] = useState({
    title: '',
    description: '',
    tags: [] as string[]
  })
  const [showBulkEditForm, setShowBulkEditForm] = useState(false)

  // Use the reusable image selection hook for bulk editing
  const {
    selectedImages,
    toggleImage,
    clearSelection,
    selectImages
  } = useImageSelection([], { allowMultiple: true })

  const { data: galleryData, isLoading, error, refetch: refetchGallery } = useGallery(galleryId)
  const { data: userImagesData } = useUserImages('me')
  const { data: authData } = useAuth()
  const removeImagesMutation = useRemoveImagesFromGallery()
  const deleteGalleryMutation = useDeleteGallery()
  const updateGalleryMutation = useUpdateGallery()
  const reorderImagesMutation = useReorderGalleryImages()
  const setCoverMutation = useSetGalleryCover()
  const bulkUpdateImagesMutation = useBulkUpdateImages()

  const gallery = galleryData?.data?.gallery
  const images = gallery?.images || []
  const userImages = userImagesData?.data?.images || []
  const currentUserId = authData?.data?.user?.id
  const isOwner = currentUserId === gallery?.authorId

  // Initialize edit form when gallery data loads or changes
  useEffect(() => {
    if (gallery && !isEditing) {
      setEditForm({
        name: gallery.name,
        description: gallery.description || '',
        visibility: gallery.visibility
      })
    }
  }, [gallery?.id, gallery?.name, gallery?.description, gallery?.visibility, isEditing])

  // Initialize ordered images when gallery data loads
  useEffect(() => {
    if (gallery && images.length > 0) {
      //console.log('Gallery images:', images)
      const validImages = images.filter((img: any) => img && img.id && typeof img.id === 'string' && img.id.length > 0)
      console.log('Valid images:', validImages)
      setOrderedImages([...validImages].sort((a: any, b: any) => (a.order || 0) - (b.order || 0)))
    } else if (gallery && images.length === 0) {
      setOrderedImages([])
    }
  }, [gallery, images])

  const handleRemoveImage = async (imageId: string) => {
    if (!gallery) return
    
    try {
      await removeImagesMutation.mutateAsync({
        galleryId: gallery.id,
        imageIds: [imageId]
      })
    } catch (error) {
      console.error('Failed to remove image from gallery:', error)
      alert('Failed to remove image from gallery. Please try again.')
    }
  }

  const handleDeleteGallery = async () => {
    if (!gallery) return
    
    if (!confirm('Are you sure you want to delete this gallery? This action cannot be undone.')) {
      return
    }
    
    try {
      await deleteGalleryMutation.mutateAsync(gallery.id)
      onClose()
      onGalleryDeleted?.()
    } catch (error) {
      console.error('Failed to delete gallery:', error)
      alert('Failed to delete gallery. Please try again.')
    }
  }

  const handleSaveEdit = async () => {
    if (!gallery) return
    
    try {
      await updateGalleryMutation.mutateAsync({
        galleryId: gallery.id,
        ...editForm
      })
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to update gallery:', error)
      alert('Failed to update gallery. Please try again.')
    }
  }

  const handleCancelEdit = () => {
    if (gallery) {
      setEditForm({
        name: gallery.name,
        description: gallery.description || '',
        visibility: gallery.visibility
      })
    }
    setIsEditing(false)
  }

  const handleDragStart = useCallback((e: React.DragEvent, image: any) => {
    if (!image || !image.id) return
    setDraggedImage(image)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', image.id)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, image: any) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (image && image.id !== draggedImage?.id) {
      setDragOverImage(image)
    }
  }, [draggedImage])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOverImage(null)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent, targetImage: any) => {
    e.preventDefault()
    
    if (!gallery || !draggedImage || !targetImage || draggedImage.id === targetImage.id || isReordering) {
      setDraggedImage(null)
      setDragOverImage(null)
      return
    }

    const draggedIndex = orderedImages.findIndex(img => img.id === draggedImage.id)
    const targetIndex = orderedImages.findIndex(img => img.id === targetImage.id)
    
    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedImage(null)
      setDragOverImage(null)
      return
    }

    // Create new order by moving dragged item to target position
    const newOrder = [...orderedImages]
    const [draggedItem] = newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, draggedItem)

    console.log('Reordering images:', { draggedIndex, targetIndex, newOrder })
    
    // Set reordering flag to prevent multiple calls
    setIsReordering(true)
    
    // Update local state immediately for optimistic UI
    setOrderedImages(newOrder)
    
    try {
      const imageIds = newOrder.map(img => img.id)
      await reorderImagesMutation.mutateAsync({
        galleryId: gallery.id,
        imageIds
      })
    } catch (error) {
      console.error('Failed to reorder images:', error)
      alert('Failed to reorder images. Please try again.')
      // Revert to original order
      const validImages = images.filter((img: any) => img && img.id && typeof img.id === 'string' && img.id.length > 0)
      setOrderedImages([...validImages].sort((a: any, b: any) => (a.order || 0) - (b.order || 0)))
    } finally {
      setIsReordering(false)
    }
    
    setDraggedImage(null)
    setDragOverImage(null)
  }, [gallery, draggedImage, orderedImages, isReordering, reorderImagesMutation, images])

  const handleDragEnd = useCallback(() => {
    setDraggedImage(null)
    setDragOverImage(null)
  }, [])

  const handleSetCover = async (imageId: string) => {
    if (!gallery) return
    
    try {
      await setCoverMutation.mutateAsync({
        galleryId: gallery.id,
        imageId: gallery.coverImageId === imageId ? undefined : imageId
      })
    } catch (error) {
      console.error('Failed to set cover image:', error)
      alert('Failed to set cover image. Please try again.')
    }
  }

  // Bulk editing handlers
  const handleBulkEditToggle = () => {
    setBulkEditMode(!bulkEditMode)
    if (bulkEditMode) {
      clearSelection()
      setShowBulkEditForm(false)
    }
  }

  const handleSelectAllImages = () => {
    selectImages(orderedImages)
  }

  const handleDeselectAllImages = () => {
    clearSelection()
  }

  const handleBulkEditSubmit = async () => {
    if (selectedImages.length === 0) {
      alert('Please select at least one image to edit.')
      return
    }

    const imageIds = selectedImages.map(img => img.id)
    const updates: any = {}
    let hasUpdates = false

    // Only include title if it's provided
    if (bulkEditForm.title.trim()) {
      updates.title = bulkEditForm.title.trim()
      hasUpdates = true
    }

    // Only include description if it's provided
    if (bulkEditForm.description.trim()) {
      updates.description = bulkEditForm.description.trim()
      hasUpdates = true
    }

    // Handle tags - merge with existing tags
    if (bulkEditForm.tags.length > 0) {
      updates.tags = bulkEditForm.tags
      updates.mergeTags = true // Flag to indicate we want to merge tags
      hasUpdates = true
    }

    if (!hasUpdates) {
      alert('Please provide at least one field to update.')
      return
    }

    try {
      await bulkUpdateImagesMutation.mutateAsync({
        imageIds,
        ...updates,
        onOptimisticUpdate: (imageId: string, imageUpdates: any) => {
          // Update local state optimistically
          setOrderedImages(prev => 
            prev.map(img => 
              img.id === imageId 
                ? { 
                    ...img, 
                    ...imageUpdates,
                    // Handle tag merging for optimistic updates
                    tags: updates.mergeTags && updates.tags 
                      ? Array.from(new Set([...(img.tags || []), ...updates.tags]))
                      : imageUpdates.tags || img.tags
                  }
                : img
            )
          )
        }
      })

      // Reset form and exit bulk edit mode
      setBulkEditForm({ title: '', description: '', tags: [] })
      setShowBulkEditForm(false)
      setBulkEditMode(false)
      clearSelection()
      
      alert(`Successfully updated ${selectedImages.length} image${selectedImages.length !== 1 ? 's' : ''}.`)
    } catch (error) {
      console.error('Failed to bulk update images:', error)
      alert('Failed to update images. Please try again.')
    }
  }

  const handleBulkEditCancel = () => {
    setBulkEditForm({ title: '', description: '', tags: [] })
    setShowBulkEditForm(false)
    setBulkEditMode(false)
    clearSelection()
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case 'PUBLIC':
        return <Globe className="h-4 w-4" />
      case 'FRIENDS_ONLY':
        return <Users className="h-4 w-4" />
      case 'PRIVATE':
        return <Lock className="h-4 w-4" />
      default:
        return <Globe className="h-4 w-4" />
    }
  }

  const getVisibilityText = (visibility: string) => {
    switch (visibility) {
      case 'PUBLIC':
        return 'Public'
      case 'FRIENDS_ONLY':
        return 'Friends Only'
      case 'PRIVATE':
        return 'Private'
      default:
        return 'Public'
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
            className="relative bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex-1">
                {isLoading ? (
                  <div className="animate-pulse">
                    <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  </div>
                ) : gallery ? (
                  <>
                    {isEditing ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full text-xl font-semibold text-gray-900 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          placeholder="Gallery name"
                        />
                        <textarea
                          value={editForm.description}
                          onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                          className="w-full text-sm text-gray-600 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                          placeholder="Gallery description (optional)"
                          rows={2}
                        />
                        <select
                          value={editForm.visibility}
                          onChange={(e) => setEditForm(prev => ({ ...prev, visibility: e.target.value as any }))}
                          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="PUBLIC">Public</option>
                          <option value="FRIENDS_ONLY">Friends Only</option>
                          <option value="PRIVATE">Private</option>
                        </select>
                      </div>
                    ) : (
                      <>
                        <h2 className="text-xl font-semibold text-gray-900">{gallery.name}</h2>
                        <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                          <span className="flex items-center">
                            {getVisibilityIcon(gallery.visibility)}
                            <span className="ml-1">{getVisibilityText(gallery.visibility)}</span>
                          </span>
                          <span className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {formatDate(gallery.createdAt)}
                          </span>
                          <span>{images.length} image{images.length !== 1 ? 's' : ''}</span>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <h2 className="text-xl font-semibold text-gray-900">Gallery Not Found</h2>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                {gallery && isOwner && (
                  <>
                    {isEditing ? (
                      <>
                        <button
                          onClick={handleSaveEdit}
                          disabled={updateGalleryMutation.isPending}
                          className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors duration-200"
                          title="Save Changes"
                        >
                          <Save className="h-5 w-5" />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                          title="Cancel Edit"
                        >
                          <XIcon className="h-5 w-5" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                        title="Edit Gallery"
                      >
                        <Edit3 className="h-5 w-5" />
                      </button>
                    )}
                    <button
                      onClick={handleDeleteGallery}
                      disabled={deleteGalleryMutation.isPending}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                      title="Delete Gallery"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </>
                )}
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              {isLoading ? (
                <div className="text-center py-12">
                  <div className="flex items-center justify-center space-x-2 text-gray-600">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
                    <span>Loading gallery...</span>
                  </div>
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-4">
                    <Settings className="h-12 w-12 mx-auto" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Gallery</h3>
                  <p className="text-gray-600">Failed to load gallery details. Please try again.</p>
                </div>
              ) : !gallery ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-4">
                    <Settings className="h-12 w-12 mx-auto" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Gallery Not Found</h3>
                  <p className="text-gray-600">The requested gallery could not be found.</p>
                </div>
              ) : (
                <>
                  {/* Gallery Description */}
                  {!isEditing && gallery.description && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                      <p className="text-gray-700">{gallery.description}</p>
                    </div>
                  )}

                  {/* Action Bar */}
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-medium text-gray-900">Images</h3>
                    <div className="flex items-center space-x-2">
                      {isOwner && (
                        <>
                          <button
                            onClick={() => setShowImageSelector(true)}
                            className="flex items-center space-x-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors duration-200"
                          >
                            <Plus className="h-4 w-4" />
                            <span>Add Images</span>
                          </button>
                          <button
                            onClick={() => setReorderMode(!reorderMode)}
                            className={`px-3 py-2 rounded-lg transition-colors duration-200 ${
                              reorderMode
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {reorderMode ? 'Done Reordering' : 'Reorder'}
                          </button>
                          <button
                            onClick={handleBulkEditToggle}
                            className={`px-3 py-2 rounded-lg transition-colors duration-200 ${
                              bulkEditMode
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {bulkEditMode ? 'Done Bulk Edit' : 'Bulk Edit'}
                          </button>
                        </>
                      )}
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
                  </div>

                  {/* Bulk Edit Selection Bar */}
                  {bulkEditMode && (
                    <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <span className="text-sm font-medium text-blue-900">
                            {selectedImages.length} image{selectedImages.length !== 1 ? 's' : ''} selected
                          </span>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={handleSelectAllImages}
                              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors duration-200"
                            >
                              Select All
                            </button>
                            <button
                              onClick={handleDeselectAllImages}
                              className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors duration-200"
                            >
                              Clear Selection
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setShowBulkEditForm(!showBulkEditForm)}
                            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors duration-200"
                          >
                            {showBulkEditForm ? 'Hide Form' : 'Edit Selected'}
                          </button>
                          <button
                            onClick={handleBulkEditCancel}
                            className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors duration-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bulk Edit Form */}
                  {bulkEditMode && showBulkEditForm && (
                    <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
                      <h4 className="text-sm font-medium text-green-900 mb-3">Bulk Edit {selectedImages.length} Image{selectedImages.length !== 1 ? 's' : ''}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-green-800 mb-1">
                            <Type className="h-4 w-4 inline mr-1" />
                            Title
                          </label>
                          <input
                            type="text"
                            value={bulkEditForm.title}
                            onChange={(e) => setBulkEditForm(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="Common title for all images"
                            className="w-full px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-green-800 mb-1">
                            <FileText className="h-4 w-4 inline mr-1" />
                            Description
                          </label>
                          <input
                            type="text"
                            value={bulkEditForm.description}
                            onChange={(e) => setBulkEditForm(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Common description for all images"
                            className="w-full px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-green-800 mb-1">
                            <Tag className="h-4 w-4 inline mr-1" />
                            Add Tags (will be merged with existing tags)
                          </label>
                          <TagInput
                            tags={bulkEditForm.tags}
                            onTagsChange={(tags) => setBulkEditForm(prev => ({ ...prev, tags }))}
                            placeholder="Enter tags to add..."
                            className="w-full"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-end space-x-2 mt-4">
                        <button
                          onClick={handleBulkEditCancel}
                          className="px-4 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors duration-200"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleBulkEditSubmit}
                          disabled={bulkUpdateImagesMutation.isPending || selectedImages.length === 0}
                          className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {bulkUpdateImagesMutation.isPending ? 'Updating...' : `Update ${selectedImages.length} Image${selectedImages.length !== 1 ? 's' : ''}`}
                        </button>
                      </div>
                    </div>
                  )}

                                    {/* Images Grid/List */}
                  {viewMode === 'grid' ? (
                    reorderMode ? (
                      orderedImages.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {orderedImages.map((image: any, index: number) => (
                            <div
                              key={image.id || `image-${index}`}
                              draggable
                              onDragStart={(e: React.DragEvent) => handleDragStart(e, image)}
                              onDragOver={(e: React.DragEvent) => handleDragOver(e, image)}
                              onDragLeave={(e: React.DragEvent) => handleDragLeave(e)}
                              onDrop={(e: React.DragEvent) => handleDrop(e, image)}
                              onDragEnd={(e: React.DragEvent) => handleDragEnd()}
                              className={`relative aspect-square bg-gray-200 rounded-lg overflow-hidden group hover:shadow-md transition-shadow duration-200 cursor-move ${
                                draggedImage?.id === image.id ? 'opacity-50' : ''
                              } ${
                                dragOverImage?.id === image.id ? 'ring-2 ring-blue-500' : ''
                              }`}
                            >
                              <LazyImage
                                src={getImageUrlFromImage(image, true)}
                                alt={image.altText || 'Gallery image'}
                                className="w-full h-full object-cover pointer-events-none"
                              />
                              
                              {/* Reorder Overlay */}
                              <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                                <div className="bg-white rounded-full p-2">
                                  <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                                </div>
                              </div>

                              {/* Cover Image Indicator */}
                              {gallery.coverImageId === image.id && (
                                <div className="absolute top-2 right-2 bg-yellow-500 text-white rounded-full p-1">
                                  <Star className="h-3 w-3" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <div className="text-gray-400 mb-4">
                            <ImageIcon className="h-12 w-12 mx-auto" />
                          </div>
                          <h3 className="text-lg font-medium text-gray-900 mb-2">No images to reorder</h3>
                          <p className="text-gray-600">Add some images to the gallery first.</p>
                        </div>
                      )
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {orderedImages.map((image: any, index: number) => (
                          <motion.div
                            key={image.id || `image-${index}`}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={`relative aspect-square bg-gray-200 rounded-lg overflow-hidden group hover:shadow-md transition-shadow duration-200 ${
                              bulkEditMode && selectedImages.some(img => img.id === image.id) 
                                ? 'ring-2 ring-green-500' 
                                : ''
                            }`}
                          >
                            <LazyImage
                              src={getImageUrlFromImage(image, true)}
                              alt={image.altText || 'Gallery image'}
                              className={`w-full h-full object-cover ${bulkEditMode ? 'cursor-pointer' : 'cursor-pointer'}`}
                              onClick={() => {
                                if (bulkEditMode) {
                                  toggleImage(image)
                                } else {
                                  setSelectedImage(image)
                                }
                              }}
                            />
                            
                            {/* Bulk Edit Selection Checkbox */}
                            {bulkEditMode && (
                              <div className="absolute top-2 left-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleImage(image)
                                  }}
                                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors duration-200 ${
                                    selectedImages.some(img => img.id === image.id)
                                      ? 'bg-green-500 border-green-500 text-white'
                                      : 'bg-white border-gray-300 hover:border-green-400'
                                  }`}
                                >
                                  {selectedImages.some(img => img.id === image.id) && (
                                    <Check className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                            )}
                            
                            {/* Cover Image Indicator */}
                            {gallery.coverImageId === image.id && (
                              <div className="absolute top-2 right-2 bg-yellow-500 text-white rounded-full p-1">
                                <Star className="h-3 w-3" />
                              </div>
                            )}
                            
                            {/* Overlay Actions */}
                            {!bulkEditMode && (
                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center">
                                <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                  <button
                                    onClick={() => setSelectedImage(image)}
                                    className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-colors duration-200"
                                  >
                                    <Eye className="h-4 w-4 text-gray-700" />
                                  </button>
                                  <a
                                    href={getImageUrlFromImage(image, false)}
                                    download
                                    className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-colors duration-200"
                                  >
                                    <Download className="h-4 w-4 text-gray-700" />
                                  </a>
                                  {isOwner && (
                                    <>
                                      <button
                                        onClick={() => handleSetCover(image.id)}
                                        className={`p-2 rounded-full shadow-lg transition-colors duration-200 ${
                                          gallery.coverImageId === image.id
                                            ? 'bg-yellow-500 text-white'
                                            : 'bg-white text-gray-700 hover:bg-yellow-50'
                                        }`}
                                      >
                                        {gallery.coverImageId === image.id ? (
                                          <StarOff className="h-4 w-4" />
                                        ) : (
                                          <Star className="h-4 w-4" />
                                        )}
                                      </button>
                                      <button
                                        onClick={() => handleRemoveImage(image.id)}
                                        disabled={removeImagesMutation.isPending}
                                        className="p-2 bg-white rounded-full shadow-lg hover:bg-red-50 transition-colors duration-200"
                                      >
                                        <Trash2 className="h-4 w-4 text-red-600" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    )
                                    ) : (
                    reorderMode ? (
                      orderedImages.length > 0 ? (
                        <div className="space-y-4">
                          {orderedImages.map((image: any, index: number) => (
                            <div
                              key={image.id || `image-${index}`}
                              draggable
                              onDragStart={(e: React.DragEvent) => handleDragStart(e, image)}
                              onDragOver={(e: React.DragEvent) => handleDragOver(e, image)}
                              onDragLeave={(e: React.DragEvent) => handleDragLeave(e)}
                              onDrop={(e: React.DragEvent) => handleDrop(e, image)}
                              onDragEnd={(e: React.DragEvent) => handleDragEnd()}
                              className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 cursor-move ${
                                draggedImage?.id === image.id ? 'opacity-50' : ''
                              } ${
                                dragOverImage?.id === image.id ? 'ring-2 ring-blue-500' : ''
                              }`}
                            >
                            <div className="flex items-center space-x-4">
                              <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                                <LazyImage
                                  src={getImageUrlFromImage(image, true)}
                                  alt={image.altText || 'Gallery image'}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-gray-900 mb-1 truncate">
                                  {image.altText || image.caption || 'Untitled'}
                                </h4>
                                {image.caption && (
                                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                                    {image.caption}
                                  </p>
                                )}
                                <div className="flex items-center space-x-4 text-xs text-gray-500">
                                  <span className="flex items-center">
                                    <Calendar className="h-3 w-3 mr-1" />
                                    {formatDate(image.createdAt)}
                                  </span>
                                  {gallery.coverImageId === image.id && (
                                    <span className="flex items-center text-yellow-600">
                                      <Star className="h-3 w-3 mr-1" />
                                      Cover Image
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      ) : (
                        <div className="text-center py-12">
                          <div className="text-gray-400 mb-4">
                            <ImageIcon className="h-12 w-12 mx-auto" />
                          </div>
                          <h3 className="text-lg font-medium text-gray-900 mb-2">No images to reorder</h3>
                          <p className="text-gray-600">Add some images to the gallery first.</p>
                        </div>
                      )
                    ) : (
                      <div className="space-y-4">
                        {orderedImages.map((image: any, index: number) => (
                          <motion.div
                            key={image.id || `image-${index}`}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${
                              bulkEditMode && selectedImages.some(img => img.id === image.id) 
                                ? 'ring-2 ring-green-500 bg-green-50' 
                                : ''
                            }`}
                          >
                            <div className="flex items-center space-x-4">
                              {/* Bulk Edit Selection Checkbox */}
                              {bulkEditMode && (
                                <button
                                  onClick={() => toggleImage(image)}
                                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors duration-200 flex-shrink-0 ${
                                    selectedImages.some(img => img.id === image.id)
                                      ? 'bg-green-500 border-green-500 text-white'
                                      : 'bg-white border-gray-300 hover:border-green-400'
                                  }`}
                                >
                                  {selectedImages.some(img => img.id === image.id) && (
                                    <Check className="h-4 w-4" />
                                  )}
                                </button>
                              )}
                              
                              <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                                <LazyImage
                                  src={getImageUrlFromImage(image, true)}
                                  alt={image.altText || 'Gallery image'}
                                  className="w-full h-full object-cover cursor-pointer"
                                  onClick={() => {
                                    if (bulkEditMode) {
                                      toggleImage(image)
                                    } else {
                                      setSelectedImage(image)
                                    }
                                  }}
                                />
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-gray-900 mb-1 truncate">
                                  {image.altText || image.caption || 'Untitled'}
                                </h4>
                                {image.caption && (
                                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                                    {image.caption}
                                  </p>
                                )}
                                <div className="flex items-center space-x-4 text-xs text-gray-500">
                                  <span className="flex items-center">
                                    <Calendar className="h-3 w-3 mr-1" />
                                    {formatDate(image.createdAt)}
                                  </span>
                                  {gallery.coverImageId === image.id && (
                                    <span className="flex items-center text-yellow-600">
                                      <Star className="h-3 w-3 mr-1" />
                                      Cover Image
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                {!bulkEditMode && (
                                  <>
                                    <button
                                      onClick={() => setSelectedImage(image)}
                                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </button>
                                    <a
                                      href={getImageUrlFromImage(image, false)}
                                      download
                                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                                    >
                                      <Download className="h-4 w-4" />
                                    </a>
                                    {isOwner && (
                                      <>
                                        <button
                                          onClick={() => handleSetCover(image.id)}
                                          className={`p-2 rounded-lg transition-colors duration-200 ${
                                            gallery.coverImageId === image.id
                                              ? 'text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50'
                                              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                                          }`}
                                        >
                                          {gallery.coverImageId === image.id ? (
                                            <StarOff className="h-4 w-4" />
                                          ) : (
                                            <Star className="h-4 w-4" />
                                          )}
                                        </button>
                                        <button
                                          onClick={() => handleRemoveImage(image.id)}
                                          disabled={removeImagesMutation.isPending}
                                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                      </>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )
                  )}

                  {/* Empty State */}
                  {orderedImages.length === 0 && (
                    <div className="text-center py-12">
                      <div className="text-gray-400 mb-4">
                        <ImageIcon className="h-12 w-12 mx-auto" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No images in this gallery</h3>
                      <p className="text-gray-600 mb-4">This gallery is empty. Add some images to get started!</p>
                      {isOwner && (
                        <button
                          onClick={() => setShowImageSelector(true)}
                          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors duration-200 mx-auto"
                        >
                          <Plus className="h-4 w-4" />
                          <span>Add Images</span>
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Image Detail Modal */}
      { selectedImage && (
        <FullScreenWrapper>
      <ImageDetailModal
        image={selectedImage ? mapImageData(selectedImage) : null}
        onClose={() => setSelectedImage(null)}
        onImageUpdate={() => {
          // The optimistic update will handle this automatically
        }}
        updateImage={() => {
          // This would need to be implemented if we want to update images from the gallery view
        }}
        allImages={orderedImages.map(image => mapImageData(image))}
        onNavigate={(image: any) => {
          // Debug: Log the raw image data
          console.log('Raw gallery image data:', image)
          
          // Map the backend image data to the format expected by ImageDetailModal
          const mappedImage = mapImageData(image)
          console.log('Mapped image:', mappedImage)
          setSelectedImage(mappedImage)
        }}
      />
      </FullScreenWrapper>
      )}

      {/* Image Selector Modal */}

      <ImageSelectorModal
        isOpen={showImageSelector}
        onClose={() => setShowImageSelector(false)}
        onImagesSelected={async (selectedImages) => {
          if (!gallery) return
          
          try {
            const selectedImageIds = selectedImages.map(img => img.id)
            // Add images to gallery
            const token = localStorage.getItem('token')
            if (!token) throw new Error('No token found')
            
            const response = await fetch(`${API_BASE_URL}/galleries/${gallery.id}/images`, {
              method: 'POST',
              headers: getAuthHeaders(token),
              body: JSON.stringify({ imageIds: selectedImageIds })
            })
            
            if (!response.ok) {
              throw new Error('Failed to add images to gallery')
            }
            
            // Refresh gallery data to show newly added images
            if (refetchGallery) {
              await refetchGallery()
            }
            
            setShowImageSelector(false)
          } catch (error) {
            console.error('Failed to add images to gallery:', error)
            alert('Failed to add images to gallery. Please try again.')
          }
        }}
        userId={authData?.data?.user?.id || "me"}
        existingGalleryImages={orderedImages}
      />
    </AnimatePresence>
  )
} 