import React, { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, MessageCircle, Send, Calendar, User, Play, Pause, Volume2, VolumeX, Maximize, Minimize, Edit2, Save, X as XIcon, ChevronLeft, ChevronRight, FileText, Video, HardDrive, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMediaComments, useCreateComment, useAuth, useUpdateMedia } from '@/lib/api-hooks'
import { getMediaUrlFromMedia } from '@/lib/api'
import { TagInput } from '../tag-input'
import { Media, Comment } from '@/lib/types'
import { mapMediaData } from '@/lib/media-utils'

interface VideoDetailModalProps {
  media: Media | null
  onClose: () => void
  onMediaUpdate?: () => void
  updateMedia?: (mediaId: string, updates: Partial<any>) => void
  // Navigation props
  allMedia?: Media[]
  onNavigate?: (media: Media) => void
}

export function VideoDetailModal({ media, onClose, onMediaUpdate, updateMedia, allMedia, onNavigate }: VideoDetailModalProps) {
  // Return early if no media or if it's not a video
  if (!media || media.mediaType !== 'VIDEO') {
    return null
  }

  const router = useRouter()
  const [commentText, setCommentText] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editTags, setEditTags] = useState<string[]>([])
  const [localTitle, setLocalTitle] = useState(media?.altText || '')
  const [localDescription, setLocalDescription] = useState(media?.caption || '')
  const [localTags, setLocalTags] = useState<string[]>(media?.tags || [])
  const [isPanelMinimized, setIsPanelMinimized] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Video player state
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [videoQuality, setVideoQuality] = useState('auto')
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const { data: commentsData, isLoading: commentsLoading } = useMediaComments(media.id)
  const createCommentMutation = useCreateComment()
  const updateMediaMutation = useUpdateMedia()
  const { data: authData } = useAuth()
  
  // Check if current user is the media owner
  const isOwner = authData?.data?.user?.id === media.authorId

  // Navigation logic
  const canNavigate = allMedia && allMedia.length > 1 && onNavigate
  const currentIndex = canNavigate ? allMedia.findIndex(m => m.id === media.id) : -1
  const hasNext = canNavigate && currentIndex !== -1 && currentIndex < allMedia.length - 1
  const hasPrev = canNavigate && currentIndex !== -1 && currentIndex > 0

  const handleNext = useCallback(() => {
    if (!canNavigate || !hasNext) return
    const nextIndex = currentIndex + 1
    onNavigate(allMedia[nextIndex])
  }, [canNavigate, hasNext, currentIndex, onNavigate, allMedia])

  const handlePrev = useCallback(() => {
    if (!canNavigate || !hasPrev) return
    const prevIndex = currentIndex - 1
    onNavigate(allMedia[prevIndex])
  }, [canNavigate, hasPrev, currentIndex, onNavigate, allMedia])

  // Video event handlers
  const handlePlay = () => {
    if (videoRef.current) {
      videoRef.current.play()
      setIsPlaying(true)
    }
  }

  const handlePause = () => {
    if (videoRef.current) {
      videoRef.current.pause()
      setIsPlaying(false)
    }
  }

  const handleTogglePlay = () => {
    if (isPlaying) {
      handlePause()
    } else {
      handlePlay()
    }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value)
    if (videoRef.current) {
      videoRef.current.currentTime = newTime
      setCurrentTime(newTime)
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    if (videoRef.current) {
      videoRef.current.volume = newVolume
    }
    if (newVolume === 0) {
      setIsMuted(true)
    } else if (isMuted) {
      setIsMuted(false)
    }
  }

  const handleToggleMute = () => {
    if (videoRef.current) {
      if (isMuted) {
        videoRef.current.volume = volume
        setIsMuted(false)
      } else {
        videoRef.current.volume = 0
        setIsMuted(true)
      }
    }
  }

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle keyboard shortcuts if user is typing in an input field
      const activeElement = document.activeElement
      const isTyping = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.getAttribute('contenteditable') === 'true'
      )
      
      if (isTyping) return
      
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowRight' && hasNext) {
        handleNext()
      } else if (e.key === 'ArrowLeft' && hasPrev) {
        handlePrev()
      } else if (e.key === ' ') {
        e.preventDefault()
        handleTogglePlay()
      } else if (e.key === 'f' || e.key === 'F') {
        handleFullscreen()
      } else if (e.key === 'm' || e.key === 'M') {
        handleToggleMute()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, hasNext, hasPrev, handleNext, handlePrev, handleTogglePlay, handleFullscreen, handleToggleMute])

  // Auto-hide controls
  useEffect(() => {
    const handleMouseMove = () => {
      setControlsVisible(true)
      setShowControls(true)
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
      controlsTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false)
        if (isPlaying) {
          setShowControls(false)
        }
      }, 3000)
    }

    document.addEventListener('mousemove', handleMouseMove)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [isPlaying])

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim()) return

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

  const handleStartEdit = () => {
    setEditTitle(localTitle)
    setEditDescription(localDescription)
    setEditTags([...localTags])
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditTitle(localTitle)
    setEditDescription(localDescription)
    setEditTags([...localTags])
  }

  const handleSaveEdit = async () => {
    try {
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

  const handleAuthorClick = (authorId: string, authorUsername: string | null) => {
    if (authorUsername) {
      router.push(`/user/${authorUsername}`)
    }
  }

  const togglePanel = () => {
    setIsPanelMinimized(!isPanelMinimized)
  }

  const mappedMedia = mapMediaData(media)

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex"
      >
        <div className="flex-1 flex flex-col bg-black" ref={containerRef}>
          {/* Close Button */}
          <motion.button
            onClick={onClose}
            className="absolute top-4 left-4 z-10 p-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200"
            animate={{ opacity: controlsVisible ? 1 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <X className="h-5 w-5" />
          </motion.button>

          {/* Navigation Buttons */}
          {canNavigate && (
            <>
              {/* Previous Button */}
              <motion.button
                onClick={handlePrev}
                className={`absolute left-4 top-1/2 transform -translate-y-1/2 z-10 p-3 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200 ${
                  !hasPrev ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'
                }`}
                disabled={!hasPrev}
                title="Previous video (←)"
                animate={{ opacity: controlsVisible ? 1 : 0 }}
                transition={{ duration: 0.3 }}
              >
                <ChevronLeft className="h-6 w-6" />
              </motion.button>

              {/* Next Button */}
              <motion.button
                onClick={handleNext}
                className={`absolute right-4 top-1/2 transform -translate-y-1/2 z-10 p-3 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200 ${
                  !hasNext ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'
                }`}
                disabled={!hasNext}
                title="Next video (→)"
                animate={{ opacity: controlsVisible ? 1 : 0 }}
                transition={{ duration: 0.3 }}
              >
                <ChevronRight className="h-6 w-6" />
              </motion.button>

              {/* Video Counter */}
              <motion.div 
                className="absolute bottom-20 left-4 z-10 px-3 py-1 bg-black bg-opacity-50 text-white text-sm rounded-full"
                animate={{ opacity: controlsVisible ? 1 : 0 }}
                transition={{ duration: 0.3 }}
              >
                {currentIndex + 1} / {allMedia.length}
              </motion.div>
            </>
          )}

          {/* Panel Toggle */}
          <motion.button
            onClick={togglePanel}
            className="absolute top-4 right-4 z-20 p-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200"
            title={isPanelMinimized ? "Show Panel" : "Hide Panel"}
            animate={{ opacity: controlsVisible ? 1 : 0 }}
            transition={{ duration: 0.3 }}
          >
            {isPanelMinimized ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </motion.button>

          {/* Video Container */}
          <div className="flex-1 flex items-center justify-center relative">
            <video
              ref={videoRef}
              className="max-w-full max-h-full"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              onClick={handleTogglePlay}
            >
              <source src={getMediaUrlFromMedia(media, false)} type="video/mp4" />
              Your browser does not support the video tag.
            </video>

            {/* Video Controls Overlay */}
            <motion.div
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4"
              animate={{ opacity: showControls ? 1 : 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Progress Bar */}
              <div className="mb-4">
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(currentTime / (duration || 1)) * 100}%, #6b7280 ${(currentTime / (duration || 1)) * 100}%, #6b7280 100%)`
                  }}
                />
                <div className="flex justify-between text-white text-sm mt-1">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Control Buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={handleTogglePlay}
                    className="p-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200"
                    title={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </button>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleToggleMute}
                      className="p-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200"
                      title={isMuted ? "Unmute" : "Mute"}
                    >
                      {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <select
                    value={videoQuality}
                    onChange={(e) => setVideoQuality(e.target.value)}
                    className="px-2 py-1 bg-black bg-opacity-50 text-white text-sm rounded border border-gray-600"
                  >
                    <option value="auto">Auto</option>
                    <option value="1080p">1080p</option>
                    <option value="720p">720p</option>
                    <option value="480p">480p</option>
                  </select>

                  <button
                    onClick={handleFullscreen}
                    className="p-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200"
                    title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                  >
                    {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Comments Section */}
        <motion.div 
          className={`border-l border-gray-200 flex flex-col bg-white overflow-hidden ${
            isPanelMinimized ? 'w-0' : 'w-[450px]'
          }`}
          animate={{ width: isPanelMinimized ? 0 : 450 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          {/* Video Info */}
          {isPanelMinimized ? (
            <div className="flex items-center justify-center h-8 border-b border-gray-200">
              <MessageCircle className="h-4 w-4 text-gray-400" />
            </div>
          ) : (
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-start justify-between mb-2">
                {isEditing ? (
                  <div className="flex-1 space-y-3">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Video title..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-medium"
                    />
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Video description..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                    />
                    <TagInput
                      tags={editTags}
                      onTagsChange={setEditTags}
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
                      {localTitle || 'Untitled Video'}
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
                      {media.duration && (
                        <span className="flex items-center">
                          <Video className="h-3 w-3 mr-1" />
                          {formatTime(media.duration)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                {!isEditing && isOwner && (
                  <button
                    onClick={handleStartEdit}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                    title="Edit Video"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Comments</h4>
              
              {commentsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="flex items-start space-x-3">
                        <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                        <div className="flex-1">
                          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                          <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                        </div>
                      </div>
                    </div>
                  ))}
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
          </div>

          {/* Comment Form */}
          <div className="p-4 border-t border-gray-200">
            <form onSubmit={handleSubmitComment} className="flex space-x-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                disabled={createCommentMutation.isPending}
              />
              <button
                type="submit"
                disabled={!commentText.trim() || createCommentMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 text-sm"
              >
                {createCommentMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
} 