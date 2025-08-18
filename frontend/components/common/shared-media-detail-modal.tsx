'use client'

import React from 'react'
import { ImageDetailModal } from '../dashboard/image-detail-modal'
import { VideoDetailModal } from '../dashboard/video-detail-modal'
import { useMediaDetail } from './media-detail-context'
import { Media } from '@/lib/types'

export function SharedMediaDetailModal() {
  const { isOpen, currentMedia, allMedia, closeMediaDetail, navigateToMedia } = useMediaDetail()
  
  if (!isOpen || !currentMedia) {
    return null
  }

  // Determine media type and render appropriate modal
  const mediaType = currentMedia.mediaType || 
                   (currentMedia.mimeType?.startsWith('video/') ? 'VIDEO' : 'IMAGE')

  const handleClose = () => {
    closeMediaDetail()
  }

  const handleMediaUpdate = () => {
    // Handle media updates if needed
  }

  const updateMedia = (mediaId: string, updates: Partial<any>) => {
    // Handle media updates if needed
  }

  const handleNavigate = (media: Media) => {
    navigateToMedia(media)
  }

  // Convert FlexibleMedia to Media for the specialized modals
  const mediaForModal = currentMedia as Media
  const allMediaForModal = allMedia as Media[]

  if (mediaType === 'VIDEO') {
    return (
      <VideoDetailModal
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
      media={mediaForModal}
      onClose={handleClose}
      onMediaUpdate={handleMediaUpdate}
      updateMedia={updateMedia}
      allMedia={allMediaForModal}
      onNavigate={handleNavigate}
    />
  )
}
