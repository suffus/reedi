'use client'

import { motion } from 'framer-motion'
import { Heart, MessageCircle, Share2, Calendar } from 'lucide-react'

// Mock data for demonstration
const mockPosts = [
  {
    id: 1,
    title: "Weekend Family Gathering",
    excerpt: "Had an amazing time with the family this weekend. The kids loved the new backyard setup...",
    author: "Sarah Johnson",
    authorAvatar: "/avatars/sarah.jpg",
    likes: 12,
    comments: 5,
    date: "2 hours ago",
    image: "/posts/family-gathering.jpg"
  },
  {
    id: 2,
    title: "New Recipe Discovery",
    excerpt: "Tried this incredible pasta recipe that everyone loved. Perfect for family dinners...",
    author: "Mike Chen",
    authorAvatar: "/avatars/mike.jpg",
    likes: 8,
    comments: 3,
    date: "5 hours ago",
    image: "/posts/pasta-recipe.jpg"
  },
  {
    id: 3,
    title: "Travel Adventures",
    excerpt: "Exploring the beautiful mountains with friends. The views were absolutely breathtaking...",
    author: "Emma Davis",
    authorAvatar: "/avatars/emma.jpg",
    likes: 15,
    comments: 7,
    date: "1 day ago",
    image: "/posts/mountain-view.jpg"
  }
]

export function LatestPosts() {
  return (
    <div className="space-y-6">
      {mockPosts.map((post, index) => (
        <motion.article
          key={post.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
          className="card hover:shadow-md transition-shadow duration-200 cursor-pointer"
        >
          <div className="flex space-x-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-accent-500 rounded-full flex items-center justify-center text-white font-semibold">
                {post.author.charAt(0)}
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-2">
                <h3 className="text-lg font-semibold text-gray-900 truncate">
                  {post.title}
                </h3>
                <span className="text-sm text-gray-500">•</span>
                <span className="text-sm text-gray-500">{post.date}</span>
              </div>
              
              <p className="text-gray-600 mb-4 line-clamp-2">
                {post.excerpt}
              </p>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <button className="flex items-center space-x-1 hover:text-primary-600 transition-colors duration-200">
                    <Heart className="h-4 w-4" />
                    <span>{post.likes}</span>
                  </button>
                  <button className="flex items-center space-x-1 hover:text-primary-600 transition-colors duration-200">
                    <MessageCircle className="h-4 w-4" />
                    <span>{post.comments}</span>
                  </button>
                  <button className="flex items-center space-x-1 hover:text-primary-600 transition-colors duration-200">
                    <Share2 className="h-4 w-4" />
                    <span>Share</span>
                  </button>
                </div>
                
                <div className="text-sm text-gray-500">
                  by {post.author}
                </div>
              </div>
            </div>
          </div>
        </motion.article>
      ))}
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="text-center pt-4"
      >
        <button className="btn-secondary">
          View All Posts
        </button>
      </motion.div>
    </div>
  )
} 