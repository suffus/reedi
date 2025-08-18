'use client'

import React, { useState, useEffect } from 'react'
import { Lock } from 'lucide-react'
import { LazyMedia } from '../lazy-media'
import { getMediaUrlFromMedia } from '@/lib/api'
import { getBestThumbnailUrl, getSmartMediaUrl } from '@/lib/media-utils'
import { getVideoUrlWithQuality } from '@/lib/api'
import { useMediaDetail } from './media-detail-context'
import { Media } from '@/lib/types'

const getBestMediaUrl = (mediaItem: any, useThumbnail: boolean = false) => {
  // For locked media without ID, return empty string to show placeholder
  if (mediaItem.isLocked && !mediaItem.id) {
    return ''
  }
  
  if (useThumbnail) {
    // For thumbnails, use the smart thumbnail URL
    return getSmartMediaUrl(mediaItem, 'thumbnail')
  }
  
  // For main images, use 1080p quality
  return getSmartMediaUrl(mediaItem, 'main')
}

const getVideoUrl = (mediaItem: any) => {
  // Return the video URL for video playback
  return mediaItem.videoUrl || getMediaUrlFromMedia(mediaItem, false)
}

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
  videoUrl?: string
  isLocked?: boolean
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
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({})

  // Effect to load video URLs with preferred quality
  useEffect(() => {
    const loadVideoUrls = async () => {
      const newVideoUrls: Record<string, string> = {}
      
      for (const mediaItem of media) {
        // Skip locked media without IDs
        if (mediaItem.mediaType === 'VIDEO' && mediaItem.id && !videoUrls[mediaItem.id] && !(mediaItem as any).isLocked) {
          try {
            const qualityUrl = await getVideoUrlWithQuality(mediaItem.id, '540p')
            newVideoUrls[mediaItem.id] = qualityUrl
          } catch (error) {
            console.error('Error getting video quality URL:', error)
            // Fallback to regular URL
            newVideoUrls[mediaItem.id] = mediaItem.videoUrl || getMediaUrlFromMedia(mediaItem, false)
          }
        }
      }
      
      if (Object.keys(newVideoUrls).length > 0) {
        setVideoUrls(prev => ({ ...prev, ...newVideoUrls }))
      }
    }

    loadVideoUrls()
  }, [media])

  const getCachedVideoUrl = (mediaItem: any) => {
    if (typeof mediaItem === 'string') {
      return null
    }
    
    // Return cached quality URL if available, otherwise fallback
    return videoUrls[mediaItem.id] || mediaItem.videoUrl || getMediaUrlFromMedia(mediaItem, false)
  }

  const handleMediaClick = (mediaItem: Media | FlexibleMedia) => {
    if (onMediaClick) {
      onMediaClick(mediaItem, media)
    } else {
      // Default behavior: open in shared media detail modal
      
      // Ensure media has the right structure for the modal
      const mediaForModal = {
        ...mediaItem,
        mediaType: mediaItem.mediaType || (mediaItem.mimeType?.startsWith('video/') ? 'VIDEO' : 'IMAGE')
      }
      
      openMediaDetail(mediaForModal, media)
    }
  }

  if (media.length === 1) {
    const mediaItem = media[0]
    const isVideo = mediaItem.mediaType === 'VIDEO' || mediaItem.mimeType?.startsWith('video/')
    const mediaUrl = getBestMediaUrl(mediaItem, isVideo)
    const videoUrl = getCachedVideoUrl(mediaItem)
    
    return (
      <div className={`${maxWidth} ${className}`}>
        <div className="relative group">
          {mediaUrl ? (
            <LazyMedia
              src={mediaUrl}
              alt={mediaItem.originalFilename || 'Media'}
              className="w-full rounded-lg object-contain cursor-pointer hover:opacity-90 transition-opacity"
              style={{
                height: 'auto',
                maxHeight: '400px'
              }}
              onClick={() => handleMediaClick(mediaItem)}
              mediaType={isVideo ? 'VIDEO' : 'IMAGE'}
              isMainMedia={true}
              videoUrl={videoUrl}
              showVideoControls={isVideo}
              showPlayButton={isVideo}
            />
          ) : (
            // Locked media placeholder
            <div className="w-full bg-gray-100 rounded-lg aspect-video flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors">
              <div className="text-center">
                <Lock className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Locked Content</p>
              </div>
            </div>
          )}
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
            const mediaUrl = getBestMediaUrl(mediaItem, isVideo)
            const videoUrl = getCachedVideoUrl(mediaItem)
            
            return (
              <div key={mediaItem.id || `media-${index}`} className="relative group">
                {mediaUrl ? (
                  <LazyMedia
                    src={mediaUrl}
                    alt={mediaItem.originalFilename || `Media ${index + 1}`}
                    className="w-full rounded-lg object-contain cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ aspectRatio: mediaItem.width && mediaItem.height ? `${mediaItem.width} / ${mediaItem.height}` : undefined }}
                    onClick={() => handleMediaClick(mediaItem)}
                    mediaType={isVideo ? 'VIDEO' : 'IMAGE'}
                    isMainMedia={index === 0} // First item is main media
                    videoUrl={videoUrl}
                    showVideoControls={isVideo && index === 0} // Only show controls for main video
                    showPlayButton={isVideo}
                  />
                ) : (
                  // Locked media placeholder
                  <div className="w-full bg-gray-100 rounded-lg aspect-square flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors">
                    <div className="text-center">
                      <Lock className="h-8 w-8 text-gray-400 mx-auto mb-1" />
                      <p className="text-xs text-gray-500">Locked</p>
                    </div>
                  </div>
                )}
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
            const mediaUrl = getBestMediaUrl(mediaItem, isVideo)
            const videoUrl = getCachedVideoUrl(mediaItem)
            
            return (
              <div key={mediaItem.id || `media-${index}`} className="relative group">
                {mediaUrl ? (
                  <LazyMedia
                    src={mediaUrl}
                    alt={mediaItem.originalFilename || `Media ${index + 1}`}
                    className="w-full rounded-lg object-contain cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ aspectRatio: mediaItem.width && mediaItem.height ? `${mediaItem.width} / ${mediaItem.height}` : undefined }}
                    onClick={() => handleMediaClick(mediaItem)}
                    mediaType={isVideo ? 'VIDEO' : 'IMAGE'}
                    isMainMedia={index === 0} // First item is main media
                    videoUrl={videoUrl}
                    showVideoControls={isVideo && index === 0} // Only show controls for main video
                    showPlayButton={isVideo}
                  />
                ) : (
                  // Locked media placeholder
                  <div className="w-full bg-gray-100 rounded-lg aspect-square flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors">
                    <div className="text-center">
                      <Lock className="h-8 w-8 text-gray-400 mx-auto mb-1" />
                      <p className="text-xs text-gray-500">Locked</p>
                    </div>
                  </div>
                )}
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
  const mainMediaUrl = getBestMediaUrl(main, isMainVideo)
  const mainVideoUrl = getCachedVideoUrl(main)
  
  return (
    <div className={`${maxWidth} ${className}`}>
      <div className="space-y-2">
        {/* Main media */}
        <div className="relative group">
          {mainMediaUrl ? (
            <LazyMedia
              src={mainMediaUrl}
              alt={main.originalFilename || 'Main media'}
              className="w-full rounded-lg object-contain cursor-pointer hover:opacity-90 transition-opacity"
              style={{ aspectRatio: main.width && main.height ? `${main.width} / ${main.height}` : undefined }}
              onClick={() => handleMediaClick(main)}
              mediaType={isMainVideo ? 'VIDEO' : 'IMAGE'}
              isMainMedia={true}
              videoUrl={mainVideoUrl}
              showVideoControls={isMainVideo}
              showPlayButton={isMainVideo}
            />
          ) : (
            // Locked media placeholder
            <div className="w-full bg-gray-100 rounded-lg aspect-video flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors">
              <div className="text-center">
                <Lock className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Locked Content</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Thumbnails */}
        {thumbs.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {thumbs.map((mediaItem, index) => {
              const isVideo = mediaItem.mediaType === 'VIDEO' || mediaItem.mimeType?.startsWith('video/')
              const mediaUrl = getBestMediaUrl(mediaItem, isVideo)
              const videoUrl = getCachedVideoUrl(mediaItem)
              
              return (
                <div key={mediaItem.id || `media-${index + 1}`} className="relative group">
                  {mediaUrl ? (
                    <LazyMedia
                      src={mediaUrl}
                      alt={mediaItem.originalFilename || `Media ${index + 2}`}
                      className="w-full rounded-lg object-contain cursor-pointer hover:opacity-90 transition-opacity"
                      style={{ aspectRatio: '1/1' }}
                      onClick={() => handleMediaClick(mediaItem)}
                      mediaType={isVideo ? 'VIDEO' : 'IMAGE'}
                      videoUrl={videoUrl}
                      showPlayButton={isVideo}
                    />
                  ) : (
                    // Locked media placeholder
                    <div className="w-full bg-gray-100 rounded-lg aspect-square flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors">
                      <div className="text-center">
                        <Lock className="h-6 w-6 text-gray-400 mx-auto mb-1" />
                        <p className="text-xs text-gray-500">Locked</p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
} 