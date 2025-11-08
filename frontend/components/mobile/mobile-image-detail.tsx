'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, Share2, Download, MoreVertical } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/api-hooks'
import { getSmartMediaUrl } from '@/lib/media-utils'
import { fetchFreshMediaData } from '@/lib/api'
import { Media } from '@/lib/types'
import { mapMediaData } from '@/lib/media-utils'
import { MediaMetadataPanel, MediaMetadataPanelRef } from '@/components/common/media-metadata-panel'
import { UnsavedChangesDialog } from '@/components/common/unsaved-changes-dialog'
import { downloadFile, generateDownloadFilename, getFileExtension } from '@/lib/download-utils'

interface MobileImageDetailProps {
  media: Media | null
  onClose: () => void
  onMediaUpdate?: () => void
  updateMedia?: (mediaId: string, updates: Partial<any>) => void
  allMedia?: Media[]
  onNavigate?: (media: Media) => void
}

export function MobileImageDetail({ 
  media, 
  onClose, 
  onMediaUpdate, 
  updateMedia,
  allMedia,
  onNavigate 
}: MobileImageDetailProps) {
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

  // Return early if no media or if it's not an image
  if (!media || media.mediaType !== 'IMAGE') {
    return null
  }

  const router = useRouter()
  const metadataPanelRef = useRef<MediaMetadataPanelRef>(null)
  
  // Unsaved changes state
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  
  const { data: authData } = useAuth()
  
  // Check if current user is the media owner
  const isOwner = authData?.data?.user?.id === media.authorId

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
      const extension = getFileExtension('IMAGE', media.mimeType || null)
      const filename = generateDownloadFilename(media.originalFilename || null, 'IMAGE', extension)
      const mediaUrl = getSmartMediaUrl(media, 'detail')
      await downloadFile(mediaUrl, filename)
    } catch (error) {
      console.error('Failed to download image:', error)
    }
  }

  const handleShare = () => {
    // TODO: Implement share functionality
    if (navigator.share) {
      navigator.share({
        title: media.originalFilename || 'Image',
        url: window.location.href
      }).catch(err => console.log('Error sharing:', err))
    } else {
      // Fallback: copy link to clipboard
      navigator.clipboard.writeText(window.location.href)
      alert('Link copied to clipboard!')
    }
  }

  const mappedMedia = mapMediaData(media)

  return (
    <AnimatePresence>
      <motion.div
        key="mobile-image-detail"
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
            {media.originalFilename || 'Image'}
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
          {/* Media Container - Full width, max 60vh */}
          <div 
            className="w-full bg-black flex items-center justify-center relative"
            style={{ maxHeight: '60vh' }}
          >
            <img
              src={getSmartMediaUrl(media, 'detail')}
              alt={mappedMedia.altText || 'Gallery image'}
              className="w-full h-auto object-contain"
              style={{ maxHeight: '60vh' }}
            />
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
              mediaType="IMAGE"
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

