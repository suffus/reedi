'use client'

import { useState } from 'react'
import { Image as ImageIcon, Video, Tag } from 'lucide-react'
import { useCreatePost } from '../../lib/api-hooks'
import { PostComposer } from '../common/post-composer'

interface PostAuthorFormProps {
  userId?: string
  onPostCreated?: () => void
}

export function PostAuthorForm({ userId, onPostCreated }: PostAuthorFormProps) {
  const [newPost, setNewPost] = useState('')
  const [showComposer, setShowComposer] = useState(false)
  const [postVisibility, setPostVisibility] = useState<'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE'>('PUBLIC')

  const createPostMutation = useCreatePost()

  const handleComposerSubmit = async (content: string, mediaIds: string[]) => {
    try {
      await createPostMutation.mutateAsync({
        content,
        visibility: postVisibility,
        mediaIds
      })
      setNewPost('')
      onPostCreated?.()
    } catch (error) {
      console.error('Failed to create post:', error)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="space-y-4">
        {/* Simple text input for quick posts */}
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
        
        <div className="flex justify-between items-center">
          <div className="flex space-x-2">
            <button
              type="button"
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              onClick={() => setShowComposer(true)}
              aria-label="Create media post"
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
            type="button"
            disabled={!newPost.trim() || createPostMutation.isPending}
            onClick={() => handleComposerSubmit(newPost, [])}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createPostMutation.isPending ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>

      {/* Post Composer Modal */}
      <PostComposer
        isOpen={showComposer}
        onClose={() => setShowComposer(false)}
        onSubmit={handleComposerSubmit}
        mode="post"
        title="Create Post"
        placeholder="What's on your mind?"
        maxLength={1000}
        maxMedia={10}
        initialContent={newPost}
      />
    </div>
  )
} 