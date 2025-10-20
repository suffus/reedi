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
  useRemoveMediaFromGallery, 
  useDeleteGallery, 
  useUpdateGallery,
  useReorderGalleryMedia,
  useSetGalleryCover,
  useUserMedia,
  useAuth,
  useBulkUpdateMedia
} from '../../lib/api-hooks'
import { MediaSelectorModal } from './media-selector-modal'
import { useMediaDetail } from '../common/media-detail-context'
import { getMediaUrlFromMedia, API_BASE_URL, getAuthHeaders, fetchFreshMediaData } from '../../lib/api'
import { LazyMedia } from '../lazy-media'
import { FullScreenWrapper } from '../full-screen-wrapper'
import { TagInput } from '../tag-input'
import { Media } from '@/lib/types'
import { mapMediaData } from '@/lib/media-utils'
import { useToast } from '../common/toast'
import { downloadMedia } from '@/lib/download-utils'
import { MediaGrid } from '../media-grid'
//import { ModalEventCatcher } from '../common/modal-event-catcher'

interface GalleryDetailModalProps {
  isOpen: boolean
  onClose: () => void
  galleryId: string
  onGalleryDeleted?: () => void
}

export function GalleryDetailModal({ isOpen, onClose, galleryId, onGalleryDeleted }: GalleryDetailModalProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', description: '', visibility: 'PUBLIC' as const })
  const [showMediaSelector, setShowMediaSelector] = useState(false)
  const [reorderMode, setReorderMode] = useState(false)
  const [orderedMedia, setOrderedMedia] = useState<any[]>([])
  const [isReordering, setIsReordering] = useState(false)
  const [draggedMedia, setDraggedMedia] = useState<any>(null)
  const [dragOverMedia, setDragOverMedia] = useState<any>(null)
  
  // Bulk editing state
  const [bulkEditMode, setBulkEditMode] = useState(false)
  const [bulkEditForm, setBulkEditForm] = useState({
    title: '',
    description: '',
    tags: [] as string[]
  })
  const [bulkEditTagMode, setBulkEditTagMode] = useState<'merge' | 'replace'>('merge')
  const [showBulkEditForm, setShowBulkEditForm] = useState(false)

  // Media selection state for bulk editing
  const [selectedMediaItems, setSelectedMediaItems] = useState<any[]>([])
  const [lastClickedMediaIndex, setLastClickedMediaIndex] = useState<number | null>(null)

  const { data: galleryData, isLoading, error, refetch: refetchGallery } = useGallery(galleryId)
  const { data: userMediaData } = useUserMedia('me')
  const { data: authData } = useAuth()
  const { openMediaDetail } = useMediaDetail()
  const removeMediaMutation = useRemoveMediaFromGallery()
  const deleteGalleryMutation = useDeleteGallery()
  const updateGalleryMutation = useUpdateGallery()
  const reorderMediaMutation = useReorderGalleryMedia()
  const setCoverMutation = useSetGalleryCover()
  const bulkUpdateMediaMutation = useBulkUpdateMedia()
  const { showToast } = useToast()

  const gallery = galleryData?.data?.gallery
  const media = gallery?.media || []
  const userMedia = userMediaData?.data?.media || []
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

  // Initialize ordered media when gallery data loads
  useEffect(() => {
    if (gallery && media.length > 0) {
      console.log('Raw gallery media:', media)
      const validMedia = media.filter((mediaItem: any) => mediaItem && mediaItem.id && typeof mediaItem.id === 'string' && mediaItem.id.length > 0)
      console.log('Valid media:', validMedia)
      
      // Map the media to ensure proper structure
      const mappedMedia = validMedia.map((mediaItem: any) => {
        const mapped = mapMediaData(mediaItem)
        console.log('Mapped media item:', mapped)
        return mapped
      })
      
      setOrderedMedia([...mappedMedia].sort((a: any, b: any) => (a.order || 0) - (b.order || 0)))
    } else if (gallery && media.length === 0) {
      setOrderedMedia([])
    }
  }, [gallery, media])

  const handleRemoveMedia = async (mediaId: string) => {
    if (!gallery) return
    
    try {
      await removeMediaMutation.mutateAsync({
        galleryId: gallery.id,
        mediaIds: [mediaId]
      })
    } catch (error) {
      console.error('Failed to remove media from gallery:', error)
      alert('Failed to remove media from gallery. Please try again.')
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

  const handleDragStart = useCallback((e: React.DragEvent, mediaItem: any) => {
    if (!mediaItem || !mediaItem.id) return
    setDraggedMedia(mediaItem)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', mediaItem.id)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, mediaItem: any) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (mediaItem && mediaItem.id !== draggedMedia?.id) {
      setDragOverMedia(mediaItem)
    }
  }, [draggedMedia])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOverMedia(null)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent, targetMedia: any) => {
    e.preventDefault()
    
    if (!gallery || !draggedMedia || !targetMedia || draggedMedia.id === targetMedia.id || isReordering) {
      setDraggedMedia(null)
      setDragOverMedia(null)
      return
    }

    const draggedIndex = orderedMedia.findIndex(img => img.id === draggedMedia.id)
    const targetIndex = orderedMedia.findIndex(img => img.id === targetMedia.id)
    
    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedMedia(null)
      setDragOverMedia(null)
      return
    }

    // Create new order by moving dragged item to target position
    const newOrder = [...orderedMedia]
    const [draggedItem] = newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, draggedItem)

          console.log('Reordering media:', { draggedIndex, targetIndex, newOrder })
    
    // Set reordering flag to prevent multiple calls
    setIsReordering(true)
    
    // Update local state immediately for optimistic UI
    setOrderedMedia(newOrder)
    
    try {
      const mediaIds = newOrder.map(img => img.id)
      await reorderMediaMutation.mutateAsync({
        galleryId: gallery.id,
        mediaIds
      })
    } catch (error) {
      console.error('Failed to reorder media:', error)
      alert('Failed to reorder media. Please try again.')
      // Revert to original order
      const validMedia = media.filter((med: any) => med && med.id && typeof med.id === 'string' && med.id.length > 0)
      setOrderedMedia([...validMedia].sort((a: any, b: any) => (a.order || 0) - (b.order || 0)))
    } finally {
      setIsReordering(false)
    }
    
    setDraggedMedia(null)
    setDragOverMedia(null)
  }, [gallery, draggedMedia, orderedMedia, isReordering, reorderMediaMutation, media])

  const handleDragEnd = useCallback(() => {
    setDraggedMedia(null)
    setDragOverMedia(null)
  }, [])

  const handleSetCover = async (mediaId: string) => {
    if (!gallery) return
    
    console.log('Setting cover for gallery:', gallery.id, 'mediaId:', mediaId)
    console.log('Current coverMediaId:', gallery.coverMediaId)
    
    try {
      const newMediaId = gallery.coverMediaId === mediaId ? undefined : mediaId
      console.log('New mediaId to set:', newMediaId)
      
      await setCoverMutation.mutateAsync({
        galleryId: gallery.id,
        mediaId: newMediaId
      })
      
      console.log('Cover set successfully')
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
      setBulkEditTagMode('merge') // Reset tag mode when exiting bulk edit
    }
  }

  const clearSelection = () => {
    setSelectedMediaItems([])
    setLastClickedMediaIndex(null)
    setBulkEditTagMode('merge')
  }

  const selectMedia = (mediaItems: any[]) => {
    setSelectedMediaItems(mediaItems)
  }

  const handleSelectAllMedia = () => {
    selectMedia(orderedMedia)
  }

  const handleDeselectAllMedia = () => {
    clearSelection()
  }

  const toggleMedia = (mediaItem: any, event?: React.MouseEvent, index?: number) => {
    setSelectedMediaItems(prev => {
      const isSelected = prev.some(m => m.id === mediaItem.id)
      
      // Handle shift-click range selection
      if (event?.shiftKey && lastClickedMediaIndex !== null && index !== undefined) {
        const startIndex = Math.min(lastClickedMediaIndex, index)
        const endIndex = Math.max(lastClickedMediaIndex, index)
        const rangeMedia = orderedMedia.slice(startIndex, endIndex + 1)
        
        // Add all items in the range to selection
        const newSelection = [...prev]
        rangeMedia.forEach((item: any) => {
          if (!newSelection.some(m => m.id === item.id)) {
            newSelection.push(item)
          }
        })
        
        setLastClickedMediaIndex(index)
        return newSelection
      } else {
        // Normal click: toggle selection of current item
        if (isSelected) {
          return prev.filter(m => m.id !== mediaItem.id)
        } else {
          const newSelection = [...prev, mediaItem]
          // Update last clicked index if index is provided
          if (index !== undefined) {
            setLastClickedMediaIndex(index)
          }
          return newSelection
        }
      }
    })
  }

  const handleBulkEditSubmit = async () => {
    if (selectedMediaItems.length === 0) {
      alert('Please select at least one media item to edit.')
      return
    }

    const mediaIds = selectedMediaItems.map(mediaItem => mediaItem.id)
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

    // Handle tags - use selected mode (merge or replace)
    if (bulkEditForm.tags.length > 0) {
      updates.tags = bulkEditForm.tags
      updates.mergeTags = bulkEditTagMode === 'merge' // Use selected tag mode
      hasUpdates = true
    }

    if (!hasUpdates) {
      alert('Please provide at least one field to update.')
      return
    }

    try {
      await bulkUpdateMediaMutation.mutateAsync({
        mediaIds,
        ...updates,
        onOptimisticUpdate: (mediaId: string, mediaUpdates: any) => {
          // Update local state optimistically
          setOrderedMedia(prev => 
            prev.map(mediaItem => 
              mediaItem.id === mediaId 
                ? { 
                    ...mediaItem, 
                    ...mediaUpdates,
                    // Handle tag merging for optimistic updates
                    tags: updates.mergeTags && updates.tags 
                      ? Array.from(new Set([...(mediaItem.tags || []), ...updates.tags]))
                      : mediaUpdates.tags || mediaItem.tags
                  }
                : mediaItem
            )
          )
        }
      })

      // Reset form and exit bulk edit mode
      setBulkEditForm({ title: '', description: '', tags: [] })
      setShowBulkEditForm(false)
      setBulkEditMode(false)
      clearSelection()
      
      alert(`Successfully updated ${selectedMediaItems.length} media item${selectedMediaItems.length !== 1 ? 's' : ''}.`)
    } catch (error) {
      console.error('Failed to bulk update media:', error)
      alert('Failed to update media. Please try again.')
    }
  }

  const handleBulkEditCancel = () => {
    setBulkEditForm({ title: '', description: '', tags: [] })
    setShowBulkEditForm(false)
    setBulkEditMode(false)
    clearSelection()
  }

  const handleDownloadMedia = async (media: any) => {
    try {
      const mediaUrl = getMediaUrlFromMedia(media, false)
      const mediaName = media.altText || media.caption || 'media'
      const mediaType = media.mediaType || 'IMAGE'
      
      await downloadMedia(mediaUrl, mediaName, mediaType)
      
      showToast({
        type: 'success',
        message: `${mediaType === 'VIDEO' ? 'Video' : mediaType === 'ZIP' ? 'ZIP file' : 'Image'} downloaded successfully!`
      })
    } catch (error) {
      console.error('Download failed:', error)
      showToast({
        type: 'error',
        message: 'Failed to download media. Please try again.'
      })
    }
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
    <>
      <AnimatePresence mode="wait">
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              key="gallery-modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={onClose}
            />

            {/* Modal */}
            <motion.div
              key={`gallery-modal-${galleryId}`}
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
                          <span>{media.length} media item{media.length !== 1 ? 's' : ''}</span>
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
                    <h3 className="text-lg font-medium text-gray-900">Media</h3>
                    <div className="flex items-center space-x-2">
                      {isOwner && (
                        <>
                          <button
                            onClick={() => setShowMediaSelector(true)}
                            className="flex items-center space-x-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors duration-200"
                          >
                            <Plus className="h-4 w-4" />
                            <span>Add Media</span>
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
                            {selectedMediaItems.length} image{selectedMediaItems.length !== 1 ? 's' : ''} selected
                          </span>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={handleSelectAllMedia}
                              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors duration-200"
                            >
                              Select All
                            </button>
                            <button
                              onClick={handleDeselectAllMedia}
                              className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors duration-200"
                            >
                              Clear Selection
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              const newShowForm = !showBulkEditForm
                              setShowBulkEditForm(newShowForm)
                              // Initialize tag mode when showing the form
                              if (newShowForm) {
                                setBulkEditTagMode('merge')
                              }
                            }}
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
                                              <h4 className="text-sm font-medium text-green-900 mb-3">Bulk Edit {selectedMediaItems.length} Image{selectedMediaItems.length !== 1 ? 's' : ''}</h4>
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
                            placeholder="Common title for all media items"
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
                            placeholder="Common description for all media items"
                            className="w-full px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-green-800 mb-1">
                            <Tag className="h-4 w-4 inline mr-1" />
                            Tags
                          </label>
                          
                          {/* Tag Mode Radio Buttons */}
                          <div className="mb-3">
                            <div className="flex items-center space-x-4">
                              <label className="flex items-center space-x-2 text-sm text-green-700">
                                <input
                                  type="radio"
                                  name="bulkEditTagMode"
                                  value="merge"
                                  checked={bulkEditTagMode === 'merge'}
                                  onChange={(e) => setBulkEditTagMode(e.target.value as 'merge' | 'replace')}
                                  className="text-green-600 focus:ring-green-500"
                                />
                                <span>Merge with existing tags</span>
                              </label>
                              <label className="flex items-center space-x-2 text-sm text-green-700">
                                <input
                                  type="radio"
                                  name="bulkEditTagMode"
                                  value="replace"
                                  checked={bulkEditTagMode === 'replace'}
                                  onChange={(e) => setBulkEditTagMode(e.target.value as 'merge' | 'replace')}
                                  className="text-green-600 focus:ring-green-500"
                                />
                                <span>Replace existing tags</span>
                              </label>
                            </div>
                          </div>
                          
                          <TagInput
                            tags={bulkEditForm.tags}
                            onTagsChange={(tags) => setBulkEditForm(prev => ({ ...prev, tags }))}
                            placeholder="Enter tags..."
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
                          disabled={bulkUpdateMediaMutation.isPending || selectedMediaItems.length === 0}
                          className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {bulkUpdateMediaMutation.isPending ? 'Updating...' : `Update ${selectedMediaItems.length} Image${selectedMediaItems.length !== 1 ? 's' : ''}`}
                        </button>
                      </div>
                    </div>
                  )}

                                    {/* Media Grid/List */}
                  {viewMode === 'grid' ? (
                    reorderMode ? (
                      orderedMedia.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {orderedMedia.map((media: any, index: number) => (
                            <div
                              key={media.id || `media-${index}`}
                              draggable
                              onDragStart={(e: React.DragEvent) => handleDragStart(e, media)}
                              onDragOver={(e: React.DragEvent) => handleDragOver(e, media)}
                              onDragLeave={(e: React.DragEvent) => handleDragLeave(e)}
                              onDrop={(e: React.DragEvent) => handleDrop(e, media)}
                              onDragEnd={(e: React.DragEvent) => handleDragEnd()}
                              className={`relative aspect-square bg-gray-200 rounded-lg overflow-hidden group hover:shadow-md transition-shadow duration-200 cursor-move ${
                                draggedMedia?.id === media.id ? 'opacity-50' : ''
                              } ${
                                dragOverMedia?.id === media.id ? 'ring-2 ring-blue-500' : ''
                              }`}
                            >
                              <LazyMedia
                                src={getMediaUrlFromMedia(media, true)}
                                mediaType={media.mediaType || "IMAGE"}
                                alt={media.altText || 'Gallery media x'}
                                className="w-full h-full object-cover pointer-events-none"
                              />
                              
                              {/* Reorder Overlay */}
                              <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                                <div className="bg-white rounded-full p-2">
                                  <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                                </div>
                              </div>

                              {/* Cover Image Indicator */}
                              {gallery.coverMediaId === media.id && (
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
                                              <h3 className="text-lg font-medium text-gray-900 mb-2">No media items to reorder</h3>
                    <p className="text-gray-600">Add some media items to the gallery first.</p>
                        </div>
                      )
                    ) : (
                      <MediaGrid
                        media={orderedMedia.map((media: any) => mapMediaData(media))}
                        viewMode={viewMode}
                        selectedMedia={selectedMediaItems}
                        onMediaClick={(media) => {
                          // Open the unified media viewer
                          const mappedAllMedia = orderedMedia.map(m => mapMediaData(m))
                          openMediaDetail(media, mappedAllMedia)
                        }}
                        onMediaSelect={(media, event) => {
                          if (bulkEditMode) {
                            const originalMedia = orderedMedia.find(m => m.id === media.id)
                            if (originalMedia) {
                              const index = orderedMedia.findIndex(m => m.id === media.id)
                              toggleMedia(originalMedia, event, index)
                            }
                          }
                        }}
                        isSelectable={bulkEditMode}
                        showActions={!bulkEditMode}
                        onViewDetails={(media) => {
                          // Open the unified media viewer
                          const mappedAllMedia = orderedMedia.map(m => mapMediaData(m))
                          openMediaDetail(media, mappedAllMedia)
                        }}
                        onDownload={(media) => {
                          const originalMedia = orderedMedia.find(m => m.id === media.id)
                          if (originalMedia) {
                            handleDownloadMedia(originalMedia)
                          }
                        }}
                        onDelete={(media) => {
                          const originalMedia = orderedMedia.find(m => m.id === media.id)
                          if (originalMedia) {
                            handleRemoveMedia(originalMedia.id)
                          }
                        }}
                        onSetCover={(media) => {
                          const originalMedia = orderedMedia.find(m => m.id === media.id)
                          if (originalMedia) {
                            handleSetCover(originalMedia.id)
                          }
                        }}
                        isDeleting={removeMediaMutation.isPending}
                        showMediaInfo={true}
                        showDate={false}
                        showFileSize={false}
                        coverMediaId={gallery?.coverMediaId}
                        showCoverIndicator={true}
                        gridCols="gallery"
                      />
                    )
                                    ) : (
                    reorderMode ? (
                      orderedMedia.length > 0 ? (
                        <div className="space-y-4">
                          {orderedMedia.map((media: any, index: number) => (
                            <div
                              key={media.id || `media-${index}`}
                              draggable
                              onDragStart={(e: React.DragEvent) => handleDragStart(e, media)}
                              onDragOver={(e: React.DragEvent) => handleDragOver(e, media)}
                              onDragLeave={(e: React.DragEvent) => handleDragLeave(e)}
                              onDrop={(e: React.DragEvent) => handleDrop(e, media)}
                              onDragEnd={(e: React.DragEvent) => handleDragEnd()}
                              className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 cursor-move ${
                                draggedMedia?.id === media.id ? 'opacity-50' : ''
                              } ${
                                dragOverMedia?.id === media.id ? 'ring-2 ring-blue-500' : ''
                              }`}
                            >
                            <div className="flex items-center space-x-4">
                              <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                                <LazyMedia
                                  src={getMediaUrlFromMedia(media, true)}
                                  mediaType={media.mediaType || 'IMAGE'}
                                  alt={media.altText || 'Gallery media 2'}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-gray-900 mb-1 truncate">
                                  {media.altText || media.caption || 'Untitled'}
                                </h4>
                                {media.caption && (
                                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                                    {media.caption}
                                  </p>
                                )}
                                <div className="flex items-center space-x-4 text-xs text-gray-500">
                                  <span className="flex items-center">
                                    <Calendar className="h-3 w-3 mr-1" />
                                    {formatDate(media.createdAt)}
                                  </span>
                                  {gallery.coverMediaId === media.id && (
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
                          <h3 className="text-lg font-medium text-gray-900 mb-2">No medias to reorder</h3>
                          <p className="text-gray-600">Add some medias to the gallery first.</p>
                        </div>
                      )
                    ) : (
                      <div className="space-y-4">
                        {orderedMedia.map((media: any, index: number) => (
                          <motion.div
                            key={`gallery-list-media-${media.id || index}`}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${
                              bulkEditMode && selectedMediaItems.some((img: any) => img.id === media.id) 
                                ? 'ring-2 ring-green-500 bg-green-50' 
                                : ''
                            }`}
                          >
                            <div className="flex items-center space-x-4">
                              {/* Bulk Edit Selection Checkbox */}
                              {bulkEditMode && (
                                <button
                                  onClick={(e) => toggleMedia(media, e, index)}
                                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors duration-200 flex-shrink-0 ${
                                    selectedMediaItems.some((img: any) => img.id === media.id)
                                      ? 'bg-green-500 border-green-500 text-white'
                                      : 'bg-white border-gray-300 hover:border-green-400'
                                  }`}
                                >
                                  {selectedMediaItems.some((img: any) => img.id === media.id) && (
                                    <Check className="h-4 w-4" />
                                  )}
                                </button>
                              )}
                              
                              <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                                <LazyMedia
                                  mediaType={media.mediaType || 'IMAGE'}
                                  src={getMediaUrlFromMedia(media, true)}
                                  alt={media.altText || 'Gallery media 3'}
                                  className="w-full h-full object-cover cursor-pointer"
                                  onClick={(e) => {
                                    if (bulkEditMode) {
                                      toggleMedia(media, e, index)
                                    } else {
                                      // Open the unified media viewer
                                      const mappedMedia = mapMediaData(media)
                                      const mappedAllMedia = orderedMedia.map(m => mapMediaData(m))
                                      openMediaDetail(mappedMedia, mappedAllMedia)
                                    }
                                  }}
                                />
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-gray-900 mb-1 truncate">
                                  {media.altText || media.caption || 'Untitled'}
                                </h4>
                                {media.caption && (
                                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                                    {media.caption}
                                  </p>
                                )}
                                <div className="flex items-center space-x-4 text-xs text-gray-500">
                                  <span className="flex items-center">
                                    <Calendar className="h-3 w-3 mr-1" />
                                    {formatDate(media.createdAt)}
                                  </span>
                                  {gallery.coverMediaId === media.id && (
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
                                      onClick={() => {
                                        // Open the unified media viewer
                                        const mappedMedia = mapMediaData(media)
                                        const mappedAllMedia = orderedMedia.map(m => mapMediaData(m))
                                        openMediaDetail(mappedMedia, mappedAllMedia)
                                      }}
                                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDownloadMedia(media)}
                                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                                    >
                                      <Download className="h-4 w-4" />
                                    </button>
                                    {isOwner && (
                                      <>
                                        <button
                                          onClick={() => handleSetCover(media.id)}
                                          className={`p-2 rounded-lg transition-colors duration-200 ${
                                            gallery.coverMediaId === media.id
                                              ? 'text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50'
                                              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                                          }`}
                                        >
                                          {gallery.coverMediaId === media.id ? (
                                            <StarOff className="h-4 w-4" />
                                          ) : (
                                            <Star className="h-4 w-4" />
                                          )}
                                        </button>
                                        <button
                                          onClick={() => handleRemoveMedia(media.id)}
                                          disabled={removeMediaMutation.isPending}
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
                  {orderedMedia.length === 0 && (
                    <div className="text-center py-12">
                      <div className="text-gray-400 mb-4">
                        <ImageIcon className="h-12 w-12 mx-auto" />
                      </div>
                                        <h3 className="text-lg font-medium text-gray-900 mb-2">No media items in this gallery</h3>
                  <p className="text-gray-600 mb-4">This gallery is empty. Add some media items to get started!</p>
                      {isOwner && (
                        <button
                          onClick={() => setShowMediaSelector(true)}
                          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors duration-200 mx-auto"
                        >
                          <Plus className="h-4 w-4" />
                          <span>Add Media</span>
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
    </AnimatePresence>

    {/* Image Selector Modal */}
    <MediaSelectorModal
      isOpen={showMediaSelector}
      onClose={() => setShowMediaSelector(false)}
      onMediaSelected={async (selectedMedia) => {
        if (!gallery) return
        
        try {
          const selectedmediaIds = selectedMedia.map(img => img.id)
          // Add media items to gallery
          const token = localStorage.getItem('token')
          if (!token) throw new Error('No token found')
          
          const response = await fetch(`${API_BASE_URL}/galleries/${gallery.id}/media`, {
            method: 'POST',
            headers: getAuthHeaders(token),
            body: JSON.stringify({ mediaIds: selectedmediaIds })
          })
          
          if (!response.ok) {
            throw new Error('Failed to add media items to gallery')
          }
          
          // Refresh gallery data to show newly added media items
          if (refetchGallery) {
            await refetchGallery()
          }
          
          setShowMediaSelector(false)
        } catch (error) {
                  console.error('Failed to add media items to gallery:', error)
      alert('Failed to add media items to gallery. Please try again.')
        }
      }}
      userId={authData?.data?.user?.id || "me"}
      existingGalleryMedia={orderedMedia}
    />
  </>
  )
} 