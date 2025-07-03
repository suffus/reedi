'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Heart, MessageCircle, Share, MoreHorizontal, User, Clock, Send, Image as ImageIcon, Tag } from 'lucide-react'
import { usePostsFeed, useCreatePost, usePostReaction, useComments, useCreateComment } from '../../lib/api-hooks'

interface Post {
  id: string
  content: string
  images: string[]
  createdAt: string
  author: {
    id: string
    name: string
    username: string | null
    avatar: string | null
  }
  reactions: {
    id: string
    type: string
    authorId: string
  }[]
  comments: {
    id: string
    content: string
    createdAt: string
    author: {
      id: string
      name: string
      username: string | null
      avatar: string | null
    }
  }[]
  _count: {
    reactions: number
    comments: number
  }
}

interface Comment {
  id: string
  content: string
  createdAt: string
  author: {
    id: string
    name: string
    username: string | null
    avatar: string | null
  }
}

export function PersonalFeed() {
  const [newPost, setNewPost] = useState('')
  const [newComments, setNewComments] = useState<{ [postId: string]: string }>({})
  const [showComments, setShowComments] = useState<{ [postId: string]: boolean }>({})

  const { data: postsData, isLoading } = usePostsFeed()
  const createPostMutation = useCreatePost()
  const postReactionMutation = usePostReaction()
  const createCommentMutation = useCreateComment()

  const posts = postsData?.data?.posts || []

  const handleSubmitPost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPost.trim()) return

    try {
      await createPostMutation.mutateAsync({
        content: newPost
      })
      setNewPost('')
    } catch (error) {
      console.error('Failed to create post:', error)
    }
  }

  const handleReaction = async (postId: string, type: string) => {
    try {
      await postReactionMutation.mutateAsync({ postId, type })
    } catch (error) {
      console.error('Failed to add reaction:', error)
    }
  }

  const handleAddComment = async (postId: string) => {
    const commentContent = newComments[postId]?.trim()
    if (!commentContent) return

    try {
      await createCommentMutation.mutateAsync({
        content: commentContent,
        postId
      })
      setNewComments(prev => ({ ...prev, [postId]: '' }))
    } catch (error) {
      console.error('Failed to add comment:', error)
    }
  }

  const toggleComments = (postId: string) => {
    setShowComments(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }))
  }

  const hasUserLiked = (post: Post) => {
    // This would need to be implemented based on the current user's reactions
    return post.reactions.some(reaction => reaction.type === 'LIKE')
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-32"></div>
              <div className="h-3 bg-gray-200 rounded w-24"></div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Create Post */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSubmitPost} className="space-y-4">
          <textarea
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            placeholder="What's on your mind?"
            className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            rows={3}
          />
          <div className="flex justify-between items-center">
            <div className="flex space-x-2">
              <button
                type="button"
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200"
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
      </div>

      {/* Posts Feed */}
      {posts.map((post: Post) => (
        <motion.div
          key={post.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
        >
          {/* Post Header */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-accent-500 rounded-full flex items-center justify-center text-white font-semibold">
                  {post.author.avatar ? (
                    <img src={post.author.avatar} alt={post.author.name} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    post.author.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{post.author.name}</h3>
                  <p className="text-sm text-gray-500 flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    {formatDate(post.createdAt)}
                  </p>
                </div>
              </div>
              <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors duration-200">
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Post Content */}
          <div className="p-4">
            <p className="text-gray-900 mb-4">{post.content}</p>
            
            {/* Post Images */}
            {post.images && post.images.length > 0 && (
              <div className="grid grid-cols-1 gap-2 mb-4">
                {post.images.map((image, index) => (
                  <img
                    key={index}
                    src={image}
                    alt={`Post image ${index + 1}`}
                    className="w-full rounded-lg object-cover"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Post Actions */}
          <div className="px-4 py-3 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <button
                  onClick={() => handleReaction(post.id, 'LIKE')}
                  disabled={postReactionMutation.isPending}
                  className={`flex items-center space-x-2 text-gray-500 hover:text-red-500 transition-colors duration-200 ${
                    hasUserLiked(post) ? 'text-red-500' : ''
                  }`}
                >
                  <Heart className={`h-5 w-5 ${hasUserLiked(post) ? 'fill-current' : ''}`} />
                  <span>{post._count.reactions}</span>
                </button>
                
                <button
                  onClick={() => toggleComments(post.id)}
                  className="flex items-center space-x-2 text-gray-500 hover:text-blue-500 transition-colors duration-200"
                >
                  <MessageCircle className="h-5 w-5" />
                  <span>{post._count.comments}</span>
                </button>
                
                <button className="flex items-center space-x-2 text-gray-500 hover:text-green-500 transition-colors duration-200">
                  <Share className="h-5 w-5" />
                  <span>Share</span>
                </button>
              </div>
            </div>
          </div>

          {/* Comments Section */}
          {showComments[post.id] && (
            <div className="border-t border-gray-100 p-4 bg-gray-50">
              <div className="space-y-3">
                {post.comments?.map((comment) => (
                  <div key={comment.id} className="flex space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-accent-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                      {comment.author.avatar ? (
                        <img src={comment.author.avatar} alt={comment.author.name} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        comment.author.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="bg-white rounded-lg p-3">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-medium text-sm text-gray-900">{comment.author.name}</span>
                          <span className="text-xs text-gray-500">{formatDate(comment.createdAt)}</span>
                        </div>
                        <p className="text-sm text-gray-700">{comment.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Add Comment */}
                <div className="flex space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-accent-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="flex-1 flex space-x-2">
                    <input
                      type="text"
                      value={newComments[post.id] || ''}
                      onChange={(e) => setNewComments(prev => ({ ...prev, [post.id]: e.target.value }))}
                      placeholder="Write a comment..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <button
                      onClick={() => handleAddComment(post.id)}
                      disabled={!newComments[post.id]?.trim() || createCommentMutation.isPending}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {createCommentMutation.isPending ? '...' : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      ))}

      {posts.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <MessageCircle className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No posts yet</h3>
          <p className="text-gray-600">Be the first to share something with your family and friends!</p>
        </div>
      )}
    </div>
  )
} 