'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Heart, MessageCircle, Share, MoreHorizontal, User, Clock, Send } from 'lucide-react'

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

interface PersonalFeedProps {
  userId: string
}

export function PersonalFeed({ userId }: PersonalFeedProps) {
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newPost, setNewPost] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [comments, setComments] = useState<{ [postId: string]: Comment[] }>({})
  const [newComments, setNewComments] = useState<{ [postId: string]: string }>({})
  const [showComments, setShowComments] = useState<{ [postId: string]: boolean }>({})
  const [submittingComments, setSubmittingComments] = useState<{ [postId: string]: boolean }>({})

  useEffect(() => {
    fetchPosts()
  }, [userId])

  const fetchPosts = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/posts/feed`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setPosts(data.data.posts)
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchComments = async (postId: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/comments/post/${postId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setComments(prev => ({
          ...prev,
          [postId]: data.data.comments
        }))
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error)
    }
  }

  const handleSubmitPost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPost.trim()) return

    setIsSubmitting(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: newPost
        })
      })

      if (response.ok) {
        setNewPost('')
        fetchPosts() // Refresh posts
      }
    } catch (error) {
      console.error('Failed to create post:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReaction = async (postId: string, type: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/posts/${postId}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type })
      })

      if (response.ok) {
        fetchPosts() // Refresh posts to update reactions
      }
    } catch (error) {
      console.error('Failed to add reaction:', error)
    }
  }

  const handleAddComment = async (postId: string) => {
    const commentContent = newComments[postId]?.trim()
    if (!commentContent) return

    setSubmittingComments(prev => ({ ...prev, [postId]: true }))
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: commentContent,
          postId
        })
      })

      if (response.ok) {
        setNewComments(prev => ({ ...prev, [postId]: '' }))
        fetchComments(postId) // Refresh comments
        fetchPosts() // Refresh posts to update comment count
      }
    } catch (error) {
      console.error('Failed to add comment:', error)
    } finally {
      setSubmittingComments(prev => ({ ...prev, [postId]: false }))
    }
  }

  const toggleComments = (postId: string) => {
    setShowComments(prev => {
      const newState = { ...prev, [postId]: !prev[postId] }
      if (newState[postId] && !comments[postId]) {
        fetchComments(postId)
      }
      return newState
    })
  }

  const hasUserLiked = (post: Post) => {
    return post.reactions.some(reaction => 
      reaction.authorId === userId && reaction.type === 'LIKE'
    )
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${diffInHours}h ago`
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`
    return date.toLocaleDateString()
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/4"></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Create Post */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
      >
        <form onSubmit={handleSubmitPost} className="space-y-4">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-accent-500 rounded-full flex items-center justify-center text-white font-semibold">
              <User className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="What's on your mind?"
                className="w-full p-3 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                rows={3}
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!newPost.trim() || isSubmitting}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </form>
      </motion.div>

      {/* Posts Feed */}
      <div className="space-y-6">
        {posts.map((post, index) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
          >
            {/* Post Header */}
            <div className="p-6 pb-4">
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
                    <h3 className="font-semibold text-gray-900">{post.author.name}</h3>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <Clock className="h-3 w-3" />
                      <span>{formatDate(post.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <button className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200">
                  <MoreHorizontal className="h-4 w-4 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Post Content */}
            <div className="px-6 pb-4">
              <p className="text-gray-900 leading-relaxed">{post.content}</p>
              
              {/* Post Images */}
              {post.images && post.images.length > 0 && (
                <div className="mt-4 grid grid-cols-1 gap-2">
                  {post.images.map((image, imageIndex) => (
                    <img
                      key={imageIndex}
                      src={image}
                      alt={`Post image ${imageIndex + 1}`}
                      className="w-full h-64 object-cover rounded-lg"
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Post Actions */}
            <div className="px-6 py-4 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-6">
                  <button
                    onClick={() => handleReaction(post.id, 'LIKE')}
                    className={`flex items-center space-x-2 transition-colors duration-200 ${
                      hasUserLiked(post) 
                        ? 'text-red-500 hover:text-red-600' 
                        : 'text-gray-500 hover:text-red-500'
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
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                {/* Comment Form */}
                <div className="mb-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-accent-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="flex-1 flex space-x-2">
                      <input
                        type="text"
                        value={newComments[post.id] || ''}
                        onChange={(e) => setNewComments(prev => ({ ...prev, [post.id]: e.target.value }))}
                        placeholder="Write a comment..."
                        className="flex-1 p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        onKeyPress={(e) => e.key === 'Enter' && handleAddComment(post.id)}
                      />
                      <button
                        onClick={() => handleAddComment(post.id)}
                        disabled={!newComments[post.id]?.trim() || submittingComments[post.id]}
                        className="p-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Comments List */}
                <div className="space-y-3">
                  {comments[post.id]?.map((comment) => (
                    <div key={comment.id} className="flex items-start space-x-3">
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
                            <span className="font-semibold text-sm text-gray-900">{comment.author.name}</span>
                            <span className="text-xs text-gray-500">{formatDate(comment.createdAt)}</span>
                          </div>
                          <p className="text-sm text-gray-700">{comment.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!comments[post.id] || comments[post.id].length === 0) && (
                    <p className="text-sm text-gray-500 text-center py-2">No comments yet. Be the first to comment!</p>
                  )}
                </div>
              </div>
            )}

            {/* Comments Preview (when comments are not expanded) */}
            {!showComments[post.id] && post.comments && post.comments.length > 0 && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                <div className="space-y-3">
                  {post.comments.slice(0, 2).map((comment) => (
                    <div key={comment.id} className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-gradient-to-br from-primary-400 to-accent-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                        {comment.author.avatar ? (
                          <img src={comment.author.avatar} alt={comment.author.name} className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          comment.author.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="bg-white rounded-lg p-3">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-semibold text-sm text-gray-900">{comment.author.name}</span>
                            <span className="text-xs text-gray-500">{formatDate(comment.createdAt)}</span>
                          </div>
                          <p className="text-sm text-gray-700">{comment.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {post.comments.length > 2 && (
                    <button 
                      onClick={() => toggleComments(post.id)}
                      className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      View all {post.comments.length} comments
                    </button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {posts.length === 0 && !isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No posts yet</h3>
          <p className="text-gray-600">Start sharing with your family and friends!</p>
        </motion.div>
      )}
    </div>
  )
} 