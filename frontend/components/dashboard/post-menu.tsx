'use client'

import React, { useState } from 'react'
import { MoreHorizontal, Pause, Eye, Trash2, Play, Globe, Users, Lock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUpdatePostStatus, useUpdatePostVisibility } from '../../lib/api-hooks'

interface PostMenuProps {
  post: {
    id: string
    publicationStatus: 'PUBLIC' | 'PAUSED' | 'CONTROLLED' | 'DELETED'
    visibility: 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE'
    authorId: string
  }
  currentUserId: string
  onClose?: () => void
}

export function PostMenu({ post, currentUserId, onClose }: PostMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showVisibilityModal, setShowVisibilityModal] = useState(false)
  
  const updatePostStatus = useUpdatePostStatus()
  const updatePostVisibility = useUpdatePostVisibility()

  // Only show menu for post author
  if (post.authorId !== currentUserId) {
    return null
  }

  const handleToggleMenu = () => {
    setIsOpen(!isOpen)
  }

  const handlePause = async () => {
    try {
      const newStatus = post.publicationStatus === 'PAUSED' ? 'PUBLIC' : 'PAUSED'
      await updatePostStatus.mutateAsync({ 
        postId: post.id, 
        publicationStatus: newStatus 
      })
      setIsOpen(false)
      onClose?.()
    } catch (error) {
      console.error('Failed to update post status:', error)
    }
  }

  const handleDelete = async () => {
    try {
      await updatePostStatus.mutateAsync({ 
        postId: post.id, 
        publicationStatus: 'DELETED' 
      })
      setShowDeleteConfirm(false)
      setIsOpen(false)
      onClose?.()
    } catch (error) {
      console.error('Failed to delete post:', error)
    }
  }

  const handleControlVisibility = () => {
    setShowVisibilityModal(true)
    setIsOpen(false)
  }

  const handleVisibilityChange = async (visibility: 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE') => {
    try {
      await updatePostVisibility.mutateAsync({ 
        postId: post.id, 
        visibility 
      })
      setShowVisibilityModal(false)
      onClose?.()
    } catch (error) {
      console.error('Failed to update post visibility:', error)
    }
  }

  const isPaused = post.publicationStatus === 'PAUSED'

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case 'PUBLIC':
        return <Globe className="h-4 w-4" />
      case 'FRIENDS_ONLY':
        return <Users className="h-4 w-4" />
      case 'PRIVATE':
        return <Lock className="h-4 w-4" />
      default:
        return <Eye className="h-4 w-4" />
    }
  }

  const getVisibilityLabel = (visibility: string) => {
    switch (visibility) {
      case 'PUBLIC':
        return 'Public'
      case 'FRIENDS_ONLY':
        return 'Friends Only'
      case 'PRIVATE':
        return 'Private'
      default:
        return 'Unknown'
    }
  }

  const getVisibilityDescription = (visibility: string) => {
    switch (visibility) {
      case 'PUBLIC':
        return 'Anyone can see this post'
      case 'FRIENDS_ONLY':
        return 'Only your friends can see this post'
      case 'PRIVATE':
        return 'Only you can see this post'
      default:
        return ''
    }
  }

  return (
    <>
      <div className="relative">
        <button
          onClick={handleToggleMenu}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200"
          aria-label="Post options"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.1 }}
              className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
            >
              <button
                onClick={handlePause}
                disabled={updatePostStatus.isPending}
                className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200"
              >
                {isPaused ? (
                  <>
                    <Play className="h-4 w-4 mr-3" />
                    Unpause
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4 mr-3" />
                    Pause
                  </>
                )}
              </button>
              
              <button
                onClick={handleControlVisibility}
                className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200"
              >
                <Eye className="h-4 w-4 mr-3" />
                Control Visibility
              </button>
              
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-200"
              >
                <Trash2 className="h-4 w-4 mr-3" />
                Delete
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-lg p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Delete Post
              </h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this post? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={updatePostStatus.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 disabled:opacity-50"
                >
                  {updatePostStatus.isPending ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Visibility Control Modal */}
      <AnimatePresence>
        {showVisibilityModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowVisibilityModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-lg p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Control Post Visibility
              </h3>
              <p className="text-gray-600 mb-6">
                Choose who can see this post:
              </p>
              
              <div className="space-y-3 mb-6">
                {(['PUBLIC', 'FRIENDS_ONLY', 'PRIVATE'] as const).map((visibility) => (
                  <button
                    key={visibility}
                    onClick={() => handleVisibilityChange(visibility)}
                    disabled={updatePostVisibility.isPending || post.visibility === visibility}
                    className={`w-full flex items-center p-4 rounded-lg border-2 transition-all duration-200 ${
                      post.visibility === visibility
                        ? 'border-primary-600 bg-primary-50 text-primary-700'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    } ${updatePostVisibility.isPending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-center justify-center w-8 h-8 mr-3">
                      {getVisibilityIcon(visibility)}
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-gray-900">
                        {getVisibilityLabel(visibility)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {getVisibilityDescription(visibility)}
                      </div>
                    </div>
                    {post.visibility === visibility && (
                      <div className="ml-auto">
                        <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
              
              <div className="flex justify-end">
                <button
                  onClick={() => setShowVisibilityModal(false)}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
} 