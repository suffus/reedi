'use client'

import React from 'react'
import { LazyMedia } from '../lazy-media'
import { getMediaUrlFromMedia } from '@/lib/api'
import { useMediaDetail } from './media-detail-context'
import { Media } from '@/lib/types'

// Flexible media type for messages and other contexts
interface FlexibleMedia {
  id: string
  url?: string
  thumbnail?: string
  mimeType?: string
  originalFilename?: string
  mediaType?: 'IMAGE' | 'VIDEO'
  altText?: string
  caption?: string
  width?: number
  height?: number
  tags?: string[]
  authorId?: string
  createdAt?: string
  updatedAt?: string
}

interface MediaDisplayProps {
  media: Array<Media | FlexibleMedia>
  onMediaClick?: (media: Media | FlexibleMedia, allMedia?: (Media | FlexibleMedia)[]) => void
  maxWidth?: string
  className?: string
}

export function MediaDisplay({ media, onMediaClick, maxWidth = 'max-w-md', className = '' }: MediaDisplayProps) {
  if (!media || media.length === 0) return null

  const { openMediaDetail } = useMediaDetail()

  const handleMediaClick = (mediaItem: Media | FlexibleMedia) => {
    if (onMediaClick) {
      onMediaClick(mediaItem, media)
    } else {
      // Default behavior: open in shared media detail modal
      openMediaDetail(mediaItem, media)
    }
  }

  if (media.length === 1) {
    const mediaItem = media[0]
    const isVideo = mediaItem.mediaType === 'VIDEO' || mediaItem.mimeType?.startsWith('video/')
    
    return (
      <div className={`${maxWidth} ${className}`}>
        <div className="relative group">
          <LazyMedia
            src={mediaItem.url || mediaItem.thumbnail || ''}
            alt={mediaItem.originalFilename || 'Media'}
            className="w-full rounded-lg object-contain cursor-pointer hover:opacity-90 transition-opacity"
            style={{
              height: 'auto',
              maxHeight: '400px'
            }}
            onClick={() => handleMediaClick(mediaItem)}
            mediaType={isVideo ? 'VIDEO' : 'IMAGE'}
          />
        </div>
      </div>
    )
  }

  if (media.length === 2) {
    return (
      <div className={`${maxWidth} ${className}`}>
        <div className="grid grid-cols-2 gap-2">
          {media.map((mediaItem, index) => {
            const isVideo = mediaItem.mediaType === 'VIDEO' || mediaItem.mimeType?.startsWith('video/')
            
            return (
              <div key={mediaItem.id} className="relative group">
                <LazyMedia
                  src={mediaItem.url || mediaItem.thumbnail || ''}
                  alt={mediaItem.originalFilename || `Media ${index + 1}`}
                  className="w-full rounded-lg object-contain cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ aspectRatio: mediaItem.width && mediaItem.height ? `${mediaItem.width} / ${mediaItem.height}` : undefined }}
                  onClick={() => handleMediaClick(mediaItem)}
                  mediaType={isVideo ? 'VIDEO' : 'IMAGE'}
                />
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (media.length === 3) {
    return (
      <div className={`${maxWidth} ${className}`}>
        <div className="grid grid-cols-3 gap-2">
          {media.map((mediaItem, index) => {
            const isVideo = mediaItem.mediaType === 'VIDEO' || mediaItem.mimeType?.startsWith('video/')
            
            return (
              <div key={mediaItem.id} className="relative group">
                <LazyMedia
                  src={mediaItem.url || mediaItem.thumbnail || ''}
                  alt={mediaItem.originalFilename || `Media ${index + 1}`}
                  className="w-full rounded-lg object-contain cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ aspectRatio: mediaItem.width && mediaItem.height ? `${mediaItem.width} / ${mediaItem.height}` : undefined }}
                  onClick={() => handleMediaClick(mediaItem)}
                  mediaType={isVideo ? 'VIDEO' : 'IMAGE'}
                />
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // 4+ media items: Main image + thumbnails layout
  const [main, ...thumbs] = media
  const isMainVideo = main.mediaType === 'VIDEO' || main.mimeType?.startsWith('video/')
  
  return (
    <div className={`${maxWidth} ${className}`}>
      <div className="space-y-2">
        {/* Main media */}
        <div className="relative group">
          <LazyMedia
            src={main.url || main.thumbnail || ''}
            alt={main.originalFilename || 'Main media'}
            className="w-full rounded-lg object-contain cursor-pointer hover:opacity-90 transition-opacity"
            style={{ aspectRatio: main.width && main.height ? `${main.width} / ${main.height}` : undefined }}
            onClick={() => handleMediaClick(main)}
            mediaType={isMainVideo ? 'VIDEO' : 'IMAGE'}
          />
        </div>
        
        {/* Thumbnails */}
        {thumbs.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {thumbs.map((mediaItem, index) => {
              const isVideo = mediaItem.mediaType === 'VIDEO' || mediaItem.mimeType?.startsWith('video/')
              
              return (
                <div key={mediaItem.id} className="relative group">
                  <LazyMedia
                    src={mediaItem.url || mediaItem.thumbnail || ''}
                    alt={mediaItem.originalFilename || `Media ${index + 2}`}
                    className="w-full rounded-lg object-contain cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ aspectRatio: '1/1' }}
                    onClick={() => handleMediaClick(mediaItem)}
                    mediaType={isVideo ? 'VIDEO' : 'IMAGE'}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
} 