'use client'

import React, { useCallback } from 'react'
import { ImageDetailModal } from '../dashboard/image-detail-modal'
import { VideoDetailModal } from '../dashboard/video-detail-modal'
import { MobileImageDetail } from '../mobile/mobile-image-detail'
import { MobileVideoDetail } from '../mobile/mobile-video-detail'
import { useMediaDetail } from './media-detail-context'
import { useIsMobilePortrait } from '@/lib/hooks/use-mobile-detection'
import { Media } from '@/lib/types'

export function SharedMediaDetailModal() {
  // Call all hooks unconditionally at the top (Rules of Hooks)
  const { isOpen, currentMedia, allMedia, closeMediaDetail, navigateToMedia } = useMediaDetail()
  const isMobilePortrait = useIsMobilePortrait()
  
  // Define callbacks unconditionally (before early returns)
  const handleClose = useCallback(() => {
    closeMediaDetail()
  }, [closeMediaDetail])

  const handleMediaUpdate = useCallback(() => {
    // Handle media updates if needed
  }, [])

  const updateMedia = useCallback((mediaId: string, updates: Partial<any>) => {
    // Handle media updates if needed
  }, [])

  const handleNavigate = useCallback((media: Media) => {
    navigateToMedia(media)
  }, [navigateToMedia, allMedia])
  
  // Early return after all hooks are called
  if (!isOpen || !currentMedia) {
    return null
  }

  // Determine media type and render appropriate modal
  const mediaType = currentMedia.mediaType || 
                   (currentMedia.mimeType?.startsWith('video/') ? 'VIDEO' : 'IMAGE')

  // Convert FlexibleMedia to Media for the specialized modals
  const mediaForModal = currentMedia as Media
  const allMediaForModal = allMedia as Media[]

  // Create a key that changes when switching between mobile/desktop
  // This forces React to remount the component instead of reconciling hooks
  const viewerKey = `${isMobilePortrait ? 'mobile' : 'desktop'}-${mediaType}-${currentMedia.id}`

  // Use mobile components for portrait mode
  if (isMobilePortrait) {
    if (mediaType === 'VIDEO') {
      return (
        <MobileVideoDetail
          key={viewerKey}
          media={mediaForModal}
          onClose={handleClose}
          onMediaUpdate={handleMediaUpdate}
          updateMedia={updateMedia}
          allMedia={allMediaForModal}
          onNavigate={handleNavigate}
        />
      )
    }
    
    return (
      <MobileImageDetail
        key={viewerKey}
        media={mediaForModal}
        onClose={handleClose}
        onMediaUpdate={handleMediaUpdate}
        updateMedia={updateMedia}
        allMedia={allMediaForModal}
        onNavigate={handleNavigate}
      />
    )
  }

  // Use desktop components for landscape/desktop
  if (mediaType === 'VIDEO') {
    return (
      <VideoDetailModal
        key={viewerKey}
        media={mediaForModal}
        onClose={handleClose}
        onMediaUpdate={handleMediaUpdate}
        updateMedia={updateMedia}
        allMedia={allMediaForModal}
        onNavigate={handleNavigate}
      />
    )
  }

  // Default to image modal for IMAGE type or unknown types
  return (
    <ImageDetailModal
      key={viewerKey}
      media={mediaForModal}
      onClose={handleClose}
      onMediaUpdate={handleMediaUpdate}
      updateMedia={updateMedia}
      allMedia={allMediaForModal}
      onNavigate={handleNavigate}
    />
  )
}
