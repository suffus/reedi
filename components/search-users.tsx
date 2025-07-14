'use client'

import { useState, useEffect } from 'react'
import { API_BASE_URL, getAuthHeaders } from '@/lib/api'
import Link from 'next/link'

interface User {
  id: string
  name: string
  username: string
  avatar: string
  bio: string
  _count: {
    posts: number
    followers: number
    following: number
  }
}

interface SearchResult {
  users?: User[]
  posts?: any[]
  hashtags?: any[]
}

export default function SearchUsers() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult>({ users: [], posts: [], hashtags: [] })
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'users' | 'posts' | 'hashtags'>('users')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query.trim()) {
        performSearch()
      } else {
        setResults({ users: [], posts: [], hashtags: [] })
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [query])

  const performSearch = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}&type=all`)
      const data = await response.json()
      if (data.success) {
        setResults(data.data.results || { users: [], posts: [], hashtags: [] })
      }
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const sendFriendRequest = async (userId: string) => {
    try {
      setActionLoading(userId)
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/friends/request/${userId}`, {
        method: 'POST',
        headers: getAuthHeaders(token || undefined)
      })
      const data = await response.json()
      if (data.success) {
        // Update the UI to show request sent
        setResults(prev => ({
          ...prev,
          users: (prev.users || []).map(user => 
            user.id === userId 
              ? { ...user, friendRequestSent: true }
              : user
          )
        }))
      }
    } catch (err) {
      console.error('Failed to send friend request:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const renderUserCard = (user: User) => (
    <div key={user.id} className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center space-x-4">
        {user.avatar ? (
          <img
            src={user.avatar}
            alt={user.name}
            className="w-16 h-16 rounded-full"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center">
            <span className="text-xl font-bold text-gray-600">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">{user.name}</h3>
          {user.username && (
            <p className="text-gray-600">@{user.username}</p>
          )}
          {user.bio && (
            <p className="text-gray-500 text-sm mt-1">{user.bio}</p>
          )}
          <div className="flex space-x-4 mt-2 text-sm text-gray-500">
            <span>{user._count.posts} posts</span>
            <span>{user._count.followers} followers</span>
            <span>{user._count.following} following</span>
          </div>
        </div>
                 <div className="flex space-x-3">
           <Link
             href={`/user/${user.username || user.id}`}
             className="btn-secondary px-4 py-2 text-sm font-medium transition-colors"
           >
             View Profile
           </Link>
           <button
             onClick={() => sendFriendRequest(user.id)}
             disabled={actionLoading === user.id || (user as any).friendRequestSent}
             className={`px-4 py-2 rounded-none text-sm font-medium transition-colors ${
               (user as any).friendRequestSent
                 ? 'bg-primary-100 text-primary-800 border border-primary-200'
                 : 'btn-primary'
             }`}
           >
             {actionLoading === user.id 
               ? 'Sending...' 
               : (user as any).friendRequestSent 
                 ? 'Request Sent' 
                 : 'Add Friend'
             }
           </button>
         </div>
      </div>
    </div>
  )

  return (
    <div className="bg-gray-50 min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Search</h1>
        
        {/* Search Input */}
        <div className="mb-8">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for users, posts, or hashtags..."
              className="w-full px-4 py-3 pl-12 border border-primary-200 rounded-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 bg-white"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Results Tabs */}
        {query.trim() && (
          <div className="mb-6">
            <nav className="flex space-x-1 bg-white rounded-none p-1 shadow-sm border border-primary-200">
              <button
                onClick={() => setActiveTab('users')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-none transition-colors duration-200 ${
                  activeTab === 'users'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-primary-600 hover:text-primary-900 hover:bg-primary-50'
                }`}
              >
                <span>Users ({results.users?.length || 0})</span>
              </button>
              <button
                onClick={() => setActiveTab('posts')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-none transition-colors duration-200 ${
                  activeTab === 'posts'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-primary-600 hover:text-primary-900 hover:bg-primary-50'
                }`}
              >
                <span>Posts ({results.posts?.length || 0})</span>
              </button>
              <button
                onClick={() => setActiveTab('hashtags')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-none transition-colors duration-200 ${
                  activeTab === 'hashtags'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-primary-600 hover:text-primary-900 hover:bg-primary-50'
                }`}
              >
                <span>Hashtags ({results.hashtags?.length || 0})</span>
              </button>
            </nav>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        )}

        {/* Results */}
        {!loading && query.trim() && (
          <div className="space-y-4">
            {activeTab === 'users' && (
              (results.users || []).length > 0 ? (
                (results.users || []).map(renderUserCard)
              ) : (
                <div className="text-center py-12">
                  <div className="text-gray-400 text-6xl mb-4">🔍</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
                  <p className="text-gray-500">Try searching with different keywords.</p>
                </div>
              )
            )}

            {activeTab === 'posts' && (
              <div className="text-center py-12">
                <p className="text-gray-500">Post search functionality coming soon!</p>
              </div>
            )}

            {activeTab === 'hashtags' && (
              <div className="text-center py-12">
                <p className="text-gray-500">Hashtag search functionality coming soon!</p>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!query.trim() && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">🔍</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Start searching</h3>
            <p className="text-gray-500">Search for users, posts, or hashtags to discover new content.</p>
          </div>
        )}
      </div>
    </div>
  )
} 