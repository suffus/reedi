

import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react'
import { Calendar, User, FileText, Video, Loader2, Edit2, X as XIcon, Clock, RefreshCw, MessageCircle, Send } from 'lucide-react'
import { TagInput } from '../tag-input'
import { Media, Comment } from '@/lib/types'
import { useUpdateMedia, useReprocessMedia, useMediaComments, useCreateComment, useAuth } from '@/lib/api-hooks'
import { fetchFreshMediaData } from '@/lib/api'
import { mapMediaData } from '@/lib/media-utils'
import { useMediaDetail } from './media-detail-context'

interface MediaMetadataPanelProps {
  media: Media
  isOwner: boolean
  onMediaUpdate?: () => void
  updateMedia?: (mediaId: string, updates: Partial<Media>) => void
  // Slideshow props (optional - only for modals that support slideshow)
  slideshow?: {
    isSlideshowActive: boolean
    currentSlideshowSpeed: number
    updateSlideshowSpeed: (speed: number) => void
  }
  canNavigate?: boolean
  allMedia?: Media[]
  // Media type specific props
  mediaType: 'IMAGE' | 'VIDEO'
  processingStatus?: string
  duration?: number
  // Unsaved changes callback
  onUnsavedChangesChange?: (hasUnsavedChanges: boolean) => void
}

export interface MediaMetadataPanelRef {
  discardUnsavedChanges: () => void
  saveChanges: () => Promise<void>
  hasUnsavedChanges: boolean
}

export const MediaMetadataPanel = forwardRef<MediaMetadataPanelRef, MediaMetadataPanelProps>(({ 
  media, 
  isOwner, 
  onMediaUpdate, 
  updateMedia,
  slideshow,
  canNavigate,
  allMedia,
  mediaType,
  processingStatus,
  duration,
  onUnsavedChangesChange
}, ref) => {
  // Metadata state - starts with prop but gets updated with fresh data
  const [metadataMedia, setMetadataMedia] = useState<Media>(media)
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false)
  
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editTags, setEditTags] = useState<string[]>([])
  const [localTitle, setLocalTitle] = useState(metadataMedia?.altText || '')
  const [localDescription, setLocalDescription] = useState(metadataMedia?.caption || '')
  const [localTags, setLocalTags] = useState<string[]>(metadataMedia?.tags || [])
  
  // Comments state
  const [commentText, setCommentText] = useState('')
  const [showComments, setShowComments] = useState(false)
  
  const updateMediaMutation = useUpdateMedia()
  const reprocessMediaMutation = useReprocessMedia()
  
  // Comments hooks
  const { data: commentsData, isLoading: commentsLoading } = useMediaComments(media?.id || '')
  const createCommentMutation = useCreateComment()
  const { data: authData } = useAuth()
  
  // Fetch fresh metadata when component mounts or media ID changes
  useEffect(() => {
    if (media?.id) {
      setIsLoadingMetadata(true)
      console.log('Fetching fresh metadata for media:', media.id)
      fetchFreshMediaData(media.id)
        .then(freshData => {
          const mappedData = mapMediaData(freshData)
          setMetadataMedia(mappedData)
        })
        .catch(error => {
          console.error('Failed to fetch fresh metadata:', error)
          // Keep using the original media data if fetch fails
        })
        .finally(() => {
          setIsLoadingMetadata(false)
        })
    }
  }, [media?.id])
  
  // Update local state when metadataMedia changes
  useEffect(() => {
    setLocalTitle(metadataMedia?.altText || '')
    setLocalDescription(metadataMedia?.caption || '')
    setLocalTags(metadataMedia?.tags || [])
  }, [metadataMedia?.altText, metadataMedia?.caption, metadataMedia?.tags])
  
  // Safely get the updateMediaInContext function if available
  let updateMediaInContext: ((mediaId: string, updates: Partial<Media>) => void) | null = null
  try {
    const mediaDetailContext = useMediaDetail()
    updateMediaInContext = mediaDetailContext.updateMediaInContext
  } catch {
    // Component is not within MediaDetailProvider, which is fine
    updateMediaInContext = null
  }

  // Check if there are unsaved changes
  const hasUnsavedChanges = isEditing && (
    editTitle !== localTitle ||
    editDescription !== localDescription ||
    JSON.stringify(editTags) !== JSON.stringify(localTags)
  )

  // Notify parent component of unsaved changes state
  useEffect(() => {
    if (onUnsavedChangesChange) {
      onUnsavedChangesChange(hasUnsavedChanges)
    }
  }, [hasUnsavedChanges, onUnsavedChangesChange])


  const handleEditTitleChange = (value: string) => {
    setEditTitle(value)
  }

  const handleEditDescriptionChange = (value: string) => {
    setEditDescription(value)
  }

  const handleEditTagsChange = (tags: string[]) => {
    setEditTags(tags)
  }

  const handleStartEdit = () => {
    setEditTitle(localTitle)
    setEditDescription(localDescription)
    setEditTags([...localTags])
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditTitle('')
    setEditDescription('')
    setEditTags([])
  }

  // Function to discard unsaved changes (can be called by parent component)
  const discardUnsavedChanges = () => {
    if (hasUnsavedChanges) {
      handleCancelEdit()
    }
  }

  // Expose discard function to parent component
  useImperativeHandle(ref, () => ({
    discardUnsavedChanges,
    saveChanges: handleSaveEdit,
    hasUnsavedChanges
  }), [hasUnsavedChanges])

  const handleSaveEdit = async () => {
    try {
      if (!media.id) return
      await updateMediaMutation.mutateAsync({
        mediaId: media.id,
        title: editTitle,
        description: editDescription,
        tags: editTags
      })
      
      setLocalTitle(editTitle)
      setLocalDescription(editDescription)
      setLocalTags([...editTags])
      setIsEditing(false)
      
      // Update the media prop if updateMedia function is provided
      if (updateMedia && media.id) {
        updateMedia(media.id, {
          altText: editTitle,
          caption: editDescription,
          tags: editTags
        })
      }
      
      // Update the MediaDetailProvider context to keep navigation state in sync
      if (media.id && updateMediaInContext) {
        updateMediaInContext(media.id, {
          altText: editTitle,
          caption: editDescription,
          tags: editTags
        })
      }
      
      if (onMediaUpdate) {
        onMediaUpdate()
      }
    } catch (error) {
      console.error('Failed to update media:', error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const handleAuthorClick = (authorId: string, authorUsername: string | null) => {
    if (authorUsername) {
      // Navigate to user profile - this would need to be handled by the parent component
      // For now, we'll just log it
      console.log('Navigate to user:', authorUsername)
    }
  }

  // Comments handling functions
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim() || !media?.id) return

    try {
      await createCommentMutation.mutateAsync({
        mediaId: media.id,
        content: commentText.trim()
      })
      setCommentText('')
    } catch (error) {
      console.error('Failed to create comment:', error)
    }
  }

  // Get status message and icon for video processing
  const getProcessingInfo = () => {
    if (!processingStatus || mediaType !== 'VIDEO') return null
    
    switch (processingStatus) {
      case 'PENDING':
        return {
          message: 'Video is queued for processing...',
          icon: <Clock className="h-8 w-8 text-blue-500" />,
          color: 'text-blue-600'
        }
      case 'PROCESSING':
        return {
          message: 'Video is being processed...',
          icon: <Loader2 className="h-8 w-8 text-yellow-500 animate-spin" />,
          color: 'text-yellow-600'
        }
      case 'FAILED':
        return {
          message: 'Video processing failed. Please try uploading again.',
          icon: <XIcon className="h-8 w-8 text-red-500" />,
          color: 'text-red-600'
        }
      default:
        return {
          message: 'Video is being prepared...',
          icon: <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />,
          color: 'text-blue-600'
        }
    }
  }

  const processingInfo = getProcessingInfo()

  // Slideshow speed control functions
  const formatSlideshowSpeed = (speed: number) => {
    if (speed < 1000) {
      return `${speed}ms`
    } else {
      return `${Math.round(speed / 1000)}s`
    }
  }

  // Logarithmic scale for slideshow speed
  // Convert slider value (0-100) to speed (3000-60000ms)
  const sliderToSpeed = (sliderValue: number) => {
    // Use logarithmic scale: 3s to 60s
    const minSpeed = 3000 // 3 seconds
    const maxSpeed = 60000 // 60 seconds
    const logMin = Math.log(minSpeed)
    const logMax = Math.log(maxSpeed)
    const logValue = logMin + (logMax - logMin) * (sliderValue / 100)
    return Math.round(Math.exp(logValue))
  }

  // Convert speed to slider value
  const speedToSlider = (speed: number) => {
    const minSpeed = 3000
    const maxSpeed = 60000
    const logMin = Math.log(minSpeed)
    const logMax = Math.log(maxSpeed)
    const logSpeed = Math.log(speed)
    return Math.round(((logSpeed - logMin) / (logMax - logMin)) * 100)
  }

  const handleSlideshowSpeedChange = (sliderValue: number) => {
    if (slideshow) {
      const newSpeed = sliderToSpeed(sliderValue)
      slideshow.updateSlideshowSpeed(newSpeed)
    }
  }

  const handleReprocess = async () => {
    try {
      await reprocessMediaMutation.mutateAsync(media.id)
      
      // Update the MediaDetailProvider context to reflect the new processing status
      if (updateMediaInContext) {
        updateMediaInContext(media.id, {
          processingStatus: 'PENDING'
        })
      }
      
      // The query invalidation in the hook will automatically refresh the UI
    } catch (error) {
      console.error('Failed to reprocess media:', error)
    }
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Loading indicator */}
      {isLoadingMetadata && (
        <div className="flex items-center justify-center p-2 bg-blue-50 border-b border-blue-200">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600 mr-2" />
          <span className="text-sm text-blue-600">Loading fresh metadata...</span>
        </div>
      )}
      
      <div className="p-4 border-b border-gray-200">
      <div className="flex items-start justify-between mb-2">
        {isEditing ? (
          <div className="flex-1 space-y-3">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => handleEditTitleChange(e.target.value)}
              placeholder={`${mediaType === 'IMAGE' ? 'Image' : 'Video'} title...`}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-medium"
            />
            <textarea
              value={editDescription}
              onChange={(e) => handleEditDescriptionChange(e.target.value)}
              placeholder={`${mediaType === 'IMAGE' ? 'Image' : 'Video'} description...`}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
            />
            <TagInput
              tags={editTags}
              onTagsChange={handleEditTagsChange}
              placeholder="Add tags..."
              className="w-full"
            />
            <div className="flex space-x-2">
              <button
                onClick={handleSaveEdit}
                disabled={updateMediaMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm"
              >
                {updateMediaMutation.isPending ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors duration-200 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {localTitle || `Untitled ${mediaType === 'IMAGE' ? 'Image' : 'Video'}`}
            </h3>
            {localDescription && (
              <p className="text-gray-600 text-sm mb-2">{localDescription}</p>
            )}
            {localTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {localTags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center space-x-4 text-xs text-gray-500">
              <span className="flex items-center">
                <Calendar className="h-3 w-3 mr-1" />
                {formatDate(metadataMedia.createdAt)}
              </span>
              <span className="flex items-center">
                <User className="h-3 w-3 mr-1" />
                <button
                  onClick={() => handleAuthorClick(metadataMedia.authorId, metadataMedia.author?.username || null)}
                  className="hover:text-blue-600 transition-colors duration-200"
                >
                  {metadataMedia.author?.name || metadataMedia.author?.username || 'Unknown User'}
                </button>
              </span>
              {metadataMedia.originalFilename && (
                <span className="flex items-center">
                  <FileText className="h-3 w-3 mr-1" />
                  {metadataMedia.originalFilename.slice(0, 10)}
                </span>
              )}
              {mediaType === 'VIDEO' && duration && (
                <span className="flex items-center">
                  <Video className="h-3 w-3 mr-1" />
                  {formatTime(duration)}
                </span>
              )}
              {mediaType === 'VIDEO' && processingStatus && processingStatus !== 'COMPLETED' && (
                <span className={`flex items-center ${processingInfo?.color || 'text-blue-600'}`}>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  {processingStatus}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center space-x-2">
          {!isEditing && isOwner && (
            <button
              onClick={handleStartEdit}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              title={`Edit ${mediaType === 'IMAGE' ? 'Image' : 'Video'}`}
            >
              <Edit2 className="h-4 w-4" />
            </button>
          )}
          
          {/* Reprocess button - only show for failed media owned by the user */}
          {!isEditing && isOwner && (
            (processingStatus === 'FAILED') && (
            <div className="flex flex-col items-end space-y-2">
              <button
                onClick={handleReprocess}
                disabled={reprocessMediaMutation.isPending}
                className={`p-2 rounded-lg transition-colors duration-200 ${
                  reprocessMediaMutation.isPending 
                    ? 'text-blue-600 bg-blue-100' 
                    : 'text-red-400 hover:text-red-600 hover:bg-red-100'
                }`}
                title={reprocessMediaMutation.isPending ? "Reprocessing..." : "Reprocess Media"}
              >
                {reprocessMediaMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </button>
              
              {/* Reprocessing status message */}
              {reprocessMediaMutation.isPending && (
                <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                  Reprocessing...
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Comments Section */}
      <div className="mt-4 border-t border-gray-200">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-gray-900 flex items-center">
              <MessageCircle className="h-4 w-4 mr-2" />
              Comments
            </h4>
            <button
              onClick={() => setShowComments(!showComments)}
              className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
            >
              {showComments ? 'Hide' : 'Show'} Comments
            </button>
          </div>

          {showComments && (
            <>
              {/* Comments List */}
              <div className="mb-4 max-h-64 overflow-y-auto">
                {commentsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  </div>
                ) : commentsData?.data?.comments?.length ? (
                  <div className="space-y-4">
                    {commentsData.data.comments.map((comment: Comment) => (
                      <div key={comment.id} className="flex items-start space-x-3">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
                          {comment.author?.username?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <button
                              onClick={() => handleAuthorClick(comment.authorId, comment.author?.username || null)}
                              className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors duration-200"
                            >
                              {comment.author?.username || 'Unknown User'}
                            </button>
                            <span className="text-xs text-gray-500">
                              {formatDate(comment.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">{comment.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No comments yet. Be the first to comment!</p>
                )}
              </div>

              {/* Comment Form */}
              {authData?.data?.user && (
                <form onSubmit={handleCommentSubmit} className="flex space-x-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={createCommentMutation.isPending}
                  />
                  <button
                    type="submit"
                    disabled={!commentText.trim() || createCommentMutation.isPending}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center space-x-1"
                  >
                    {createCommentMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        <span>Post</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>

      {/* Slideshow Speed Control */}
      {slideshow && slideshow.isSlideshowActive && canNavigate && allMedia && allMedia.length > 1 && (
        <div className="mt-4 p-4 border-t border-gray-200 bg-blue-50">
          <div className="flex items-center space-x-2 mb-3">
            <Clock className="h-4 w-4 text-blue-600" />
            <h4 className="text-sm font-medium text-gray-900">Slideshow Speed</h4>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">3s</span>
              <span className="text-xs text-gray-600">60s</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={speedToSlider(slideshow.currentSlideshowSpeed)}
              onChange={(e) => handleSlideshowSpeedChange(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${speedToSlider(slideshow.currentSlideshowSpeed)}%, #e5e7eb ${speedToSlider(slideshow.currentSlideshowSpeed)}%, #e5e7eb 100%)`
              }}
            />
            <div className="text-center">
              <span className="text-sm font-medium text-blue-600">
                {formatSlideshowSpeed(slideshow.currentSlideshowSpeed)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  )
})

MediaMetadataPanel.displayName = 'MediaMetadataPanel'
