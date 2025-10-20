'use client'

import { useState, useEffect } from 'react'
import { Image as ImageIcon, Tag, Users, Lock, Unlock, Globe, UserCheck, Shield, X, GripVertical } from 'lucide-react'
import { useCreatePost } from '../../lib/api-hooks'
import { MediaPicker } from './media-picker'
import { useAuth } from '../../lib/api-hooks'
import { API_BASE_URL, getAuthHeaders } from '../../lib/api'
import { Media } from '../../lib/types'
import { getFirstThumbnail } from '../../lib/media-utils'

interface FeedTarget {
  id: string
  name: string
  type: 'PERSONAL' | 'GROUP'
  isDefault?: boolean
}

interface PostAuthorFormProps {
  onPostCreated?: () => void
  defaultFeedTarget?: FeedTarget
  allowLockedPosts?: boolean
  availableGroupFeeds?: FeedTarget[]
  showPersonalFeedOption?: boolean
}

export function PostAuthorForm({ 
  onPostCreated, 
  defaultFeedTarget,
  allowLockedPosts = true,
  availableGroupFeeds = [],
  showPersonalFeedOption = false
}: PostAuthorFormProps) {
  const { data: authData } = useAuth()
  const [newPost, setNewPost] = useState('')
  const [showMediaPicker, setShowMediaPicker] = useState(false)
  const [selectedMedia, setSelectedMedia] = useState<Media[]>([])
  const [postVisibility, setPostVisibility] = useState<'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE'>('PUBLIC')
  const [selectedFeeds, setSelectedFeeds] = useState<FeedTarget[]>([])
  const [includePersonalFeed, setIncludePersonalFeed] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [unlockPrice, setUnlockPrice] = useState<number>(0)

  const createPostMutation = useCreatePost()

  // Initialize selected feeds with default target
  useEffect(() => {
    if (defaultFeedTarget) {
      setSelectedFeeds([defaultFeedTarget])
    }
  }, [defaultFeedTarget])

  // Get available feeds excluding the default
  const availableFeeds = availableGroupFeeds.filter(feed => 
    !defaultFeedTarget || feed.id !== defaultFeedTarget.id
  )

  // Handle media selection
  const handleMediaSelect = (media: Media[]) => {
    console.log("Selected media:", media)
    // Ensure all media items have valid IDs
    const validatedMedia = media.map(item => {
      if (!item.id) {
        console.warn("Media item missing ID:", item)
        // Generate a fallback ID if needed
        return { ...item, id: `fallback-${Math.random().toString(36).substr(2, 9)}` }
      }
      return item
    })
    setSelectedMedia(validatedMedia)
    setShowMediaPicker(false)
  }

  // Remove media item
  const removeMedia = (index: number) => {
    setSelectedMedia(prev => prev.filter((_, i) => i !== index))
  }
  
  // Drag state for HTML5 drag-and-drop
  const [draggedItem, setDraggedItem] = useState<any | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)
  
  // Handle drag start
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItem(selectedMedia[index])
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    // Set a transparent drag image
    const dragImage = document.createElement('div')
    dragImage.style.width = '1px'
    dragImage.style.height = '1px'
    document.body.appendChild(dragImage)
    e.dataTransfer.setDragImage(dragImage, 0, 0)
    setTimeout(() => {
      document.body.removeChild(dragImage)
    }, 0)
    
    // Add some data to the drag event
    e.dataTransfer.setData('text/plain', index.toString())
    
    console.log('Drag started with item at index:', index)
  }
  
  // Handle drag enter
  const handleDragEnter = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex !== index) {
      setDropTargetIndex(index)
    }
  }
  
  // Handle drag over
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedIndex !== index) {
      setDropTargetIndex(index)
    }
    return false
  }
  
  // Handle drag leave
  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear drop target if we're leaving the grid
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return
    }
    setDropTargetIndex(null)
  }
  
  // Handle drop
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    
    if (draggedIndex === null || draggedItem === null) {
      console.log('No dragged item to drop')
      return
    }
    
    console.log(`Moving item from index ${draggedIndex} to index ${dropIndex}`)
    
    // Create a new array without mutating the original
    const newMediaOrder = [...selectedMedia]
    
    // Remove the dragged item
    newMediaOrder.splice(draggedIndex, 1)
    
    // Insert at the drop position
    newMediaOrder.splice(dropIndex, 0, draggedItem)
    
    console.log('New media order:', newMediaOrder)
    
    // Update state
    setSelectedMedia(newMediaOrder)
    setDraggedItem(null)
    setDraggedIndex(null)
    setDropTargetIndex(null)
  }
  
  // Handle drag end
  const handleDragEnd = () => {
    setDraggedItem(null)
    setDraggedIndex(null)
    setDropTargetIndex(null)
  }

  const handleComposerSubmit = async (
    content: string, 
    isLocked?: boolean, 
    unlockPrice?: number, 
    lockedMediaIds?: string[]
  ) => {
    const mediaIds = selectedMedia.map(media => media.id)
    try {
      // If no feeds are selected, default to personal feed
      if (selectedFeeds.length === 0) {
        // Post to personal feed by default
        await createPostMutation.mutateAsync({
          content,
          visibility: postVisibility,
          mediaIds,
          isLocked,
          unlockPrice,
          lockedMediaIds
        })
        
        // Reset form
        setNewPost('')
        setSelectedMedia([])
        setIncludePersonalFeed(false)
        setIsLocked(false)
        setUnlockPrice(0)
        onPostCreated?.()
        
        return
      }
      
      // Create post in each selected feed
      const feedPromises = selectedFeeds.map(async (feed) => {
        if (feed.type === 'GROUP') {
          // For group posts, we need to create the post first, then associate it with the group
          const postData = {
            content,
            visibility: postVisibility,
            mediaIds,
            isLocked,
            unlockPrice,
            lockedMediaIds
          }
          
          // Create the post first
          const postResponse = await createPostMutation.mutateAsync(postData)
          
          if (postResponse.success && postResponse.data?.post?.id) {
            // Now associate the post with the group
            const token = localStorage.getItem('token')
            if (!token) throw new Error('No token found')
            
            await fetch(`${API_BASE_URL}/groups/${feed.id}/posts`, {
              method: 'POST',
              headers: getAuthHeaders(token),
              body: JSON.stringify({
                postId: postResponse.data.post.id,
                isPriority: false
              })
            })
          }
        } else {
          // Post to personal feed
          await createPostMutation.mutateAsync({
            content,
            visibility: postVisibility,
            mediaIds,
            isLocked,
            unlockPrice,
            lockedMediaIds
          })
        }
      })

      // If user wants to also post to personal feed and it's not already selected
      if (includePersonalFeed && !selectedFeeds.some(feed => feed.type === 'PERSONAL')) {
        await createPostMutation.mutateAsync({
          content,
          visibility: postVisibility,
          mediaIds,
          isLocked,
          unlockPrice,
          lockedMediaIds
        })
      }

      await Promise.all(feedPromises)
      
      setNewPost('')
      setSelectedMedia([])
      setSelectedFeeds(defaultFeedTarget ? [defaultFeedTarget] : [])
      setIncludePersonalFeed(false)
      setIsLocked(false)
      setUnlockPrice(0)
      onPostCreated?.()
    } catch (error) {
      console.error('Failed to create post:', error)
    }
  }

  const toggleFeedSelection = (feed: FeedTarget) => {
    setSelectedFeeds(prev => {
      const isSelected = prev.some(f => f.id === feed.id)
      if (isSelected) {
        return prev.filter(f => f.id !== feed.id)
      } else {
        return [...prev, feed]
      }
    })
  }

  const getFeedIcon = (type: 'PERSONAL' | 'GROUP') => {
    switch (type) {
      case 'PERSONAL':
        return <UserCheck className="h-4 w-4" />
      case 'GROUP':
        return <Users className="h-4 w-4" />
      default:
        return <Globe className="h-4 w-4" />
    }
  }

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case 'PUBLIC':
        return <Globe className="h-4 w-4" />
      case 'FRIENDS_ONLY':
        return <UserCheck className="h-4 w-4" />
      case 'PRIVATE':
        return <Shield className="h-4 w-4" />
      default:
        return <Globe className="h-4 w-4" />
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="space-y-4">
        {/* Feed Selection */}
        {availableFeeds.length > 0 && (
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">
              Post to additional feeds:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {availableFeeds.map((feed) => {
                const isSelected = selectedFeeds.some(f => f.id === feed.id)
                return (
                  <button
                    key={feed.id}
                    type="button"
                    onClick={() => toggleFeedSelection(feed)}
                    className={`flex items-center space-x-2 p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-olive-50 border-olive-300 text-olive-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {getFeedIcon(feed.type)}
                    <span className="text-sm font-medium">{feed.name}</span>
                    {isSelected && (
                      <div className="ml-auto w-2 h-2 bg-olive-600 rounded-full"></div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Personal Feed Option */}
        {showPersonalFeedOption && (
          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <input
              type="checkbox"
              id="includePersonalFeed"
              checked={includePersonalFeed}
              onChange={(e) => setIncludePersonalFeed(e.target.checked)}
              className="rounded border-gray-300 text-olive-600 focus:ring-olive-500"
            />
            <label htmlFor="includePersonalFeed" className="flex items-center space-x-2 text-sm text-gray-700">
              <UserCheck className="h-4 w-4" />
              <span>Also post to my personal feed</span>
            </label>
          </div>
        )}

        {/* Simple text input for quick posts */}
        <textarea
          value={newPost}
          onChange={(e) => setNewPost(e.target.value)}
          placeholder="What's on your mind?"
          className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-olive-500 focus:border-transparent"
          rows={3}
        />
        
        {/* Visibility Selector */}
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">Visibility:</label>
          <div className="flex space-x-2">
            {(['PUBLIC', 'FRIENDS_ONLY', 'PRIVATE'] as const).map((visibility) => (
              <button
                key={visibility}
                type="button"
                onClick={() => setPostVisibility(visibility)}
                className={`flex items-center space-x-2 px-3 py-1 text-sm rounded-sm transition-colors ${
                  postVisibility === visibility
                    ? 'bg-olive-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {getVisibilityIcon(visibility)}
                <span>{visibility === 'PUBLIC' ? 'Public' : visibility === 'FRIENDS_ONLY' ? 'Friends Only' : 'Private'}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Locked Post Toggle */}
        {allowLockedPosts && (
          <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <button
              type="button"
              onClick={() => setIsLocked(!isLocked)}
              className={`p-2 rounded-full transition-colors ${
                isLocked 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'text-blue-600 hover:text-blue-700'
              }`}
              title={isLocked ? 'Unlock post' : 'Lock post'}
            >
              {isLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            </button>
            <label className="text-sm text-blue-700">
              {isLocked ? 'Post will be locked' : 'Make this a locked post'}
            </label>
            {isLocked && (
              <input
                type="number"
                min="1"
                value={unlockPrice}
                onChange={(e) => setUnlockPrice(parseInt(e.target.value) || 0)}
                placeholder="Unlock price (tokens)"
                className="ml-auto px-3 py-1 text-sm border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            )}
          </div>
        )}
        
        <div className="flex justify-between items-center">
          <div className="flex space-x-2">
            <button
              type="button"
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              onClick={() => setShowMediaPicker(true)}
              aria-label="Add media"
            >
              <ImageIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200"
            >
              <Tag className="h-5 w-5" />
            </button>
          </div>
          <button
            type="button"
            disabled={(!newPost.trim() && selectedMedia.length === 0) || createPostMutation.isPending}
            onClick={() => handleComposerSubmit(newPost, isLocked, unlockPrice, [])}
            className="px-6 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-sm font-medium tracking-wide transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createPostMutation.isPending ? 'Posting...' : 'Post'}
          </button>
        </div>

        {/* Media Preview */}
        {selectedMedia.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-700">Selected Media ({selectedMedia.length}/8)</h4>
              <button
                type="button"
                onClick={() => setSelectedMedia([])}
                className="text-sm text-red-600 hover:text-red-800 transition-colors"
              >
                Clear All
              </button>
            </div>
            <div 
              className="grid grid-cols-4 gap-2"
              onDragLeave={handleDragLeave}
            >
              {selectedMedia.map((media, index) => (
                <div
                  key={`media-${index}`}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragEnter={(e) => handleDragEnter(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`relative group aspect-square border-2 ${
                    draggedIndex === index 
                      ? 'opacity-50 border-transparent' 
                      : dropTargetIndex === index 
                        ? 'border-blue-500 border-dashed' 
                        : 'border-transparent'
                  }`}
                  style={{
                    cursor: 'grab',
                    minHeight: '80px',
                    touchAction: 'none',
                    transition: 'border-color 0.2s ease, opacity 0.2s ease'
                  }}
                >
                  <img
                    src={getFirstThumbnail(media)}
                    alt={media.altText || `Media ${index + 1}`}
                    className="w-full h-full object-cover rounded-sm pointer-events-none"
                  />
                  <div 
                    className="absolute top-1 left-1 bg-black bg-opacity-50 text-white rounded-sm w-6 h-6 flex items-center justify-center cursor-grab"
                    title="Drag to reorder"
                  >
                    <GripVertical className="h-4 w-4" />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMedia(index)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feed Summary */}
        {selectedFeeds.length > 0 && (
          <div className="text-xs text-gray-500">
            Posting to: {selectedFeeds.map(feed => feed.name).join(', ')}
            {includePersonalFeed && ' + Personal Feed'}
          </div>
        )}
      </div>

      {/* Media Picker Modal */}
      <MediaPicker
        isOpen={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        onMediaSelected={handleMediaSelect}
        userId={authData?.data?.user?.id || ''}
        mode="post"
        title="Select Media"
        confirmText="Add Media"
        maxSelection={8 - selectedMedia.length}
        showUpload={true}
        showGlobalSearch={true}
        showFilters={true}
      />
    </div>
  )
} 