'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, Share2, Download, MoreVertical, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth, useVideoQualities, VideoQuality } from '@/lib/api-hooks'
import { getMediaUrlFromMedia, fetchFreshMediaData } from '@/lib/api'
import { Media } from '@/lib/types'
import { mapMediaData } from '@/lib/media-utils'
import { MediaMetadataPanel, MediaMetadataPanelRef } from '@/components/common/media-metadata-panel'
import { UnsavedChangesDialog } from '@/components/common/unsaved-changes-dialog'
import { downloadFile, generateDownloadFilename, getFileExtension } from '@/lib/download-utils'

interface MobileVideoDetailProps {
  media: Media | null
  onClose: () => void
  onMediaUpdate?: () => void
  updateMedia?: (mediaId: string, updates: Partial<any>) => void
  allMedia?: Media[]
  onNavigate?: (media: Media) => void
}

export function MobileVideoDetail({ 
  media, 
  onClose, 
  onMediaUpdate, 
  updateMedia,
  allMedia,
  onNavigate 
}: MobileVideoDetailProps) {
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
  const videoRef = useRef<HTMLVideoElement>(null)
  const metadataPanelRef = useRef<MediaMetadataPanelRef>(null)
  
  // Video player state
  const [duration, setDuration] = useState(0)
  
  // Unsaved changes state
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  
  const { data: authData } = useAuth()
  
  // Check if current user is the media owner
  const isOwner = authData?.data?.user?.id === media.authorId

  // Video quality functionality
  const { data: videoQualities, isLoading: qualitiesLoading } = useVideoQualities(media.id)
  const [selectedQuality, setSelectedQuality] = useState<string>('auto')

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
        
        if (pendingAction) {
          pendingAction()
        }
      } catch (error) {
        console.error('Failed to save changes:', error)
      }
    }
  }

  const handleDiscardChanges = () => {
    if (metadataPanelRef.current) {
      metadataPanelRef.current.discardUnsavedChanges()
    }
    setShowUnsavedDialog(false)
    setPendingAction(null)
    
    if (pendingAction) {
      pendingAction()
    }
  }

  const handleCancelAction = () => {
    setShowUnsavedDialog(false)
    setPendingAction(null)
  }

  const handleClose = useCallback(() => {
    checkUnsavedChanges(() => {
      onClose()
    })
  }, [onClose, hasUnsavedChanges])

  const handleDownload = async () => {
    try {
      const extension = getFileExtension('VIDEO', media.mimeType || null)
      const filename = generateDownloadFilename(media.originalFilename || null, 'VIDEO', extension)
      const mediaUrl = getMediaUrlFromMedia(media)
      await downloadFile(mediaUrl, filename)
    } catch (error) {
      console.error('Failed to download video:', error)
    }
  }

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: media.originalFilename || 'Video',
        url: window.location.href
      }).catch(err => console.log('Error sharing:', err))
    } else {
      navigator.clipboard.writeText(window.location.href)
      alert('Link copied to clipboard!')
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
    }
  }

  // Get current video source based on selected quality
  const getCurrentVideoSource = () => {
    if (selectedQuality === 'auto' || !videoQualities || videoQualities.length === 0) {
      return getMediaUrlFromMedia(media, false)
    }
    
    if (selectedQuality === 'original') {
      return `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/media/serve/by_quality/${media?.id}/original`
    }
    
    const selectedQualityData = videoQualities.find(q => q.quality === selectedQuality)
    return selectedQualityData?.url || getMediaUrlFromMedia(media, false)
  }

  // Check if video is still processing
  const isProcessing = media.processingStatus !== 'COMPLETED'
  const processingStatus = media.processingStatus || 'PENDING'

  const mappedMedia = mapMediaData(media)

  return (
    <AnimatePresence>
      <motion.div
        key="mobile-video-detail"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col bg-white"
        style={{ height: '100vh', height: '100dvh' }}
      >
        {/* Header - Fixed at top, 56px height */}
        <header className="fixed top-0 left-0 right-0 h-14 bg-black bg-opacity-70 backdrop-blur-lg z-50 flex items-center px-4 gap-2">
          <button
            onClick={handleClose}
            className="w-10 h-10 flex items-center justify-center text-white rounded-full hover:bg-white hover:bg-opacity-10 active:bg-opacity-20 transition-colors"
            aria-label="Close"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          
          <h1 className="flex-1 text-white text-base font-medium truncate px-2">
            {media.originalFilename || 'Video'}
          </h1>
          
          <div className="flex gap-2">
            <button
              onClick={handleShare}
              className="w-10 h-10 flex items-center justify-center text-white rounded-full hover:bg-white hover:bg-opacity-10 active:bg-opacity-20 transition-colors"
              aria-label="Share"
            >
              <Share2 className="h-5 w-5" />
            </button>
            
            <button
              onClick={handleDownload}
              className="w-10 h-10 flex items-center justify-center text-white rounded-full hover:bg-white hover:bg-opacity-10 active:bg-opacity-20 transition-colors"
              aria-label="Download"
            >
              <Download className="h-5 w-5" />
            </button>
            
            <button
              onClick={() => {/* TODO: Show more options menu */}}
              className="w-10 h-10 flex items-center justify-center text-white rounded-full hover:bg-white hover:bg-opacity-10 active:bg-opacity-20 transition-colors"
              aria-label="More options"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Main Content - Scrollable */}
        <div className="flex-1 overflow-y-auto pt-14">
          {/* Video Container - Full width, max 60vh */}
          <div 
            className="w-full bg-black flex items-center justify-center relative"
            style={{ maxHeight: '60vh' }}
          >
            {isProcessing ? (
              // Processing overlay
              <div className="flex flex-col items-center justify-center p-8 bg-black bg-opacity-75 text-center" style={{ minHeight: '60vh' }}>
                <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-4" />
                <h3 className="text-xl font-semibold text-blue-600 mb-2">
                  Video is being processed...
                </h3>
                <p className="text-gray-300 text-sm">
                  This may take a few minutes depending on the video size.
                </p>
                <div className="mt-6 flex items-center space-x-2 text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Processing status: {processingStatus}</span>
                </div>
              </div>
            ) : (
              // Video player
              <video
                ref={videoRef}
                className="w-full h-auto object-contain"
                style={{ maxHeight: '60vh' }}
                controls
                controlsList="nodownload"
                playsInline
                src={getCurrentVideoSource()}
                onLoadedMetadata={handleLoadedMetadata}
              >
                Your browser does not support the video tag.
              </video>
            )}
          </div>

          {/* Metadata Panel - Reusing existing component */}
          <div className="bg-white">
            <MediaMetadataPanel
              ref={metadataPanelRef}
              media={freshMediaData || media}
              isOwner={isOwner}
              onMediaUpdate={onMediaUpdate}
              updateMedia={updateMedia}
              slideshow={{
                isSlideshowActive: false,
                currentSlideshowSpeed: 3000,
                updateSlideshowSpeed: () => {}
              }}
              canNavigate={false}
              allMedia={allMedia}
              mediaType="VIDEO"
              processingStatus={processingStatus}
              duration={freshMediaData?.duration || media.duration}
              onUnsavedChangesChange={handleUnsavedChangesChange}
            />
          </div>
        </div>

        {/* Unsaved Changes Dialog */}
        <UnsavedChangesDialog
          isOpen={showUnsavedDialog}
          onSave={handleSaveChanges}
          onDiscard={handleDiscardChanges}
          onCancel={handleCancelAction}
          title="Unsaved Changes"
          message="You have unsaved changes to the media metadata. What would you like to do?"
        />
      </motion.div>
    </AnimatePresence>
  )
}

