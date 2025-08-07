'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Save, Loader2, Tag, Eye, EyeOff, Users, Lock } from 'lucide-react'
import { Media } from '@/lib/types'
import { TagInput } from '../tag-input'
import { useBulkUpdateMedia } from '@/lib/api-hooks'

interface BulkEditModalProps {
  isOpen: boolean
  onClose: () => void
  selectedMedia: Media[]
  onSuccess?: () => void
}

export function BulkEditModal({ isOpen, onClose, selectedMedia, onSuccess }: BulkEditModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [tagMode, setTagMode] = useState<'replace' | 'add'>('replace')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE'>('PUBLIC')
  const [applyToAll, setApplyToAll] = useState({
    tags: false,
    title: false,
    description: false,
    visibility: false
  })

  const bulkUpdateMediaMutation = useBulkUpdateMedia()

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setTags([])
      setTagMode('replace')
      setTitle('')
      setDescription('')
      setVisibility('PUBLIC')
      setApplyToAll({ tags: false, title: false, description: false, visibility: false })
    }
  }, [isOpen])

  const handleSave = async () => {
    if (!applyToAll.tags && !applyToAll.title && !applyToAll.description && !applyToAll.visibility) {
      alert('Please select at least one field to update')
      return
    }

    setIsLoading(true)

    try {
      const mediaIds = selectedMedia.map(media => media.id)
      const updatePayload: any = {}
      
      if (applyToAll.tags) {
        updatePayload.tags = tags
        updatePayload.mergeTags = tagMode === 'add'
      }
      
      if (applyToAll.title) {
        updatePayload.title = title
      }
      
      if (applyToAll.description) {
        updatePayload.description = description
      }
      
      if (applyToAll.visibility) {
        updatePayload.visibility = visibility
      }

      await bulkUpdateMediaMutation.mutateAsync({
        mediaIds,
        ...updatePayload
      })
      
      onSuccess?.()
      onClose()
    } catch (error) {
      console.error('Failed to update media:', error)
      alert('Failed to update some media items. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const getVisibilityIcon = (vis: 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE') => {
    switch (vis) {
      case 'PUBLIC':
        return <Eye className="h-4 w-4" />
      case 'FRIENDS_ONLY':
        return <Users className="h-4 w-4" />
      case 'PRIVATE':
        return <Lock className="h-4 w-4" />
    }
  }

  const getVisibilityLabel = (vis: 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE') => {
    switch (vis) {
      case 'PUBLIC':
        return 'Public'
      case 'FRIENDS_ONLY':
        return 'Friends Only'
      case 'PRIVATE':
        return 'Private'
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Bulk Edit Media</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Editing {selectedMedia.length} media {selectedMedia.length === 1 ? 'item' : 'items'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Title Section */}
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="apply-title"
                    checked={applyToAll.title}
                    onChange={(e) => setApplyToAll(prev => ({ ...prev, title: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="apply-title" className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                    <span>Update Title</span>
                  </label>
                </div>
                
                {applyToAll.title && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="pl-6"
                  >
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Enter title..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </motion.div>
                )}
              </div>

              {/* Description Section */}
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="apply-description"
                    checked={applyToAll.description}
                    onChange={(e) => setApplyToAll(prev => ({ ...prev, description: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="apply-description" className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                    <span>Update Description</span>
                  </label>
                </div>
                
                {applyToAll.description && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="pl-6"
                  >
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Enter description..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </motion.div>
                )}
              </div>

              {/* Tags Section */}
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="apply-tags"
                    checked={applyToAll.tags}
                    onChange={(e) => setApplyToAll(prev => ({ ...prev, tags: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="apply-tags" className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                    <Tag className="h-4 w-4" />
                    <span>Update Tags</span>
                  </label>
                </div>
                
                {applyToAll.tags && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="pl-6 space-y-3"
                  >
                    <div className="flex items-center space-x-4">
                      <label className="flex items-center space-x-2 text-sm text-gray-600">
                        <input
                          type="radio"
                          name="tagMode"
                          value="replace"
                          checked={tagMode === 'replace'}
                          onChange={(e) => setTagMode(e.target.value as 'replace' | 'add')}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span>Replace all tags</span>
                      </label>
                      <label className="flex items-center space-x-2 text-sm text-gray-600">
                        <input
                          type="radio"
                          name="tagMode"
                          value="add"
                          checked={tagMode === 'add'}
                          onChange={(e) => setTagMode(e.target.value as 'replace' | 'add')}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span>Add to existing tags</span>
                      </label>
                    </div>
                    <TagInput
                      tags={tags}
                      onTagsChange={setTags}
                      placeholder="Enter tags (comma-separated)..."
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500">
                      {tagMode === 'replace' 
                        ? 'This will replace all existing tags on selected items'
                        : 'This will add these tags to existing tags on selected items'
                      }
                    </p>
                  </motion.div>
                )}
              </div>

              {/* Visibility Section */}
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="apply-visibility"
                    checked={applyToAll.visibility}
                    onChange={(e) => setApplyToAll(prev => ({ ...prev, visibility: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="apply-visibility" className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                    <Eye className="h-4 w-4" />
                    <span>Update Visibility</span>
                  </label>
                </div>
                
                {applyToAll.visibility && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="pl-6 space-y-2"
                  >
                    {(['PUBLIC', 'FRIENDS_ONLY', 'PRIVATE'] as const).map((vis) => (
                      <label key={vis} className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="radio"
                          name="visibility"
                          value={vis}
                          checked={visibility === vis}
                          onChange={(e) => setVisibility(e.target.value as any)}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex items-center space-x-2 text-sm text-gray-700">
                          {getVisibilityIcon(vis)}
                          <span>{getVisibilityLabel(vis)}</span>
                        </div>
                      </label>
                    ))}
                  </motion.div>
                )}
              </div>

              {/* Simple count instead of preview */}
              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm text-gray-600 text-center">
                  {selectedMedia.length} media {selectedMedia.length === 1 ? 'item' : 'items'} selected
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isLoading || (!applyToAll.tags && !applyToAll.title && !applyToAll.description && !applyToAll.visibility)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
} 