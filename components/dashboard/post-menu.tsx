'use client'

import React, { useState } from 'react'
import { MoreHorizontal, Pause, Eye, Trash2, Play } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUpdatePostStatus } from '../../lib/api-hooks'

interface PostMenuProps {
  post: {
    id: string
    publicationStatus: 'PUBLIC' | 'PAUSED' | 'CONTROLLED' | 'DELETED'
    authorId: string
  }
  currentUserId: string
  onClose?: () => void
}

export function PostMenu({ post, currentUserId, onClose }: PostMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showComingSoon, setShowComingSoon] = useState(false)
  
  const updatePostStatus = useUpdatePostStatus()

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
    setShowComingSoon(true)
    setIsOpen(false)
  }

  const isPaused = post.publicationStatus === 'PAUSED'

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

      {/* Coming Soon Modal */}
      <AnimatePresence>
        {showComingSoon && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowComingSoon(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-lg p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Coming Soon
              </h3>
              <p className="text-gray-600 mb-6">
                Advanced visibility controls are coming soon! For now, you can use the pause feature to control who sees your posts.
              </p>
              <div className="flex justify-end">
                <button
                  onClick={() => setShowComingSoon(false)}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors duration-200"
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
} 