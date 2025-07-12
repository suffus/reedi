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
    <div className="space-y-8">
      {mockPosts.map((post, index) => (
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
                {post.author.charAt(0)}
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-3 mb-3">
                <h3 className="text-xl font-semibold text-primary-900 truncate">
                  {post.title}
                </h3>
                <span className="text-sm text-primary-400">•</span>
                <span className="text-sm text-primary-500">{post.date}</span>
              </div>
              
              <p className="text-primary-600 mb-6 leading-relaxed line-clamp-2">
                {post.excerpt}
              </p>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-6 text-sm text-primary-500">
                  <button className="flex items-center space-x-2 hover:text-primary-900 transition-colors duration-200">
                    <Heart className="h-5 w-5" />
                    <span>{post.likes}</span>
                  </button>
                  <button className="flex items-center space-x-2 hover:text-primary-900 transition-colors duration-200">
                    <MessageCircle className="h-5 w-5" />
                    <span>{post.comments}</span>
                  </button>
                  <button className="flex items-center space-x-2 hover:text-primary-900 transition-colors duration-200">
                    <Share2 className="h-5 w-5" />
                    <span>Share</span>
                  </button>
                </div>
                
                <div className="text-sm text-primary-600 font-medium">
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