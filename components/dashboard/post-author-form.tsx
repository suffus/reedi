'use client'

import { useState } from 'react'
import { Image as ImageIcon, Tag } from 'lucide-react'
import { useCreatePost } from '../../lib/api-hooks'
import { ImageSelectorModal } from './image-selector-modal'
import { getImageUrlFromImage } from '../../lib/api'
import { LazyImage } from '../lazy-image'

interface PostAuthorFormProps {
  userId?: string
  onPostCreated?: () => void
}

export function PostAuthorForm({ userId, onPostCreated }: PostAuthorFormProps) {
  const [newPost, setNewPost] = useState('')
  const [selectedImages, setSelectedImages] = useState<any[]>([])
  const [isImageModalOpen, setIsImageModalOpen] = useState(false)
  const [postVisibility, setPostVisibility] = useState<'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE'>('PUBLIC')

  const createPostMutation = useCreatePost()

  const handleSubmitPost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPost.trim()) return

    try {
      await createPostMutation.mutateAsync({
        content: newPost,
        visibility: postVisibility,
        imageIds: selectedImages.map(img => img.id)
      })
      setNewPost('')
      setSelectedImages([])
      setPostVisibility('PUBLIC') // Reset to default
      onPostCreated?.()
    } catch (error) {
      console.error('Failed to create post:', error)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <form onSubmit={handleSubmitPost} className="space-y-4">
        <textarea
          value={newPost}
          onChange={(e) => setNewPost(e.target.value)}
          placeholder="What's on your mind?"
          className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          rows={3}
        />
        
        {/* Visibility Selector */}
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">Visibility:</label>
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => setPostVisibility('PUBLIC')}
              className={`px-3 py-1 text-sm rounded-none transition-colors ${
                postVisibility === 'PUBLIC'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Public
            </button>
            <button
              type="button"
              onClick={() => setPostVisibility('FRIENDS_ONLY')}
              className={`px-3 py-1 text-sm rounded-none transition-colors ${
                postVisibility === 'FRIENDS_ONLY'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Friends Only
            </button>
            <button
              type="button"
              onClick={() => setPostVisibility('PRIVATE')}
              className={`px-3 py-1 text-sm rounded-none transition-colors ${
                postVisibility === 'PRIVATE'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Private
            </button>
          </div>
        </div>
        
        {/* Selected Images Preview */}
        {selectedImages.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-700">
                {selectedImages.length} image{selectedImages.length !== 1 ? 's' : ''} selected
              </h4>
              <button
                type="button"
                onClick={() => setSelectedImages([])}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Clear all
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {selectedImages.map((image, index) => (
                <div key={image.id} className="relative aspect-square bg-gray-200 rounded-lg overflow-hidden">
                  <LazyImage
                    src={getImageUrlFromImage(image, true)}
                    alt={image.caption || image.altText || 'Selected image'}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedImages(prev => prev.filter((_, i) => i !== index))}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex justify-between items-center">
          <div className="flex space-x-2">
            <button
              type="button"
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              onClick={() => setIsImageModalOpen(true)}
              aria-label="Add images"
            >
              <ImageIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200"
            >
              <Tag className="h-5 w-5" />
            </button>
          </div>
          <button
            type="submit"
            disabled={!newPost.trim() || createPostMutation.isPending}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createPostMutation.isPending ? 'Posting...' : 'Post'}
          </button>
        </div>
      </form>
      {/* Image Selector Modal */}
      {userId && (
        <ImageSelectorModal
          isOpen={isImageModalOpen}
          onClose={() => setIsImageModalOpen(false)}
          onImagesSelected={setSelectedImages}
          userId={userId}
        />
      )}
    </div>
  )
} 