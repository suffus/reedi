'use client'

import { motion } from 'framer-motion'
import { Heart, MessageCircle, Share2, Calendar } from 'lucide-react'
import { usePublicPostsFeed } from '@/lib/api-hooks'

export function LatestPosts() {
  const { data: postsData, isLoading, error } = usePublicPostsFeed(1, 5)

  const posts = postsData?.data?.posts || []

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`
    
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card border-primary-100 animate-pulse">
            <div className="flex space-x-6">
              <div className="w-14 h-14 bg-gray-200 rounded-none"></div>
              <div className="flex-1 space-y-3">
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-primary-600">Unable to load posts at the moment.</p>
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-primary-600">No public posts available yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {posts.map((post: any, index: number) => (
        <motion.article
          key={post.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: index * 0.05 }}
          className="card hover:shadow-lg transition-shadow duration-200 cursor-pointer border-primary-100"
        >
          <div className="flex space-x-6">
            <div className="flex-shrink-0">
              <div className="w-14 h-14 bg-primary-900 rounded-none flex items-center justify-center text-white font-semibold text-lg">
                {post.author?.name?.charAt(0) || 'U'}
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-3 mb-3">
                <h3 className="text-xl font-semibold text-primary-900 truncate">
                  {post.title || 'Untitled Post'}
                </h3>
                <span className="text-sm text-primary-400">•</span>
                <span className="text-sm text-primary-500">{formatDate(post.createdAt)}</span>
                {post.visibility && (
                  <>
                    <span className="text-sm text-primary-400">•</span>
                    <span className="text-xs px-2 py-1 bg-primary-100 text-primary-700 rounded">
                      {post.visibility.toLowerCase()}
                    </span>
                  </>
                )}
              </div>
              
              <p className="text-primary-600 mb-6 leading-relaxed line-clamp-2">
                {post.content}
              </p>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-6 text-sm text-primary-500">
                  <button className="flex items-center space-x-2 hover:text-primary-900 transition-colors duration-200">
                    <Heart className="h-5 w-5" />
                    <span>{post._count?.reactions || 0}</span>
                  </button>
                  <button className="flex items-center space-x-2 hover:text-primary-900 transition-colors duration-200">
                    <MessageCircle className="h-5 w-5" />
                    <span>{post._count?.comments || 0}</span>
                  </button>
                  <button className="flex items-center space-x-2 hover:text-primary-900 transition-colors duration-200">
                    <Share2 className="h-5 w-5" />
                    <span>Share</span>
                  </button>
                </div>
                
                <div className="text-sm text-primary-600 font-medium">
                  by {post.author?.name || 'Unknown'}
                </div>
              </div>
            </div>
          </div>
        </motion.article>
      ))}
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="text-center pt-6"
      >
        <button className="btn-outline">
          View All Posts
        </button>
      </motion.div>
    </div>
  )
} 