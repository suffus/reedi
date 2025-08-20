import React, { useState, useEffect } from 'react'
import { Calendar, User, FileText, Video, Loader2, Edit2, Save, X as XIcon, Clock, RefreshCw } from 'lucide-react'
import { TagInput } from '../tag-input'
import { Media } from '@/lib/types'
import { useUpdateMedia, useReprocessMedia } from '@/lib/api-hooks'

interface MediaMetadataPanelProps {
  media: Media
  isOwner: boolean
  onMediaUpdate?: () => void
  updateMedia?: (mediaId: string, updates: Partial<any>) => void
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
}

export function MediaMetadataPanel({ 
  media, 
  isOwner, 
  onMediaUpdate, 
  updateMedia,
  slideshow,
  canNavigate,
  allMedia,
  mediaType,
  processingStatus,
  duration
}: MediaMetadataPanelProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editTags, setEditTags] = useState<string[]>([])
  const [localTitle, setLocalTitle] = useState(media?.altText || '')
  const [localDescription, setLocalDescription] = useState(media?.caption || '')
  const [localTags, setLocalTags] = useState<string[]>(media?.tags || [])
  
  const updateMediaMutation = useUpdateMedia()
  const reprocessMediaMutation = useReprocessMedia()

  // Update local state when media prop changes
  useEffect(() => {
    setLocalTitle(media?.altText || '')
    setLocalDescription(media?.caption || '')
    setLocalTags(media?.tags || [])
    // Reset edit state when navigating to a new media
    setIsEditing(false)
    setEditTitle('')
    setEditDescription('')
    setEditTags([])
  }, [media?.id, media?.altText, media?.caption, media?.tags])

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
      // The query invalidation in the hook will automatically refresh the UI
    } catch (error) {
      console.error('Failed to reprocess media:', error)
    }
  }

  return (
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
                {formatDate(media.createdAt)}
              </span>
              <span className="flex items-center">
                <User className="h-3 w-3 mr-1" />
                <button
                  onClick={() => handleAuthorClick(media.authorId, null)}
                  className="hover:text-blue-600 transition-colors duration-200"
                >
                  Unknown User
                </button>
              </span>
              {media.originalFilename && (
                <span className="flex items-center">
                  <FileText className="h-3 w-3 mr-1" />
                  {media.originalFilename.slice(0, 10)}
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
            <button
              onClick={handleReprocess}
              disabled={reprocessMediaMutation.isPending}
              className="p-2 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors duration-200"
              title="Reprocess Media"
            >
              {reprocessMediaMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </button>
          ))}
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
  )
}
