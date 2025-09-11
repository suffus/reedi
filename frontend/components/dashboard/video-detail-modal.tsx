import React, { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, MessageCircle, Send, Play, Pause, Volume2, VolumeX, Maximize, Minimize, ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen, Loader2, Download } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth, useVideoQualities, VideoQuality } from '@/lib/api-hooks'
import { getMediaUrlFromMedia, fetchFreshMediaData } from '@/lib/api'
import { Media } from '@/lib/types'
import { mapMediaData } from '@/lib/media-utils'
import { useSlideshow } from '@/lib/hooks/use-slideshow'
import { MediaMetadataPanel, MediaMetadataPanelRef } from '@/components/common/media-metadata-panel'
import { UnsavedChangesDialog } from '@/components/common/unsaved-changes-dialog'
import { downloadFile, generateDownloadFilename, getFileExtension } from '@/lib/download-utils'

/**
 * VideoDetailModal Component
 * 
 * Features:
 * - Optimal video scaling: Videos smaller than viewport are scaled up to fit as large as possible
 * - Responsive design: Automatically adjusts to viewport changes
 * - Fullscreen support with proper aspect ratio handling
 * - Video quality selection
 * - Slideshow functionality
 * - Comments and metadata editing
 */

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
  // State for fresh media data
  const [freshMediaData, setFreshMediaData] = useState<Media | null>(null)
  const [isLoadingFreshData, setIsLoadingFreshData] = useState(false)

  // Fetch fresh media data when modal opens
  useEffect(() => {
    if (media?.id) {
      setIsLoadingFreshData(true)
      fetchFreshMediaData(media.id)
        .then(freshData => {
          setFreshMediaData(mapMediaData(freshData))
        })
        .catch(error => {
          console.error('Failed to fetch fresh media data:', error)
          // Fallback to original media data
          setFreshMediaData(media)
        })
        .finally(() => {
          setIsLoadingFreshData(false)
        })
    }
  }, [media?.id])

  // Return early if no media or if it's not a video
  if (!media || media.mediaType !== 'VIDEO') {
    return null
  }

  const router = useRouter()

  // Zoom and pan state for video
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [hasDragged, setHasDragged] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  
  // Initialize and cleanup AbortController for video requests
  useEffect(() => {
    // Create new AbortController when modal opens
    abortControllerRef.current = new AbortController()
    console.log('🔄 Video modal opened - created new AbortController')
    
    // Cleanup function when modal closes or unmounts
    return () => {
      return;
      console.log('🔄 Video modal closing or unmounting - aborting all video requests')
      /*
      if (abortControllerRef?.current) {
        if(abortControllerRef.current === null ) {
          return;
        }
        abortControllerRef.current.abort()
        
        // Also pause and reset video element if it exists
        if (videoRef.current) {
          //return;
          videoRef.current.pause()
          videoRef.current.src = ''
          videoRef.current.load()
        }
      }
        */
    }
  }, []) // Empty dependency array - runs once on mount, cleanup on unmount
  
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
  const [viewportChangeKey, setViewportChangeKey] = useState(0)
  const [isVideoLoading, setIsVideoLoading] = useState(false)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // AbortController for video requests
  const abortControllerRef = useRef<AbortController | null>(null)
  
  // Unsaved changes state
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  const metadataPanelRef = useRef<MediaMetadataPanelRef>(null)
  
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

  // Handle unsaved changes
  const handleUnsavedChangesChange = (hasChanges: boolean) => {
    setHasUnsavedChanges(hasChanges)
  }

  // Check for unsaved changes before performing an action
  const checkUnsavedChanges = (action: () => void) => {
    if (hasUnsavedChanges) {
      setPendingAction(() => action)
      setShowUnsavedDialog(true)
    } else {
      action()
    }
  }

  // Handle dialog actions
  const handleSaveChanges = async () => {
    if (metadataPanelRef.current) {
      try {
        await metadataPanelRef.current.saveChanges()
        setShowUnsavedDialog(false)
        setPendingAction(null)
        
        // Execute the pending action after successful save
        if (pendingAction) {
          pendingAction()
        }
      } catch (error) {
        console.error('Failed to save changes:', error)
        // Keep dialog open if save fails
      }
    }
  }

  const handleDiscardChanges = () => {
    if (metadataPanelRef.current) {
      metadataPanelRef.current.discardUnsavedChanges()
    }
    setShowUnsavedDialog(false)
    setPendingAction(null)
    
    // Execute the pending action
    if (pendingAction) {
      pendingAction()
    }
  }

  const handleCancelAction = () => {
    setShowUnsavedDialog(false)
    setPendingAction(null)
  }

  // Navigation logic (for compatibility with existing code)
  const canNavigate = allMedia && allMedia.length > 1 && onNavigate
  const currentIndex = canNavigate ? allMedia.findIndex(m => m.id === media.id) : -1
  const hasNext = canNavigate && currentIndex !== -1 && currentIndex < allMedia.length - 1
  const hasPrev = canNavigate && currentIndex !== -1 && currentIndex > 0



  // Manual abort function for video requests
  const abortVideoRequests = useCallback(() => {
    if (abortControllerRef.current) {
      console.log('🔄 Manually aborting video requests')
      abortControllerRef.current.abort()
      
      // Also pause and reset video element
      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.src = ''
        videoRef.current.load()
      }
    }
  }, [])

  const handleClose = useCallback(() => {
    // Abort any ongoing video requests before closing
    abortVideoRequests()
    
    checkUnsavedChanges(() => {
      onClose()
    })
  }, [onClose, hasUnsavedChanges, abortVideoRequests])

  const handleNext = useCallback(() => {
    if (!slideshow.hasNext) return
    checkUnsavedChanges(() => {
      // Abort current video requests before navigating
      abortVideoRequests()
      setIsVideoLoading(true)
      slideshow.handleNext()
    })
  }, [slideshow.hasNext, slideshow.handleNext, hasUnsavedChanges, abortVideoRequests])

  const handlePrev = useCallback(() => {
    if (!slideshow.hasPrev) return
    checkUnsavedChanges(() => {
      // Abort current video requests before navigating
      abortVideoRequests()
      setIsVideoLoading(true)
      slideshow.handlePrev()
    })
  }, [slideshow.hasPrev, slideshow.handlePrev, hasUnsavedChanges, abortVideoRequests])

  // Update video player state when media prop changes (for navigation)
  useEffect(() => {
    // Abort any ongoing video requests when navigating to a new video
    //abortVideoRequests()
    
    // Set loading state when navigating to new video
    setIsVideoLoading(true)
    
    // Reset video player state when navigating to a new video
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setVolume(1)
    setIsMuted(false)
    setIsFullscreen(false)
    setShowControls(true)
    // Reset zoom and pan when navigating to a new video
    resetView()
  }, [media?.id, abortVideoRequests])

  // Video event handlers
  const handlePlay = () => {
    if (videoRef.current) {
      console.log("Video src is now", videoRef.current.src)
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
      // Clear loading state when video metadata is loaded
      setIsVideoLoading(false)
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

  // Calculate optimal video scaling to fit viewport while maximizing size
  const getOptimalVideoStyle = (): React.CSSProperties => {
    if (videoDimensions.width === 0 || videoDimensions.height === 0) {
      return {}
    }

    // Get viewport dimensions (accounting for padding and controls)
    const viewportWidth = window.innerWidth // 16px padding on each side
    const viewportHeight = window.innerHeight // Account for controls and padding

    const videoAspectRatio = videoDimensions.width / videoDimensions.height
    const viewportAspectRatio = viewportWidth / viewportHeight

    let scale: number
    let width: number
    let height: number

    if (videoAspectRatio > viewportAspectRatio) {
      // Video is wider than viewport - scale to fit width (width will touch viewport boundary)
      scale = viewportWidth / videoDimensions.width
      width = viewportWidth
      height = videoDimensions.height * scale
      
      // If height exceeds viewport, scale down proportionally
      if (height > viewportHeight) {
        const heightScale = viewportHeight / height
        width = width * heightScale
        height = viewportHeight
      }
    } else {
      // Video is taller than viewport - scale to fit height (height will touch viewport boundary)
      scale = viewportHeight / videoDimensions.height
      width = videoDimensions.width * scale
      height = viewportHeight
      
      // If width exceeds viewport, scale down proportionally
      if (width > viewportWidth) {
        const widthScale = viewportWidth / width
        width = viewportWidth
        height = height * widthScale
      }
    }

    return {
      width: `${width*2}px`,
      height: `${height*2}px`,
      maxWidth: '100%',
      maxHeight: '100%',
      objectFit: 'contain' as const
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
      // Force re-render to recalculate optimal video scaling
      if (videoRef.current && videoDimensions.width > 0) {
        setViewportChangeKey(prev => prev + 1)
      }
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
  }, [videoDimensions.width])

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Get current video source based on selected quality
  const getCurrentVideoSource = () => {
    if (selectedQuality === 'auto' || !videoQualities || videoQualities.length === 0) {
      const url = getMediaUrlFromMedia(media, false)
      console.log("AUTO URL", url)
      return url
    }
    
    if (selectedQuality === 'original') {
      // For original, use the by_quality endpoint with original
      return `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/media/serve/by_quality/${media?.id}/original`
    }
    
    const selectedQualityData = videoQualities.find(q => q.quality === selectedQuality)
    return selectedQualityData?.url || getMediaUrlFromMedia(media, false)
  }

  // Handle video quality change
  const handleQualityChange = (quality: string) => {
    if (videoRef.current && videoDimensions.width > 0) {
      const currentTime = videoRef.current.currentTime
      const wasPlaying = !videoRef.current.paused
      
      // Find the new source for the selected quality
      let newSource: string
      if (quality === 'auto') {
        // For auto, use the main endpoint which will serve 540p by default
        newSource = getMediaUrlFromMedia(media, false)
      } else if (quality === 'original') {
        // For original, use the by_quality endpoint with original
        newSource = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/media/serve/by_quality/${media?.id}/original`
      } else {
        // For other qualities, use the quality-specific URL
        newSource = videoQualities?.find((q: VideoQuality) => q.quality === quality)?.url || getMediaUrlFromMedia(media, false)
      }
      
      // Update the video source
      if (newSource) {
        // Store the current state
        const savedTime = currentTime
        const savedPlaying = wasPlaying
        
        // Set up event listeners to restore state after loading
        const handleQualityChangeLoadedMetadata = () => {
          if (videoRef.current) {
            // Set the current time after the video has loaded its metadata
            videoRef.current.currentTime = savedTime
            
            // Resume playback if it was playing
            if (savedPlaying) {
              videoRef.current.play().catch(console.error)
            }
            
            // Remove the event listener
            videoRef.current.removeEventListener('loadedmetadata', handleQualityChangeLoadedMetadata)
          }
        }
        
        // Add the event listener before changing the source
        videoRef.current.addEventListener('loadedmetadata', handleQualityChangeLoadedMetadata)
        
        // Also add a fallback for canplay event in case loadedmetadata doesn't fire
        const handleCanPlay = () => {
          if (videoRef.current) {
            videoRef.current.currentTime = savedTime
            if (savedPlaying) {
              videoRef.current.play().catch(console.error)
            }
            videoRef.current.removeEventListener('canplay', handleCanPlay)
          }
        }
        videoRef.current.addEventListener('canplay', handleCanPlay)
        
        // Change the source
        videoRef.current.src = newSource
        
        // Add a timeout fallback in case events don't fire
        setTimeout(() => {
          if (videoRef.current && videoRef.current.readyState >= 1) {
            videoRef.current.currentTime = savedTime
            if (savedPlaying) {
              videoRef.current.play().catch(console.error)
            }
          }
        }, 1000)
      }
      
      setSelectedQuality(quality)
      setShowQualityMenu(false)
    }
  }

  // Zoom and pan handlers
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newZoom = Math.max(1.0, Math.min(10, zoom * delta))
    
    // Zoom towards the mouse cursor position instead of viewport center
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      // Get mouse position relative to the container
      const scaleFactor = newZoom / zoom

      // Adjust pan so that the point under the mouse stays in the same place
      setPan({
        x: pan.x * scaleFactor,
        y: pan.y * scaleFactor
      })
      setZoom(newZoom)
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      e.preventDefault()
      setIsDragging(true)
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault()
      setHasDragged(true)
      // work out if we are trying to drag the video away from the viewport
      // calculate current pan in terms of original viewport
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const originalViewport = {
        width: rect.width,
        height: rect.height
      }

      // calculate the new pan in terms of the new viewport
      let newXPan = e.clientX - dragStart.x
      if( newXPan/zoom < -originalViewport.width/2 ) {
        newXPan = -originalViewport.width/2*zoom
      }
      if( newXPan/zoom > (originalViewport.width*(zoom-0.5)/zoom) ) {
        newXPan = originalViewport.width*(zoom-0.5)
      }
      let newYPan = e.clientY - dragStart.y
      if( newYPan/zoom < -originalViewport.height/2 ) {
        newYPan = -originalViewport.height/2*zoom
      }
      if( newYPan/zoom > originalViewport.height*(zoom-0.5)/zoom ) {
        newYPan = originalViewport.height*(zoom-0.5)
      }
      setPan({ x: newXPan, y: newYPan })
    }
  }

  const handleMouseUp = (e?: React.MouseEvent) => {
    // Reset view if no drag occurred (just a click) - this provides easy way to reset zoom/pan
    if (!hasDragged) {
      resetView()
    }
    
    setIsDragging(false)
    setHasDragged(false)
    setDragStart({ x: 0, y: 0 })
  }

  const resetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
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
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        resetView()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, slideshow.hasNext, slideshow.hasPrev, slideshow.handleNext, slideshow.handlePrev, slideshow.toggleSlideshow, handleTogglePlay, handleFullscreen, handleToggleMute, isProcessing, resetView])

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


  const handleAuthorClick = (authorId: string, authorUsername: string | null) => {
    if (authorUsername) {
      router.push(`/user/${authorUsername}`)
    }
  }

  const togglePanel = () => {
    setIsPanelMinimized(!isPanelMinimized)
  }

  const handleDownload = async () => {
    try {
      const extension = getFileExtension('VIDEO', media.mimeType || null)
      const filename = generateDownloadFilename(media.originalFilename || null, 'VIDEO', extension)
      const mediaUrl = getMediaUrlFromMedia(media)
      await downloadFile(mediaUrl, filename)
    } catch (error) {
      console.error('Failed to download video:', error)
      // You could add a toast notification here if you have a toast system
    }
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



  return (
    <AnimatePresence>
      <motion.div
        key="video-detail-modal"
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
              key="close-button"
              onClick={handleClose}
              className="absolute top-4 left-4 z-10 p-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200"
              animate={{ opacity: controlsVisible ? 1 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <X className="h-5 w-5" />
            </motion.button>

            {/* Panel Toggle */}
            <motion.button
              key="panel-toggle"
              onClick={togglePanel}
              className="absolute top-4 right-4 z-20 p-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200"
              title={isPanelMinimized ? "Show Panel" : "Hide Panel"}
              animate={{ opacity: controlsVisible ? 1 : 0 }}
              transition={{ duration: 0.3 }}
            >
              {isPanelMinimized ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </motion.button>

            {/* Download Button */}
            <motion.button
              key="download-button"
              onClick={handleDownload}
              className="absolute top-4 right-20 z-20 p-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200"
              title="Download Video"
              animate={{ opacity: controlsVisible ? 1 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <Download className="h-5 w-5" />
            </motion.button>

            {/* Navigation Buttons */}
            {canNavigate && (
              <>
                {/* Previous Button */}
                <motion.button
                  key="prev-button"
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
                  key="next-button"
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
                  key="video-counter"
                  className="absolute bottom-20 left-4 z-10 px-3 py-1 bg-black bg-opacity-50 text-white text-sm rounded-full"
                  animate={{ opacity: controlsVisible ? 1 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {slideshow.currentIndex + 1} / {allMedia.length}
                </motion.div>

                {/* Slideshow Controls */}
                <motion.div 
                  key="slideshow-controls"
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
                <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                <h3 className="text-xl font-semibold mt-4 text-blue-600">
                  Video is being processed...
                </h3>
                <p className="text-gray-300 mt-2 text-sm">
                  This may take a few minutes depending on the video size.
                </p>
                <div className="mt-6 flex items-center space-x-2 text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Processing status: {processingStatus}</span>
                </div>

              </div>
            ) : (
              // Video player with optimal scaling to fit viewport while maximizing size
              <div className="w-full h-full flex items-center justify-center p-4 relative">
                <video
                  autoPlay={false}
                  muted={isMuted}
                  disablePictureInPicture={true}
                  key={`${media.id}-${viewportChangeKey}`}
                  ref={videoRef}
                  className={`${
                    isFullscreen 
                      ? 'w-full h-full' 
                      : 'w-auto h-auto max-w-full max-h-full object-contain'
                  }`}
                  style={{
                    ...(isFullscreen ? getFullscreenStyle() : getOptimalVideoStyle()),
                    // Ensure video maintains aspect ratio and fits within viewport
                    maxWidth: '100%',
                    maxHeight: '100%',
                    // Apply zoom and pan transforms
                    transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                    cursor: isVideoLoading ? 'wait' : (zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'),
                    transition: dragStart.x === 0 ? 'transform 0.2s ease-out' : 'none'
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
                  onWheel={handleWheel}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={() => {
                    if (isDragging) {
                      handleMouseUp()
                    }
                  }}
                >
                  Your browser does not support the video tag.
                </video>
                
                {/* Loading Overlay - Only show during manual navigation, not during slideshow */}
                {isVideoLoading && !slideshow.isSlideshowActive && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 pointer-events-none z-10">
                    <div className="bg-white bg-opacity-90 rounded-lg p-4 flex items-center space-x-3 shadow-lg">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="text-gray-700 font-medium">Loading video...</span>
                    </div>
                  </div>
                )}
                
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

                {/* Debug Info - Remove in production */}
                {process.env.NODE_ENV === 'development' && 0 && (
                  <div className="absolute top-20 left-4 bg-black bg-opacity-70 text-white text-xs p-2 rounded pointer-events-none">
                    <div>Video: {videoDimensions.width}x{videoDimensions.height}</div>
                    <div>Viewport: {screenDimensions.width}x{screenDimensions.height}</div>
                    <div>Scale: {getOptimalVideoStyle().width} x {getOptimalVideoStyle().height}</div>
                    <div>Video AR: {(videoDimensions.width / videoDimensions.height).toFixed(3)}</div>
                    <div>Viewport AR: {(screenDimensions.width / screenDimensions.height).toFixed(3)}</div>
                  </div>
                )}
              </div>
            )}

            {/* Video Controls Overlay */}
            {!isProcessing && (
              <motion.div
                key="video-controls-overlay"
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
                            {videoQualities.map((quality: VideoQuality) => (
                              <button
                                key={quality.quality}
                                onClick={() => handleQualityChange(quality.quality)}
                                className={`w-full text-left px-2 py-1 rounded hover:bg-white hover:bg-opacity-20 ${
                                  selectedQuality === quality.quality ? 'bg-white bg-opacity-20' : ''
                                }`}
                              >
                                {quality.quality}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reset View Button - only show when zoomed */}
                  {zoom > 1 && (
                    <button
                      onClick={resetView}
                      className="p-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200"
                      title="Reset View"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
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
          key="comments-panel"
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
            <MediaMetadataPanel
              ref={metadataPanelRef}
              media={freshMediaData || media}
              isOwner={isOwner}
              onMediaUpdate={onMediaUpdate}
              updateMedia={updateMedia}
              slideshow={{
                isSlideshowActive: slideshow.isSlideshowActive,
                currentSlideshowSpeed: slideshow.currentSlideshowSpeed,
                updateSlideshowSpeed: slideshow.updateSlideshowSpeed
              }}
              canNavigate={!!canNavigate}
              allMedia={allMedia}
              mediaType="VIDEO"
              processingStatus={processingStatus}
              duration={freshMediaData?.duration || media.duration}
              onUnsavedChangesChange={handleUnsavedChangesChange}
            />
          )}

        </motion.div>
      </motion.div>

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        isOpen={showUnsavedDialog}
        onSave={handleSaveChanges}
        onDiscard={handleDiscardChanges}
        onCancel={handleCancelAction}
        title="Unsaved Changes"
        message="You have unsaved changes to the media metadata. What would you like to do?"
      />

    </AnimatePresence>
  )
} 