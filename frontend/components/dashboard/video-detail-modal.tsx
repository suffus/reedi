import React, { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, MessageCircle, Send, Calendar, User, Play, Pause, Volume2, VolumeX, Maximize, Minimize, Edit2, Save, X as XIcon, ChevronLeft, ChevronRight, FileText, Video, HardDrive, PanelLeftClose, PanelLeftOpen, Loader2, Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMediaComments, useCreateComment, useAuth, useUpdateMedia, useVideoQualities, VideoQuality } from '@/lib/api-hooks'
import { getMediaUrlFromMedia } from '@/lib/api'
import { TagInput } from '../tag-input'
import { Media, Comment } from '@/lib/types'
import { mapMediaData } from '@/lib/media-utils'
import { useSlideshow } from '@/lib/hooks/use-slideshow'

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
  
  // Unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null)
  
  // Update local state when media prop changes (for navigation)
  useEffect(() => {
    setLocalTitle(media?.altText || '')
    setLocalDescription(media?.caption || '')
    setLocalTags(media?.tags || [])
    // Reset edit state when navigating to a new media
    setIsEditing(false)
    setEditTitle('')
    setEditDescription('')
    setEditTags([])
    // Reset unsaved changes tracking
    setHasUnsavedChanges(false)
    setShowUnsavedChangesDialog(false)
    setPendingNavigation(null)
    // Reset video player state when navigating to a new video
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setVolume(1)
    setIsMuted(false)
    setIsFullscreen(false)
    setShowControls(true)
  }, [media?.id, media?.altText, media?.caption, media?.tags])
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
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 })
  const [screenDimensions, setScreenDimensions] = useState({ width: 0, height: 0 })
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const { data: commentsData, isLoading: commentsLoading } = useMediaComments(media.id)
  const createCommentMutation = useCreateComment()
  const updateMediaMutation = useUpdateMedia()
  const { data: authData } = useAuth()
  
  // Video quality functionality
  const { data: videoQualities, isLoading: qualitiesLoading } = useVideoQualities(media.id)
  const [selectedQuality, setSelectedQuality] = useState<string>('auto')
  const [showQualityMenu, setShowQualityMenu] = useState(false)
  
  // Check if current user is the media owner
  const isOwner = authData?.data?.user?.id === media.authorId

  // Slideshow functionality
  const slideshow = useSlideshow({
    allMedia: allMedia || [],
    currentMedia: media,
    onNavigate: onNavigate || (() => {}),
    slideshowSpeed: 3000
  })

  // Navigation logic (for compatibility with existing code)
  const canNavigate = allMedia && allMedia.length > 1 && onNavigate
  const currentIndex = canNavigate ? allMedia.findIndex(m => m.id === media.id) : -1
  const hasNext = canNavigate && currentIndex !== -1 && currentIndex < allMedia.length - 1
  const hasPrev = canNavigate && currentIndex !== -1 && currentIndex > 0



  // Navigation with unsaved changes handling
  const handleNavigationWithUnsavedChanges = useCallback((navigationFunction: () => void) => {
    if (hasUnsavedChanges) {
      setShowUnsavedChangesDialog(true)
      setPendingNavigation(() => navigationFunction)
    } else {
      navigationFunction()
    }
  }, [hasUnsavedChanges])

  const handleConfirmNavigation = useCallback(() => {
    setShowUnsavedChangesDialog(false)
    if (pendingNavigation) {
      pendingNavigation()
      setPendingNavigation(null)
    }
  }, [pendingNavigation])

  const handleCancelNavigation = useCallback(() => {
    setShowUnsavedChangesDialog(false)
    setPendingNavigation(null)
  }, [])

  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowUnsavedChangesDialog(true)
      setPendingNavigation(() => onClose)
    } else {
      onClose()
    }
  }, [hasUnsavedChanges, onClose])

  const handleNext = useCallback(() => {
    if (!canNavigate || !hasNext) return
    const nextIndex = currentIndex + 1
    handleNavigationWithUnsavedChanges(() => onNavigate(allMedia[nextIndex]))
  }, [canNavigate, hasNext, currentIndex, onNavigate, allMedia, handleNavigationWithUnsavedChanges])

  const handlePrev = useCallback(() => {
    if (!canNavigate || !hasPrev) return
    const prevIndex = currentIndex - 1
    handleNavigationWithUnsavedChanges(() => onNavigate(allMedia[prevIndex]))
  }, [canNavigate, hasPrev, currentIndex, onNavigate, allMedia, handleNavigationWithUnsavedChanges])

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
      setVideoDimensions({
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight
      })
      // Notify slideshow that media has loaded
      slideshow.handleMediaLoad()
      
      // Auto-play video if slideshow is active
      if (slideshow.isSlideshowActive) {
        videoRef.current.play().catch(error => {
          console.log('Auto-play failed:', error)
          // Auto-play might fail due to browser policies, that's okay
        })
      }
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

  // Calculate proper fullscreen scaling based on aspect ratios
  const getFullscreenStyle = (): React.CSSProperties => {
    if (!isFullscreen || videoDimensions.width === 0 || videoDimensions.height === 0) {
      return {}
    }

    const videoAspectRatio = videoDimensions.width / videoDimensions.height
    const screenAspectRatio = window.innerWidth / window.innerHeight

    if (videoAspectRatio < screenAspectRatio) {
      // Video is more portrait than screen - fit to height
      return {
        width: 'auto',
        height: '100vh',
        objectFit: 'contain' as const
      }
    } else {
      // Video is more landscape than screen - fit to width
      return {
        width: '100vw',
        height: 'auto',
        objectFit: 'contain' as const
      }
    }
  }

  // Update screen dimensions and listen for fullscreen changes
  useEffect(() => {
    const updateScreenDimensions = () => {
      setScreenDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
      // Update screen dimensions when fullscreen changes
      setTimeout(updateScreenDimensions, 100)
    }

    // Initial screen dimensions
    updateScreenDimensions()

    // Listen for window resize and fullscreen changes
    window.addEventListener('resize', updateScreenDimensions)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    
    return () => {
      window.removeEventListener('resize', updateScreenDimensions)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Get current video source based on selected quality
  const getCurrentVideoSource = () => {
    if (selectedQuality === 'auto' || !videoQualities || videoQualities.length === 0) {
      return getMediaUrlFromMedia(media, false)
    }
    
    const selectedQualityData = videoQualities.find(q => q.quality === selectedQuality)
    return selectedQualityData?.url || getMediaUrlFromMedia(media, false)
  }

  // Handle quality change
  const handleQualityChange = (quality: string) => {
    if (videoRef.current) {
      const currentTime = videoRef.current.currentTime
      const wasPlaying = !videoRef.current.paused
      
      setSelectedQuality(quality)
      setShowQualityMenu(false)
      
      // Update video source
      const newSource = quality === 'auto' 
        ? getMediaUrlFromMedia(media, false)
        : videoQualities?.find(q => q.quality === quality)?.url || getMediaUrlFromMedia(media, false)
      
      videoRef.current.src = newSource
      
      // Restore playback state
      videoRef.current.currentTime = currentTime
      if (wasPlaying) {
        videoRef.current.play().catch(console.error)
      }
    }
  }

  // Close quality menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.quality-selector')) {
        setShowQualityMenu(false)
      }
    }

    if (showQualityMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showQualityMenu])

  // State for seek indicator
  const [showSeekIndicator, setShowSeekIndicator] = useState(false)
  const [seekDirection, setSeekDirection] = useState<'forward' | 'backward'>('forward')
  const [seekAmount, setSeekAmount] = useState(0)
  const seekIndicatorTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Function to seek video forward or backward
  const seekVideo = (seconds: number) => {
    if (videoRef.current) {
      const newTime = Math.min(
        Math.max(0, videoRef.current.currentTime + seconds),
        videoRef.current.duration || 0
      )
      videoRef.current.currentTime = newTime
      setCurrentTime(newTime)
      
      // Show seek indicator
      setSeekDirection(seconds > 0 ? 'forward' : 'backward')
      setSeekAmount(Math.abs(seconds))
      setShowSeekIndicator(true)
      
      // Hide seek indicator after 1 second
      if (seekIndicatorTimeoutRef.current) {
        clearTimeout(seekIndicatorTimeoutRef.current)
      }
      seekIndicatorTimeoutRef.current = setTimeout(() => {
        setShowSeekIndicator(false)
      }, 1000)
    }
  }


  // Check if video is still processing
  const isProcessing = media.processingStatus !== 'COMPLETED'
  const processingStatus = media.processingStatus || 'PENDING'

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
        handleClose()
      } else if (e.key === 'ArrowRight') {
        // When video is loaded, seek forward 8 seconds
        if (videoRef.current && !isProcessing && duration > 0) {
          e.preventDefault()
          seekVideo(8)
        } 
        // Only navigate to next media if video is not loaded
        else if (slideshow.hasNext) {
          slideshow.handleNext()
        }
      } else if (e.key === 'ArrowLeft') {
        // When video is loaded, seek backward 8 seconds
        if (videoRef.current && !isProcessing && duration > 0) {
          e.preventDefault()
          seekVideo(-8)
        }
        // Only navigate to previous media if video is not loaded
        else if (slideshow.hasPrev) {
          slideshow.handlePrev()
        }
      } else if (e.key === ' ') {
        e.preventDefault()
        handleTogglePlay()
      } else if (e.key === 'f' || e.key === 'F') {
        handleFullscreen()
      } else if (e.key === 'm' || e.key === 'M') {
        handleToggleMute()
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        slideshow.toggleSlideshow()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, slideshow.hasNext, slideshow.hasPrev, slideshow.handleNext, slideshow.handlePrev, slideshow.toggleSlideshow, handleTogglePlay, handleFullscreen, handleToggleMute, isProcessing])

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

  // Track changes in edit fields
  const handleEditTitleChange = (value: string) => {
    setEditTitle(value)
    // Only check for changes if we're in editing mode
    if (isEditing) {
      setHasUnsavedChanges(value !== localTitle || editDescription !== localDescription || JSON.stringify(editTags) !== JSON.stringify(localTags))
    }
  }

  const handleEditDescriptionChange = (value: string) => {
    setEditDescription(value)
    // Only check for changes if we're in editing mode
    if (isEditing) {
      setHasUnsavedChanges(editTitle !== localTitle || value !== localDescription || JSON.stringify(editTags) !== JSON.stringify(localTags))
    }
  }

  const handleEditTagsChange = (tags: string[]) => {
    setEditTags(tags)
    // Only check for changes if we're in editing mode
    if (isEditing) {
      setHasUnsavedChanges(editTitle !== localTitle || editDescription !== localDescription || JSON.stringify(tags) !== JSON.stringify(localTags))
    }
  }

  const handleStartEdit = () => {
    setEditTitle(localTitle)
    setEditDescription(localDescription)
    setEditTags([...localTags])
    setIsEditing(true)
    setHasUnsavedChanges(false)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditTitle('')
    setEditDescription('')
    setEditTags([])
    setHasUnsavedChanges(false)
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
      setHasUnsavedChanges(false)
      
      // Update the media prop if updateMedia function is provided
      if (updateMedia) {
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

  const handleAuthorClick = (authorId: string, authorUsername: string | null) => {
    if (authorUsername) {
      router.push(`/user/${authorUsername}`)
    }
  }

  const togglePanel = () => {
    setIsPanelMinimized(!isPanelMinimized)
  }

  const mappedMedia = mapMediaData(media)

  // Auto-play video when navigating to it (if slideshow is active)
  useEffect(() => {
    if (videoRef.current && slideshow.isSlideshowActive && !isProcessing) {
      // Small delay to ensure video is ready
      const timer = setTimeout(() => {
        if (videoRef.current && slideshow.isSlideshowActive) {
          videoRef.current.play().catch(error => {
            console.log('Auto-play failed:', error)
            // Auto-play might fail due to browser policies, that's okay
          })
        }
      }, 100)
      
      return () => clearTimeout(timer)
    }
  }, [media?.id, slideshow.isSlideshowActive, isProcessing])

  // Get status message and icon
  const getProcessingInfo = () => {
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
          icon: <X className="h-8 w-8 text-red-500" />,
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

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex"
        onWheel={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onKeyDown={(e) => {
          e.stopPropagation()
        }}
        onMouseDown={(e) => {
          e.stopPropagation()
        }}
        onMouseMove={(e) => {
          e.stopPropagation()
        }}
        onMouseUp={(e) => {
          e.stopPropagation()
        }}
      >
        <div className="flex-1 flex flex-col bg-black" ref={containerRef}>
          {/* Video Container */}
          <div 
            ref={containerRef}
            className="flex-1 flex items-center justify-center relative overflow-hidden"
          >
            {/* Close Button */}
            <motion.button
              onClick={handleClose}
              className="absolute top-4 left-4 z-10 p-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200"
              animate={{ opacity: controlsVisible ? 1 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <X className="h-5 w-5" />
            </motion.button>

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

            {/* Navigation Buttons */}
            {canNavigate && (
              <>
                {/* Previous Button */}
                <motion.button
                  onClick={slideshow.handlePrev}
                  className={`absolute left-4 top-1/2 transform -translate-y-1/2 z-10 p-3 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200 ${
                    !slideshow.hasPrev ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'
                  }`}
                  disabled={!slideshow.hasPrev}
                  title="Previous video (←)"
                  animate={{ opacity: controlsVisible ? 1 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <ChevronLeft className="h-6 w-6" />
                </motion.button>

                {/* Next Button */}
                <motion.button
                  onClick={slideshow.handleNext}
                  className={`absolute right-4 top-1/2 transform -translate-y-1/2 z-10 p-3 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200 ${
                    !slideshow.hasNext ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'
                  }`}
                  disabled={!slideshow.hasNext}
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
                  {slideshow.currentIndex + 1} / {allMedia.length}
                </motion.div>

                {/* Slideshow Controls */}
                <motion.div 
                  className="absolute bottom-20 right-4 z-10 flex items-center space-x-2"
                  animate={{ opacity: controlsVisible ? 1 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Slideshow Toggle */}
                  <button
                    onClick={slideshow.toggleSlideshow}
                    className="p-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200"
                    title={slideshow.isSlideshowActive ? "Pause Slideshow" : "Start Slideshow"}
                  >
                    {slideshow.isSlideshowActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>

                  {/* Slideshow Speed Control */}
                  {slideshow.isSlideshowActive && (
                    <div className="flex items-center space-x-2 bg-black bg-opacity-50 px-3 py-1 rounded-full">
                      <span className="text-white text-xs">Speed:</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={Math.max(0, Math.min(100, (slideshow.currentSlideshowSpeed - 1000) / 59000 * 100))}
                        onChange={(e) => {
                          const sliderValue = parseInt(e.target.value)
                          const newSpeed = 1000 + (sliderValue / 100) * 59000 // 1s to 60s
                          slideshow.updateSlideshowSpeed(newSpeed)
                        }}
                        className="w-16 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                        style={{
                          background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${Math.max(0, Math.min(100, (slideshow.currentSlideshowSpeed - 1000) / 59000 * 100))}%, #6b7280 ${Math.max(0, Math.min(100, (slideshow.currentSlideshowSpeed - 1000) / 59000 * 100))}%, #6b7280 100%)`
                        }}
                      />
                      <span className="text-white text-xs">
                        {slideshow.currentSlideshowSpeed < 1000 
                          ? `${slideshow.currentSlideshowSpeed}ms` 
                          : `${Math.round(slideshow.currentSlideshowSpeed / 1000)}s`
                        }
                      </span>
                    </div>
                  )}
                </motion.div>
              </>
            )}
            {isProcessing ? (
              // Processing overlay
              <div className="flex flex-col items-center justify-center text-center p-8 bg-black bg-opacity-75 rounded-lg">
                {processingInfo.icon}
                <h3 className={`text-xl font-semibold mt-4 ${processingInfo.color}`}>
                  {processingInfo.message}
                </h3>
                <p className="text-gray-300 mt-2 text-sm">
                  This may take a few minutes depending on the video size.
                </p>
                <div className="mt-6 flex items-center space-x-2 text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Processing status: {processingStatus}</span>
                </div>
                {processingStatus === 'FAILED' && (
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 text-sm"
                  >
                    Refresh to Check Status
                  </button>
                )}
              </div>
            ) : (
              // Video player with improved sizing for portrait videos
              <div className="w-full h-full flex items-center justify-center p-4 relative">
                <video
                  ref={videoRef}
                  className={`${
                    isFullscreen 
                      ? 'w-full h-full' 
                      : 'w-auto h-auto max-w-full max-h-full object-contain'
                  }`}
                  style={{
                    ...(isFullscreen && getFullscreenStyle()),
                    // Ensure video maintains aspect ratio and fits within viewport
                    maxWidth: '100%',
                    maxHeight: '100%',
                    width: 'auto',
                    height: 'auto'
                  }}
                  src={getCurrentVideoSource()}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => {
                    setIsPlaying(false)
                    // Notify slideshow that video ended
                    slideshow.handleVideoEnd()
                  }}
                  onClick={handleTogglePlay}
                >
                  Your browser does not support the video tag.
                </video>
                
                {/* Seek Indicator */}
                {showSeekIndicator && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-black bg-opacity-70 text-white px-6 py-4 rounded-lg flex items-center space-x-3 transform scale-110 animate-pulse">
                      {seekDirection === 'forward' ? (
                        <ChevronRight className="h-8 w-8" />
                      ) : (
                        <ChevronLeft className="h-8 w-8" />
                      )}
                      <span className="text-2xl font-bold">{seekAmount} sec</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Video Controls Overlay */}
            {!isProcessing && (
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
                  {/* Quality Selector */}
                  {videoQualities && videoQualities.length > 1 && (
                    <div className="relative quality-selector">
                      <button
                        onClick={() => setShowQualityMenu(!showQualityMenu)}
                        className="px-3 py-1 bg-black bg-opacity-50 text-white text-sm rounded border border-gray-600 hover:bg-opacity-70 transition-all duration-200 flex items-center space-x-1"
                      >
                        <span>{selectedQuality === 'auto' ? 'Auto' : selectedQuality}</span>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {showQualityMenu && (
                        <div className="absolute bottom-full right-0 mb-2 bg-black bg-opacity-90 text-white text-sm rounded border border-gray-600 min-w-[120px] z-10">
                          <div className="p-1">
                            <button
                              onClick={() => handleQualityChange('auto')}
                              className={`w-full text-left px-2 py-1 rounded hover:bg-white hover:bg-opacity-20 ${
                                selectedQuality === 'auto' ? 'bg-white bg-opacity-20' : ''
                              }`}
                            >
                              Auto
                            </button>
                            {videoQualities.map((quality) => (
                              <button
                                key={quality.quality}
                                onClick={() => handleQualityChange(quality.quality)}
                                className={`w-full text-left px-2 py-1 rounded hover:bg-white hover:bg-opacity-20 ${
                                  selectedQuality === quality.quality ? 'bg-white bg-opacity-20' : ''
                                }`}
                              >
                                {quality.quality} ({quality.width}x{quality.height})
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

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
            )}
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
                      onChange={(e) => handleEditTitleChange(e.target.value)}
                      placeholder="Video title..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-medium"
                    />
                    <textarea
                      value={editDescription}
                      onChange={(e) => handleEditDescriptionChange(e.target.value)}
                      placeholder="Video description..."
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
                      {media.originalFilename && (
                        <span className="flex items-center">
                          <FileText className="h-3 w-3 mr-1" />
                          {media.originalFilename}
                        </span>
                      )}
                      {media.duration && (
                        <span className="flex items-center">
                          <Video className="h-3 w-3 mr-1" />
                          {formatTime(media.duration)}
                        </span>
                      )}
                      {isProcessing && (
                        <span className={`flex items-center ${processingInfo.color}`}>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          {processingStatus}
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

      {/* Unsaved Changes Dialog */}
      <AnimatePresence>
        {showUnsavedChangesDialog && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Unsaved Changes
              </h3>
              <p className="text-gray-600 mb-6">
                You have unsaved changes to this media. Do you want to save them before continuing?
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={handleCancelNavigation}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmNavigation}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
                >
                  Discard Changes
                </button>
                <button
                  onClick={async () => {
                    await handleSaveEdit()
                    if (pendingNavigation) {
                      pendingNavigation()
                      setPendingNavigation(null)
                    }
                    setShowUnsavedChangesDialog(false)
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  Save & Continue
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  )
} 