import React from 'react'
import { ImageDetailModal } from './image-detail-modal'
import { ImageDetailModalWithEventCatcher } from './image-detail-modal-with-event-catcher'
import { VideoDetailModal } from './video-detail-modal'
import { Media } from '@/lib/types'

interface MediaDetailModalProps {
  media: Media | null
  onClose: () => void
  onMediaUpdate?: () => void
  updateMedia?: (mediaId: string, updates: Partial<any>) => void
  // Navigation props
  allMedia?: Media[]
  onNavigate?: (media: Media) => void
}

export function MediaDetailModal({ media, onClose, onMediaUpdate, updateMedia, allMedia, onNavigate }: MediaDetailModalProps) {
  // Return early if no media
  if (!media) {
    return null
  }

  // Route to appropriate modal based on media type
  if (media.mediaType === 'IMAGE') {
    return (
      <ImageDetailModal
        media={media}
        onClose={onClose}
        onMediaUpdate={onMediaUpdate}
        updateMedia={updateMedia}
        allMedia={allMedia}
        onNavigate={onNavigate}
      />
    )
  }

  if (media.mediaType === 'VIDEO') {
    return (
      <VideoDetailModal
        media={media}
        onClose={onClose}
        onMediaUpdate={onMediaUpdate}
        updateMedia={updateMedia}
        allMedia={allMedia}
        onNavigate={onNavigate}
      />
    )
  }

  // Fallback for unknown media types
  return null
} 