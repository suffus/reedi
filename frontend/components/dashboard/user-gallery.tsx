'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Download, Trash2, Eye, Calendar, X, Loader2, Plus, FolderOpen, Filter, CheckSquare, Square, Edit3, MoreHorizontal, RefreshCw } from 'lucide-react'
import { useUserMedia, useDeleteMedia, useInfiniteMyGalleries, useGallery, useInfiniteFilteredUserMedia } from '../../lib/api-hooks'
import { NewGalleryModal } from './new-gallery-modal'
import { FullScreenWrapper } from '../full-screen-wrapper'
import { useMediaDetail } from '../common/media-detail-context'
import { GalleryDetailModal } from './gallery-detail-modal'
import { BulkEditModal } from './bulk-edit-modal'
import { getMediaUrl, getMediaUrlFromMedia } from '@/lib/api'
import { LazyMedia } from '../lazy-media'
import { MediaGrid } from '../media-grid'
import { Media } from '@/lib/types'
import { mapMediaData, getBestThumbnailUrl } from '@/lib/media-utils'
import { TagInput } from '../tag-input'
import { InfiniteScrollContainer } from '../infinite-scroll-container'
import { useToast } from '../common/toast'
import { downloadMedia } from '@/lib/download-utils'


interface UserGalleryProps {
  userId: string
}

export function UserGallery({ userId }: UserGalleryProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [isNewGalleryModalOpen, setIsNewGalleryModalOpen] = useState(false)
  const [activeView, setActiveView] = useState<'images' | 'galleries'>('images')
  const [selectedGallery, setSelectedGallery] = useState<any>(null)
  const [isGalleryDetailModalOpen, setIsGalleryDetailModalOpen] = useState(false)
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'IMAGE' | 'VIDEO' | 'ALL'>('ALL')
  const [showFilters, setShowFilters] = useState(false)
  const [showOnlyUnorganized, setShowOnlyUnorganized] = useState(false)
  
  // Bulk selection state
  const [isBulkSelectMode, setIsBulkSelectMode] = useState(false)
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(new Set())
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false)
  const [lastSelectedMediaId, setLastSelectedMediaId] = useState<string | null>(null)

  // Build filters object
  const filters = useMemo(() => {
    const filterObj: any = {}
    if (filterTags.length > 0) {
      filterObj.tags = filterTags
    }
    if (mediaTypeFilter !== 'ALL') {
      filterObj.mediaType = mediaTypeFilter
    }
    if (showOnlyUnorganized) {
      filterObj.showOnlyUnorganized = true
    }
    return filterObj
  }, [filterTags, mediaTypeFilter, showOnlyUnorganized])

  const { 
    data, 
    isLoading, 
    isFetching, 
    error, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage,
    refetch
  } = useInfiniteFilteredUserMedia(userId, filters)

  // Custom update function for infinite query
  const updateMedia = useCallback((mediaId: string, updates: Partial<any>) => {
    // For now, we'll refetch the data to ensure we have the latest state
    // In the future, this could be optimized with proper cache updates
    console.log('Media update requested:', mediaId, updates)
    refetch()
  }, [refetch])

  // Custom reset function for infinite query - will be defined after showToast is available
  const reset = useCallback(() => {
    // Refetch the data to get fresh results from the server
    console.log('Reset requested - refetching user media')
    refetch()
  }, [refetch])

  const { 
    data: galleriesData, 
    isLoading: galleriesLoading, 
    loadMore: loadMoreGalleries, 
    isFetching: isLoadingMoreGalleries,
    refresh: refreshGalleries
  } = useInfiniteMyGalleries()
  
  const galleries = galleriesData?.data?.galleries || []
  const hasMoreGalleries = galleriesData?.data?.pagination?.hasNext || false
  const totalGalleries = galleriesData?.data?.pagination?.total || 0

  const { data: selectedGalleryData, isLoading: selectedGalleryLoading } = useGallery(
    selectedGallery?.id || ''
  )

  const deleteMediaMutation = useDeleteMedia()
  const { showToast } = useToast()
  const { openMediaDetail } = useMediaDetail()

  // Enhanced reset function
  const enhancedReset = useCallback(() => {
    // Refetch the data to get fresh results from the server
    console.log('Enhanced reset requested - refetching user media')
    refetch()
  }, [refetch])

  // Listen for gallery refresh events from upload dialog
  useEffect(() => {
    const handleGalleryRefresh = () => {
      console.log('Gallery refresh event received - resetting user media')
      enhancedReset()
    }

    window.addEventListener('gallery-refresh-required', handleGalleryRefresh)
    
    return () => {
      window.removeEventListener('gallery-refresh-required', handleGalleryRefresh)
    }
  }, [enhancedReset])

  // Reset data when filters change
  useEffect(() => {
    enhancedReset()
  }, [filters, enhancedReset])

  const handleGalleryClick = (gallery: any) => {
    setSelectedGallery(gallery)
    setIsGalleryDetailModalOpen(true)
  }

  // Map the raw media to our frontend format and use backend serve endpoints
  const media = (data?.pages?.flatMap(page => page.data?.media || []) || [])
    .map((mediaItem: any) => {
      const mapped = mapMediaData(mediaItem)
      const bestThumbnail = getBestThumbnailUrl(mapped)
      
      return {
        ...mapped,
        // Keep the original S3 keys for the MediaDetailModal
        s3Key: mediaItem.s3Key || mediaItem.url,
        thumbnailS3Key: mediaItem.thumbnailS3Key || mediaItem.thumbnail || mediaItem.url,
        // Use getMediaUrlFromMedia to construct URLs pointing to backend serve endpoints
        url: getMediaUrlFromMedia(mapped, false),
        thumbnail: bestThumbnail || getMediaUrlFromMedia(mapped, true), // Use best thumbnail or fallback
      }
    })
    // Sort by creation date in descending order (most recent first)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Filter media based on selected tags
  const filteredMedia = useMemo(() => {
    if (filterTags.length === 0) {
      return media
    }
    
    return media.filter((mediaItem: any) => {
      // Check if the media has all the selected tags
      return filterTags.every(tag => 
        mediaItem.tags && Array.isArray(mediaItem.tags) && mediaItem.tags.some((mediaTag: string) => 
          mediaTag && typeof mediaTag === 'string' && mediaTag.toLowerCase().includes(tag.toLowerCase())
        )
      )
    })
  }, [media, filterTags])

  const totalMedia = data?.pages?.[0]?.data?.pagination?.total || 0
  const filteredTotalMedia = filteredMedia.length

  const handleDeleteMedia = async (mediaId: string) => {
    if (!confirm('Are you sure you want to delete this media?')) return

    try {
      await deleteMediaMutation.mutateAsync(mediaId)
    } catch (error) {
      console.error('Failed to delete media:', error)
    }
  }

  // Bulk selection handlers
  const handleBulkSelectToggle = () => {
    setIsBulkSelectMode(!isBulkSelectMode)
    if (isBulkSelectMode) {
      setSelectedMediaIds(new Set())
      setLastSelectedMediaId(null)
    }
  }

  const handleSelectAll = () => {
    if (selectedMediaIds.size === filteredMedia.length) {
      setSelectedMediaIds(new Set())
      setLastSelectedMediaId(null)
    } else {
      setSelectedMediaIds(new Set(filteredMedia.map(m => m.id).filter((id): id is string => id !== undefined)))
      // Set the last selected to the first item when selecting all
      if (filteredMedia.length > 0 && filteredMedia[0].id) {
        setLastSelectedMediaId(filteredMedia[0].id)
      }
    }
  }

  const handleMediaSelect = (media: Media, event?: React.MouseEvent) => {
    const newSelectedIds = new Set(selectedMediaIds)
    
    // Check if shift key is pressed and we have a last selected item
    if (event?.shiftKey && lastSelectedMediaId && lastSelectedMediaId !== media.id) {
      // Find the indices of the last selected item and current item
      const lastIndex = filteredMedia.findIndex(m => m.id === lastSelectedMediaId)
      const currentIndex = filteredMedia.findIndex(m => m.id === media.id)
      
      if (lastIndex !== -1 && currentIndex !== -1) {
        // Determine the range (start and end indices)
        const startIndex = Math.min(lastIndex, currentIndex)
        const endIndex = Math.max(lastIndex, currentIndex)
        
        // Select all items in the range
        for (let i = startIndex; i <= endIndex; i++) {
          const mediaItem = filteredMedia[i]
          if (mediaItem && mediaItem.id) {
            newSelectedIds.add(mediaItem.id)
          }
        }
      }
    } else {
      // Normal selection/deselection
      if (newSelectedIds.has(media.id)) {
        newSelectedIds.delete(media.id)
      } else {
        newSelectedIds.add(media.id)
      }
    }
    
    setSelectedMediaIds(newSelectedIds)
    setLastSelectedMediaId(media.id)
  }

  const handleBulkDelete = async () => {
    if (selectedMediaIds.size === 0) return
    
    const count = selectedMediaIds.size
    if (!confirm(`Are you sure you want to delete ${count} ${count === 1 ? 'media item' : 'media items'}?`)) return

    try {
      // Delete all selected media
      const deletePromises = Array.from(selectedMediaIds).map(id => 
        deleteMediaMutation.mutateAsync(id)
      )
      await Promise.all(deletePromises)
      
      // Clear selection
      setSelectedMediaIds(new Set())
      setLastSelectedMediaId(null)
      setIsBulkSelectMode(false)
    } catch (error) {
      console.error('Failed to delete media:', error)
    }
  }

  const handleBulkEdit = () => {
    if (selectedMediaIds.size === 0) return
    setIsBulkEditModalOpen(true)
  }

  const selectedMediaItems = filteredMedia.filter(m => selectedMediaIds.has(m.id))

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
        <div className="text-gray-500 text-sm"><b>Loading...</b></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div>
            <h2 className="text-2xl font-serif font-bold text-gray-900">Your Gallery</h2>
            <p className="text-gray-600 mt-1">
              {activeView === 'images' ? (
                <>
                  {filteredTotalMedia} {(filteredTotalMedia === 1 ? 'media' : 'media')} in your collection
                  {(filterTags.length > 0 || mediaTypeFilter !== 'ALL') && (
                    <span className="text-gray-500">
                      {' '}(filtered from {totalMedia} total)
                    </span>
                  )}
                  {filterTags.length === 0 && mediaTypeFilter === 'ALL' && media.length > 0 && media.length < totalMedia && (
                    <span className="text-gray-500">
                      {' '}(showing {media.length} of {totalMedia})
                    </span>
                  )}
                </>
              ) : (
                <>
                  {totalGalleries} {(totalGalleries === 1 ? 'gallery' : 'galleries')} created
                  {galleries.length > 0 && galleries.length < totalGalleries && (
                    <span className="text-gray-500">
                      {' '}(showing {galleries.length} of {totalGalleries})
                    </span>
                  )}
                </>
              )}
            </p>
          </div>
          
          {/* Refresh Button */}
          <button
            onClick={() => {
              if (activeView === 'images') {
                console.log('Resetting media')
                enhancedReset()
              } else {
                console.log('Refreshing galleries')
                refreshGalleries()
              }
            }}
            disabled={isLoading || isFetching || galleriesLoading}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title={`Refresh ${activeView === 'images' ? 'media' : 'galleries'}`}
          >
            <RefreshCw className={`h-5 w-5 ${(isLoading || isFetching || galleriesLoading) ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Bulk Actions Toolbar */}
          {activeView === 'images' && isBulkSelectMode && (
            <div className="flex items-center space-x-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <span className="text-sm text-blue-700 font-medium">
                {selectedMediaIds.size} selected
              </span>
              <button
                onClick={handleSelectAll}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                {selectedMediaIds.size === filteredMedia.length ? 'Deselect all' : 'Select all'}
              </button>
              <div className="h-4 w-px bg-blue-300"></div>
              <button
                onClick={handleBulkEdit}
                disabled={selectedMediaIds.size === 0}
                className="flex items-center space-x-1 px-2 py-1 text-sm text-blue-700 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Edit3 className="h-3 w-3" />
                <span>Edit</span>
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={selectedMediaIds.size === 0}
                className="flex items-center space-x-1 px-2 py-1 text-sm text-red-700 hover:text-red-800 hover:bg-red-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="h-3 w-3" />
                <span>Delete</span>
              </button>
              <button
                onClick={handleBulkSelectToggle}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Cancel
              </button>
              <div className="h-4 w-px bg-blue-300"></div>
              <span className="text-xs text-blue-600">
                💡 Shift+click to select range
              </span>
            </div>
          )}

          {/* View Toggle */}
          <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveView('images')}
              className={`px-3 py-1 text-sm rounded-md transition-colors duration-200 ${
                activeView === 'images'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Camera className="h-4 w-4 inline mr-1" />
              Media
            </button>
            <button
              onClick={() => setActiveView('galleries')}
              className={`px-3 py-1 text-sm rounded-md transition-colors duration-200 ${
                activeView === 'galleries'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FolderOpen className="h-4 w-4 inline mr-1" />
              Galleries
            </button>
          </div>

          {/* New Gallery Button */}
          {activeView === 'galleries' && (
            <button
              onClick={() => setIsNewGalleryModalOpen(true)}
              className="btn-primary flex items-center space-x-2 px-4 py-2"
            >
              <Plus className="h-4 w-4" />
              <span>New Gallery</span>
            </button>
          )}

          {/* View Mode Toggle (only for media) */}
          {activeView === 'images' && (
            <>
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
              
              {/* Filter Toggle Button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg transition-colors duration-200 ${
                  filterTags.length > 0 || mediaTypeFilter !== 'ALL' || showOnlyUnorganized
                    ? 'bg-blue-100 text-blue-700'
                    : showFilters
                    ? 'bg-gray-100 text-gray-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
                title={
                  filterTags.length > 0 || mediaTypeFilter !== 'ALL' || showOnlyUnorganized
                    ? `${filterTags.length + (mediaTypeFilter !== 'ALL' ? 1 : 0) + (showOnlyUnorganized ? 1 : 0)} filter(s) active`
                    : 'Filter by tags and media type'
                }
              >
                <Filter className="h-4 w-4" />
              </button>

              {/* Bulk Select Toggle Button */}
              <button
                onClick={handleBulkSelectToggle}
                className={`p-2 rounded-lg transition-colors duration-200 ${
                  isBulkSelectMode
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
                title="Bulk select (Shift+click to select range)"
              >
                {isBulkSelectMode ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter Section */}
      <AnimatePresence>
        {activeView === 'images' && showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
          >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700 flex items-center">
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </h3>
            {(filterTags.length > 0 || mediaTypeFilter !== 'ALL' || showOnlyUnorganized) && (
              <button
                onClick={() => {
                  setFilterTags([])
                  setMediaTypeFilter('ALL')
                  setShowOnlyUnorganized(false)
                }}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Clear all filters
              </button>
            )}
          </div>
          <TagInput
            tags={filterTags}
            onTagsChange={setFilterTags}
            placeholder="Enter tags to filter by (comma-separated)..."
            className="w-full"
          />
          {(filterTags.length > 0 || mediaTypeFilter !== 'ALL' || showOnlyUnorganized) && (
            <p className="text-xs text-gray-500 mt-2">
              {filterTags.length > 0 && mediaTypeFilter !== 'ALL' && showOnlyUnorganized && (
                <>Showing {mediaTypeFilter === 'IMAGE' ? 'images' : 'videos'} that contain all selected tags and are not in folders</>
              )}
              {filterTags.length > 0 && mediaTypeFilter !== 'ALL' && !showOnlyUnorganized && (
                <>Showing {mediaTypeFilter === 'IMAGE' ? 'images' : 'videos'} that contain all selected tags</>
              )}
              {filterTags.length > 0 && mediaTypeFilter === 'ALL' && showOnlyUnorganized && (
                <>Showing media that contain all selected tags and are not in folders</>
              )}
              {filterTags.length > 0 && mediaTypeFilter === 'ALL' && !showOnlyUnorganized && (
                <>Showing media that contain all selected tags</>
              )}
              {filterTags.length === 0 && mediaTypeFilter !== 'ALL' && showOnlyUnorganized && (
                <>Showing only {mediaTypeFilter === 'IMAGE' ? 'images' : 'videos'} that are not in folders</>
              )}
              {filterTags.length === 0 && mediaTypeFilter !== 'ALL' && !showOnlyUnorganized && (
                <>Showing only {mediaTypeFilter === 'IMAGE' ? 'images' : 'videos'}</>
              )}
              {filterTags.length === 0 && mediaTypeFilter === 'ALL' && showOnlyUnorganized && (
                <>Showing only media that are not in folders</>
              )}
            </p>
          )}
          
          {/* Media Type Filter */}
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Media Type</h4>
            <div className="flex space-x-3">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="mediaType"
                  value="ALL"
                  checked={mediaTypeFilter === 'ALL'}
                  onChange={(e) => setMediaTypeFilter(e.target.value as 'IMAGE' | 'VIDEO' | 'ALL')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">All</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="mediaType"
                  value="IMAGE"
                  checked={mediaTypeFilter === 'IMAGE'}
                  onChange={(e) => setMediaTypeFilter(e.target.value as 'IMAGE' | 'VIDEO' | 'ALL')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Images</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="mediaType"
                  value="VIDEO"
                  checked={mediaTypeFilter === 'VIDEO'}
                  onChange={(e) => setMediaTypeFilter(e.target.value as 'IMAGE' | 'VIDEO' | 'ALL')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Videos</span>
              </label>
            </div>
          </div>

          {/* Only Show Unorganized Filter */}
          <div className="mt-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyUnorganized}
                onChange={(e) => setShowOnlyUnorganized(e.target.checked)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Only show media not already in folders</span>
            </label>
          </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      {activeView === 'images' ? (
        <>
          {/* Media Grid with Infinite Scroll */}
          <InfiniteScrollContainer
            hasMore={hasNextPage}
            isLoading={isFetchingNextPage}
            onLoadMore={fetchNextPage}
          >
            <MediaGrid
              media={filteredMedia}
              viewMode={viewMode}
              selectedMedia={selectedMediaItems}
              onMediaClick={(media) => {
                // Open the unified media viewer
                openMediaDetail(media, filteredMedia)
              }}
              onMediaSelect={handleMediaSelect}
              isSelectable={isBulkSelectMode}
              showActions={!isBulkSelectMode}
              onViewDetails={(media) => {
                // Open the unified media viewer
                openMediaDetail(media, filteredMedia)
              }}
              onDownload={async (media) => {
                try {
                  const mediaUrl = getMediaUrlFromMedia(media, false)
                  const mediaName = media.altText || media.caption || 'media'
                  const mediaType = media.mediaType || 'IMAGE'
                  
                  await downloadMedia(mediaUrl, mediaName, mediaType)
                  
                  showToast({
                    type: 'success',
                    message: `${mediaType === 'VIDEO' ? 'Video' : 'Image'} downloaded successfully!`
                  })
                } catch (error) {
                  console.error('Download failed:', error)
                  showToast({
                    type: 'error',
                    message: 'Failed to download media. Please try again.'
                  })
                }
              }}
              onDelete={(media) => handleDeleteMedia(media.id)}
              isDeleting={deleteMediaMutation.isPending}
              showMediaInfo={true}
              showDate={true}
              showFileSize={true}
              formatFileSize={formatFileSize}
              formatDate={formatDate}
            />
          </InfiniteScrollContainer>



          {/* Empty State */}
          {media.length === 0 && !isLoading && !isFetching && (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <Camera className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No media yet</h3>
              <p className="text-gray-600">Start building your gallery by uploading some media!</p>
            </div>
          )}

          {/* Refetching State */}
          {isFetching && !isLoading && media.length > 0 && (
            <div className="text-center py-8">
              <div className="flex items-center justify-center space-x-2 text-gray-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Updating gallery...</span>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Galleries View with Infinite Scroll */}
          <InfiniteScrollContainer
            hasMore={hasMoreGalleries}
            isLoading={isLoadingMoreGalleries}
            onLoadMore={loadMoreGalleries}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {galleries.map((gallery: any) => (
                <motion.div
                  key={gallery.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden group hover:shadow-md transition-shadow duration-200 cursor-pointer"
                  onClick={() => {
                    setSelectedGallery(gallery)
                    setIsGalleryDetailModalOpen(true)
                  }}
                >
                  <div className="relative aspect-video overflow-hidden">
                    {gallery.coverMedia ? (
                      <LazyMedia
                        src={getMediaUrlFromMedia(gallery.coverMedia, true)}
                        alt={gallery.coverMedia.altText || 'Gallery cover'}
                        className="w-full h-full object-cover"
                        mediaType={gallery.coverMedia.mediaType || 'IMAGE'}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                        <FolderOpen className="h-12 w-12 text-gray-400" />
                      </div>
                    )}
                    
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button 
                          className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-colors duration-200"
                          onClick={e => {
                            e.stopPropagation()
                            setSelectedGallery(gallery)
                            setIsGalleryDetailModalOpen(true)
                          }}
                        >
                          <Eye className="h-4 w-4 text-gray-700" />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <h3 className="font-medium text-gray-900 mb-1 truncate">
                      {gallery.name}
                    </h3>
                    {gallery.description && (
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                        {gallery.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        {formatDate(gallery.createdAt)}
                      </span>
                      
                      <span>
                        {[
                          gallery._count.images > 0 && `${gallery._count.images} image${gallery._count.images !== 1 ? 's' : ''}`,
                          gallery._count.videos > 0 && `${gallery._count.videos} video${gallery._count.videos !== 1 ? 's' : ''}`
                        ].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </InfiniteScrollContainer>

          {/* Empty State for Galleries */}
          {galleries.length === 0 && !galleriesLoading && (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <FolderOpen className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No galleries yet</h3>
              <p className="text-gray-600 mb-4">Create your first gallery to organize your images!</p>
              <button
                onClick={() => setIsNewGalleryModalOpen(true)}
                className="btn-primary flex items-center space-x-2 mx-auto"
              >
                <Plus className="h-4 w-4" />
                <span>Create Gallery</span>
              </button>
            </div>
          )}

          {/* Loading State for Galleries */}
          {galleriesLoading && (
            <div className="text-center py-12">
              <div className="flex items-center justify-center space-x-2 text-gray-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading galleries...</span>
              </div>
            </div>
          )}
        </>
      )}


      {/* New Gallery Modal */}
      <NewGalleryModal
        isOpen={isNewGalleryModalOpen}
        onClose={() => setIsNewGalleryModalOpen(false)}
        userId={userId}
        onGalleryCreated={() => {
          // Refresh the galleries list to show the newly created gallery
          refreshGalleries()
        }}
      />

      {/* Gallery Detail Modal */}
      <GalleryDetailModal
        isOpen={isGalleryDetailModalOpen}
        onClose={() => {
          setIsGalleryDetailModalOpen(false)
          setSelectedGallery(null)
        }}
        galleryId={selectedGallery?.id || ''}
        onGalleryDeleted={() => {
          // The query will automatically refetch
        }}
      />

      {/* Bulk Edit Modal */}
      <BulkEditModal
        isOpen={isBulkEditModalOpen}
        onClose={() => setIsBulkEditModalOpen(false)}
        selectedMedia={selectedMediaItems}
        onSuccess={() => {
          // Clear selection after successful update
          setSelectedMediaIds(new Set())
          setLastSelectedMediaId(null)
          setIsBulkSelectMode(false)
          
          // Reset the media data to force a fresh fetch
          // This will ensure the media detail modal shows updated data
          enhancedReset()
        }}
      />
    </div>
  )
}