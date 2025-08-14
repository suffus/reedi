'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Image as ImageIcon, Send, ArrowUp, ArrowDown, Trash2, Lock, Unlock } from 'lucide-react'
import { MediaPicker } from './media-picker'
import { useAuth } from '@/lib/api-hooks'
import { getMediaUrlFromMedia } from '@/lib/api'
import { LazyMedia } from '../lazy-media'

interface PostComposerProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (content: string, mediaIds: string[], isLocked?: boolean, unlockPrice?: number, lockedMediaIds?: string[]) => void
  mode: 'post' | 'message'
  title?: string
  placeholder?: string
  maxLength?: number
  maxMedia?: number
  initialContent?: string
  initialMediaIds?: string[]
  allowLockedPosts?: boolean
}

interface ComposerMedia {
  id: string
  url: string
  thumbnail: string
  altText?: string
  caption?: string
  mediaType: 'IMAGE' | 'VIDEO'
  width?: number
  height?: number
}

export function PostComposer({
  isOpen,
  onClose,
  onSubmit,
  mode,
  title = mode === 'post' ? 'Create Post' : 'Send Message',
  placeholder = mode === 'post' ? 'What\'s on your mind?' : 'Type a message...',
  maxLength = 1000,
  maxMedia = 8,
  initialContent = '',
  initialMediaIds = [],
  allowLockedPosts = true
}: PostComposerProps) {
  const { data: authData } = useAuth()
  const [content, setContent] = useState(initialContent)
  const [selectedMedia, setSelectedMedia] = useState<ComposerMedia[]>([])
  const [showMediaPicker, setShowMediaPicker] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [unlockPrice, setUnlockPrice] = useState<number>(0)
  const [lockedMediaIds, setLockedMediaIds] = useState<string[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [content])

  // Initialize with initial media if provided
  useEffect(() => {
    if (initialMediaIds.length > 0 && selectedMedia.length === 0) {
      // This would need to be populated from the backend
      // For now, we'll handle this when the component is used
    }
  }, [initialMediaIds, selectedMedia.length])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!content.trim() && selectedMedia.length === 0)) return

    // Validate locked post requirements
    if (isLocked) {
      if (!unlockPrice || unlockPrice <= 0) {
        alert('Please set a valid unlock price for locked posts')
        return
      }
      if (lockedMediaIds.length === 0) {
        alert('Locked posts must have at least one locked media item')
        return
      }
    }

    setIsSubmitting(true)
    try {
      const mediaIds = selectedMedia.map(media => media.id)
      await onSubmit(content.trim(), mediaIds, isLocked, unlockPrice, lockedMediaIds)
      
      // Reset form
      setContent('')
      setSelectedMedia([])
      setIsLocked(false)
      setUnlockPrice(0)
      setLockedMediaIds([])
      onClose()
    } catch (error) {
      console.error('Failed to submit:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleMediaSelect = (media: any[]) => {
    const composerMedia: ComposerMedia[] = media.map(m => ({
      id: m.id,
      url: getMediaUrlFromMedia(m, false),
      thumbnail: getMediaUrlFromMedia(m, true),
      altText: m.altText,
      caption: m.caption,
      mediaType: m.mediaType || 'IMAGE',
      width: m.width,
      height: m.height
    }))
    
    setSelectedMedia(prev => {
      const newMedia = [...prev, ...composerMedia]
      return newMedia.slice(0, maxMedia) // Respect max media limit
    })
    setShowMediaPicker(false)
  }

  const removeMedia = (index: number) => {
    setSelectedMedia(prev => prev.filter((_, i) => i !== index))
  }

  const reorderMedia = (fromIndex: number, toIndex: number) => {
    setSelectedMedia(prev => {
      const newMedia = [...prev]
      const [removed] = newMedia.splice(fromIndex, 1)
      newMedia.splice(toIndex, 0, removed)
      return newMedia
    })
  }

  const canSubmit = content.trim().length > 0 || selectedMedia.length > 0

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {/* Text Input */}
            <div className="mb-6">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={placeholder}
                className="w-full border-none resize-none focus:outline-none text-gray-900 placeholder-gray-500 text-lg"
                rows={3}
                maxLength={maxLength}
              />
              <div className="flex justify-between items-center mt-2">
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowMediaPicker(true)}
                    disabled={selectedMedia.length >= maxMedia}
                    className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Add media"
                  >
                    <ImageIcon className="h-5 w-5" />
                  </button>
                  {selectedMedia.length > 0 && (
                    <span className="text-sm text-gray-500">
                      {selectedMedia.length}/{maxMedia} media
                    </span>
                  )}
                  {mode === 'post' && allowLockedPosts && selectedMedia.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsLocked(!isLocked)}
                      className={`p-2 rounded-full transition-colors ${
                        isLocked 
                          ? 'bg-blue-600 text-white hover:bg-blue-700' 
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                      title={isLocked ? 'Unlock post' : 'Lock post'}
                    >
                      {isLocked ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                    </button>
                  )}
                </div>
                <span className="text-sm text-gray-500">
                  {content.length}/{maxLength}
                </span>
              </div>
            </div>

            {/* Media Preview */}
            {selectedMedia.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Media Preview
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSelectedMedia([])}
                    className="text-sm text-red-600 hover:text-red-800 transition-colors"
                  >
                    Clear All
                  </button>
                </div>
                
                {/* Media Layout Preview */}
                <div className="bg-gray-50 rounded-lg p-4">
                  {selectedMedia.length === 1 ? (
                                          <div className="space-y-2">
                        <div className="relative group">
                          <LazyMedia
                            src={selectedMedia[0].thumbnail}
                            alt={selectedMedia[0].altText || 'Media'}
                            className="w-full rounded-lg object-contain cursor-pointer hover:opacity-90 transition-opacity"
                            style={{
                              height: 'auto',
                              maxHeight: '400px'
                            }}
                            mediaType={selectedMedia[0].mediaType}
                          />
                          <button
                            type="button"
                            onClick={() => removeMedia(0)}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                          {isLocked && lockedMediaIds.includes(selectedMedia[0].id) && (
                            <div className="absolute top-2 left-2 bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                              <Lock className="h-3 w-3" />
                            </div>
                          )}
                        </div>
                      </div>
                  ) : selectedMedia.length === 2 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {selectedMedia.map((media, index) => (
                        <div key={media.id} className="relative group">
                          <LazyMedia
                            src={media.thumbnail}
                            alt={media.altText || `Media ${index + 1}`}
                            className="w-full rounded-lg object-contain cursor-pointer hover:opacity-90 transition-opacity"
                            style={{ aspectRatio: media.width && media.height ? `${media.width} / ${media.height}` : undefined }}
                            mediaType={media.mediaType}
                          />
                          <button
                            type="button"
                            onClick={() => removeMedia(index)}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                          {isLocked && lockedMediaIds.includes(media.id) && (
                            <div className="absolute top-2 left-2 bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                              <Lock className="h-3 w-3" />
                            </div>
                          )}
                          {index > 0 && (
                            <button
                              type="button"
                              onClick={() => reorderMedia(index, index - 1)}
                              className="absolute top-2 left-2 bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </button>
                          )}
                          {index < selectedMedia.length - 1 && (
                            <button
                              type="button"
                              onClick={() => reorderMedia(index, index + 1)}
                              className="absolute bottom-2 left-2 bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : selectedMedia.length === 3 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {selectedMedia.map((media, index) => (
                        <div key={media.id} className="relative group">
                          <LazyMedia
                            src={media.thumbnail}
                            alt={media.altText || `Media ${index + 1}`}
                            className="w-full rounded-lg object-contain cursor-pointer hover:opacity-90 transition-opacity"
                            style={{ aspectRatio: media.width && media.height ? `${media.width} / ${media.height}` : undefined }}
                            mediaType={media.mediaType}
                          />
                          <button
                            type="button"
                            onClick={() => removeMedia(index)}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                          {index > 0 && (
                            <button
                              type="button"
                              onClick={() => reorderMedia(index, index - 1)}
                              className="absolute top-2 left-2 bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </button>
                          )}
                          {index < selectedMedia.length - 1 && (
                            <button
                              type="button"
                              onClick={() => reorderMedia(index, index + 1)}
                              className="absolute bottom-2 left-2 bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    // 4+ media items: Main image + thumbnails layout
                    <div className="space-y-2">
                      <div className="relative group">
                        <LazyMedia
                          src={selectedMedia[0].thumbnail}
                          alt={selectedMedia[0].altText || 'Main media'}
                          className="w-full rounded-lg object-contain cursor-pointer hover:opacity-90 transition-opacity"
                          style={{ aspectRatio: selectedMedia[0].width && selectedMedia[0].height ? `${selectedMedia[0].width} / ${selectedMedia[0].height}` : undefined }}
                          mediaType={selectedMedia[0].mediaType}
                        />
                        <button
                          type="button"
                          onClick={() => removeMedia(0)}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {selectedMedia.slice(1).map((media, index) => (
                          <div key={media.id} className="relative group">
                            <LazyMedia
                              src={media.thumbnail}
                              alt={media.altText || `Media ${index + 2}`}
                              className="w-full rounded-lg object-contain cursor-pointer hover:opacity-90 transition-opacity"
                              style={{ aspectRatio: '1/1' }}
                              mediaType={media.mediaType}
                            />
                            <button
                              type="button"
                              onClick={() => removeMedia(index + 1)}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="h-2 w-2" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Locked Post Controls */}
            {isLocked && mode === 'post' && allowLockedPosts && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-blue-900">
                    Locked Post Settings
                  </h3>
                  <div className="flex items-center space-x-2">
                    <Lock className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-blue-700">Locked</span>
                  </div>
                </div>
                
                {/* Unlock Price */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unlock Price (tokens)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={unlockPrice}
                    onChange={(e) => setUnlockPrice(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter unlock price"
                  />
                </div>

                {/* Media Locking */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lock Media Items
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedMedia.map((media, index) => (
                      <div key={media.id} className="flex items-center space-x-2 p-2 bg-white rounded border">
                        <input
                          type="checkbox"
                          id={`lock-${media.id}`}
                          checked={lockedMediaIds.includes(media.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setLockedMediaIds(prev => [...prev, media.id])
                            } else {
                              setLockedMediaIds(prev => prev.filter(id => id !== media.id))
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor={`lock-${media.id}`} className="text-sm text-gray-700 flex-1 truncate">
                          {media.altText || `Media ${index + 1}`}
                        </label>
                        <Lock className={`h-3 w-3 ${lockedMediaIds.includes(media.id) ? 'text-blue-600' : 'text-gray-400'}`} />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    At least one media item must be locked for locked posts.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span>{mode === 'post' ? 'Post' : 'Send'}</span>
            </button>
          </div>
        </motion.div>

        {/* Media Picker Modal */}
        <MediaPicker
          isOpen={showMediaPicker}
          onClose={() => setShowMediaPicker(false)}
          onMediaSelected={handleMediaSelect}
          userId={authData?.data?.user?.id || ''}
          mode="post"
          title="Select Media"
          confirmText="Add Media"
          maxSelection={maxMedia - selectedMedia.length}
          showUpload={true}
          showGlobalSearch={true}
          showFilters={true}
        />
      </div>
    </AnimatePresence>
  )
} 