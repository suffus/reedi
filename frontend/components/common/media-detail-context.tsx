'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'
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
  videoUrl?: string
  isLocked?: boolean
  s3Key?: string
  thumbnailS3Key?: string
  processingStatus?: string
  size?: number
  visibility?: string
}

interface MediaDetailContextType {
  openMediaDetail: (media: Media | FlexibleMedia, allMedia?: (Media | FlexibleMedia)[]) => void
  closeMediaDetail: () => void
  navigateToMedia: (media: Media | FlexibleMedia) => void
  updateMediaInContext: (mediaId: string, updates: Partial<Media | FlexibleMedia>) => void
  isOpen: boolean
  currentMedia: Media | FlexibleMedia | null
  allMedia: (Media | FlexibleMedia)[]
}

const MediaDetailContext = createContext<MediaDetailContextType | undefined>(undefined)

export function MediaDetailProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMedia, setCurrentMedia] = useState<Media | FlexibleMedia | null>(null)
  const [allMedia, setAllMedia] = useState<(Media | FlexibleMedia)[]>([])

  const openMediaDetail = (media: Media | FlexibleMedia, mediaArray?: (Media | FlexibleMedia)[]) => {
    setCurrentMedia(media)
    setAllMedia(mediaArray || [media])
    setIsOpen(true)
  }

  const closeMediaDetail = () => {
    setIsOpen(false)
    setCurrentMedia(null)
    setAllMedia([])
  }

  const navigateToMedia = (media: Media | FlexibleMedia) => {
    setCurrentMedia(media)
  }

  const updateMediaInContext = (mediaId: string, updates: Partial<Media | FlexibleMedia>) => {
    setAllMedia(prevAllMedia => 
      prevAllMedia.map(media => 
        media.id === mediaId ? { ...media, ...updates } : media
      )
    )
    
    // Also update currentMedia if it's the one being updated
    setCurrentMedia(prevCurrentMedia => 
      prevCurrentMedia?.id === mediaId ? { ...prevCurrentMedia, ...updates } : prevCurrentMedia
    )
  }

  return (
    <MediaDetailContext.Provider
      value={{
        openMediaDetail,
        closeMediaDetail,
        navigateToMedia,
        updateMediaInContext,
        isOpen,
        currentMedia,
        allMedia
      }}
    >
      {children}
    </MediaDetailContext.Provider>
  )
}

export function useMediaDetail() {
  const context = useContext(MediaDetailContext)
  if (context === undefined) {
    throw new Error('useMediaDetail must be used within a MediaDetailProvider')
  }
  return context
} 