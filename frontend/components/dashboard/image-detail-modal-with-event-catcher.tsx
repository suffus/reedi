import React from 'react'
import { ImageDetailModal } from './image-detail-modal'
import { ModalEventCatcher } from '@/components/common/modal-event-catcher'
import { Media } from '@/lib/types'

interface ImageDetailModalWithEventCatcherProps {
  media: Media | null
  onClose: () => void
  onMediaUpdate?: () => void
  updateMedia?: (mediaId: string, updates: Partial<any>) => void
  allMedia?: Media[]
  onNavigate?: (media: Media) => void
}

export function ImageDetailModalWithEventCatcher(props: ImageDetailModalWithEventCatcherProps) {
  const { media, onClose, ...restProps } = props

  // Don't render anything if no media
  if (!media) {
    return null
  }

  return (
    <ModalEventCatcher
      onEscape={onClose}
      onBackdropClick={onClose}
      allowScroll={false} // Prevent wheel events from propagating to background
      allowKeys={[
        'ArrowLeft', 'ArrowRight', // Allow navigation keys
        'Space', ' ', // Allow space for slideshow
        'Escape' // Allow escape (handled by onEscape)
      ]}
      className="bg-black/80" // Darker backdrop for image viewing
    >
      <ImageDetailModal
        media={media}
        onClose={onClose}
        {...restProps}
      />
    </ModalEventCatcher>
  )
}

// Alternative: Higher-order component approach
export const withImageDetailEventCatcher = (Component: typeof ImageDetailModal) => {
  return function WrappedImageDetailModal(props: ImageDetailModalWithEventCatcherProps) {
    const { media, onClose, ...restProps } = props

    if (!media) {
      return null
    }

    return (
      <ModalEventCatcher
        onEscape={onClose}
        onBackdropClick={onClose}
        allowScroll={true}
        allowKeys={['ArrowLeft', 'ArrowRight', 'Space', ' ', 'Escape']}
        className="bg-black/80"
      >
        <Component
          media={media}
          onClose={onClose}
          {...restProps}
        />
      </ModalEventCatcher>
    )
  }
} 