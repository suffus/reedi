'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Heart, MessageCircle, Share, Clock, User, Lock } from 'lucide-react'
import { API_BASE_URL, getAuthHeaders, getMediaUrlFromMedia } from '@/lib/api'
import { usePublicUserPosts, usePublicUserMedia, useAuth } from '@/lib/api-hooks'
import { LazyMedia } from './lazy-media'
import { MediaGrid } from './media-grid'
import { PostMediaDisplay } from '@/components/common/post-media-display'
import { useMediaDetail } from '@/components/common/media-detail-context'
import { mapMediaData, getBestThumbnailUrl, getSmartMediaUrl } from '@/lib/media-utils'
import { getVideoUrlWithQuality } from '@/lib/api'


interface User {
  id: string
  name: string
  username: string
  avatar: string
  bio: string
  location: string
  website: string
  isVerified: boolean
  createdAt: string
  _count: {
    posts: number
    followers: number
    following: number
  }
}

interface FriendshipStatus {
  status: 'NONE' | 'REQUEST_SENT' | 'REQUEST_RECEIVED' | 'FRIENDS' | 'REJECTED' | 'SELF'
  requestId?: string
}

export default function UserProfile() {
  const params = useParams()
  const [user, setUser] = useState<User | null>(null)
  const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'posts' | 'media'>('posts')
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({})

  const identifier = params?.identifier as string

  // Get current user info
  const { data: authData } = useAuth()
  const { openMediaDetail } = useMediaDetail()

  const currentUserId = authData?.data?.user?.id

  // Use the new visibility-aware hooks
  const { data: postsData, isLoading: postsLoading } = usePublicUserPosts(identifier)
  const { data: mediaData, isLoading: mediaLoading } = usePublicUserMedia(identifier)

  const posts = postsData?.data?.posts || []
  const media = mediaData?.data?.media || []

  useEffect(() => {
    if (identifier) {
      fetchUserProfile()
      fetchFriendshipStatus()
    }
  }, [identifier])

  // Effect to load video URLs with preferred quality
  useEffect(() => {
    const loadVideoUrls = async () => {
      const newVideoUrls: Record<string, string> = {}
      
      for (const post of posts) {
        for (const mediaItem of post.media) {
          // Skip locked media without IDs
          if (mediaItem.mediaType === 'VIDEO' && mediaItem.id && !videoUrls[mediaItem.id] && !mediaItem.isLocked) {
            try {
              const qualityUrl = await getVideoUrlWithQuality(mediaItem.id, '540p')
              newVideoUrls[mediaItem.id] = qualityUrl
            } catch (error) {
              console.error('Error getting video quality URL:', error)
              // Fallback to regular URL
              newVideoUrls[mediaItem.id] = mediaItem.videoUrl || getMediaUrlFromMedia(mediaItem, false)
            }
          }
        }
      }
      
      if (Object.keys(newVideoUrls).length > 0) {
        setVideoUrls(prev => ({ ...prev, ...newVideoUrls }))
      }
    }

    loadVideoUrls()
  }, [posts])

  const fetchUserProfile = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/users/${identifier}/public`, {
        headers: getAuthHeaders(token || undefined)
      })
      const data = await response.json()
      if (data.success) {
        setUser(data.data.user)
      } else {
        setError('Failed to load user profile')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load user profile')
    } finally {
      setLoading(false)
    }
  }

  const fetchFriendshipStatus = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return // Skip if not authenticated
      
      const response = await fetch(`${API_BASE_URL}/friends/status/${identifier}`, {
        headers: getAuthHeaders(token)
      })
      const data = await response.json()
      if (data.success) {
        setFriendshipStatus(data.data)
      }
    } catch (err) {
      // Ignore errors for friendship status
      console.log('Could not fetch friendship status')
    }
  }

  const sendFriendRequest = async () => {
    try {
      setActionLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/friends/request/${identifier}`, {
        method: 'POST',
        headers: getAuthHeaders(token || undefined)
      })
      const data = await response.json()
      if (data.success) {
        setFriendshipStatus({ status: 'REQUEST_SENT' })
      } else {
        setError(data.error || 'Failed to send friend request')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send friend request')
    } finally {
      setActionLoading(false)
    }
  }

  const acceptFriendRequest = async () => {
    if (!friendshipStatus?.requestId) return

    try {
      setActionLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/friends/accept/${friendshipStatus.requestId}`, {
        method: 'PUT',
        headers: getAuthHeaders(token || undefined)
      })
      const data = await response.json()
      if (data.success) {
        setFriendshipStatus({ status: 'FRIENDS' })
      } else {
        setError(data.error || 'Failed to accept friend request')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to accept friend request')
    } finally {
      setActionLoading(false)
    }
  }

  const rejectFriendRequest = async () => {
    if (!friendshipStatus?.requestId) return

    try {
      setActionLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/friends/reject/${friendshipStatus.requestId}`, {
        method: 'PUT',
        headers: getAuthHeaders(token || undefined)
      })
      const data = await response.json()
      if (data.success) {
        setFriendshipStatus({ status: 'REJECTED' })
      } else {
        setError(data.error || 'Failed to reject friend request')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reject friend request')
    } finally {
      setActionLoading(false)
    }
  }

  const cancelFriendRequest = async () => {
    if (!friendshipStatus?.requestId) return

    try {
      setActionLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/friends/cancel/${friendshipStatus.requestId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token || undefined)
      })
      const data = await response.json()
      if (data.success) {
        setFriendshipStatus({ status: 'NONE' })
      } else {
        setError(data.error || 'Failed to cancel friend request')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to cancel friend request')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
          <p className="text-gray-600">{error || 'User not found'}</p>
        </div>
      </div>
    )
  }

  const renderActionButton = () => {
    // Don't show any action button if viewing your own profile
    if (friendshipStatus?.status === 'SELF' || (currentUserId && user && currentUserId === user.id)) {
      return null
    }

    if (friendshipStatus?.status === 'NONE') {
      return (
        <button
          onClick={sendFriendRequest}
          disabled={actionLoading}
          className="btn-primary px-6 py-3 font-medium transition-colors"
        >
          {actionLoading ? 'Sending...' : 'Add Friend'}
        </button>
      )
    }

    if (friendshipStatus?.status === 'REQUEST_SENT') {
      return (
        <button
          onClick={cancelFriendRequest}
          disabled={actionLoading}
          className="btn-secondary px-6 py-3 font-medium transition-colors"
        >
          {actionLoading ? 'Cancelling...' : 'Cancel Request'}
        </button>
      )
    }

    if (friendshipStatus?.status === 'REQUEST_RECEIVED') {
      return (
        <div className="flex gap-3">
          <button
            onClick={acceptFriendRequest}
            disabled={actionLoading}
            className="btn-primary px-6 py-3 font-medium transition-colors"
          >
            {actionLoading ? 'Accepting...' : 'Accept'}
          </button>
          <button
            onClick={rejectFriendRequest}
            disabled={actionLoading}
            className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-6 py-3 rounded-none font-medium transition-colors shadow-lg"
          >
            {actionLoading ? 'Rejecting...' : 'Reject'}
          </button>
        </div>
      )
    }

    if (friendshipStatus?.status === 'FRIENDS') {
      return (
        <div className="bg-primary-100 text-primary-800 px-6 py-3 rounded-none font-medium border border-primary-200">
          Friends
        </div>
      )
    }

    if (friendshipStatus?.status === 'REJECTED') {
      return (
        <div className="bg-red-100 text-red-800 px-6 py-3 rounded-none font-medium border border-red-200">
          Request Rejected
        </div>
      )
    }

    return null
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

  const handleMediaClick = (mediaItem: any, postMedia?: any[]) => {
    // Map the media data to the format expected by the unified media viewer
    const mappedMedia = mapMediaData(mediaItem)
    
    // Map all post media for navigation
    if (postMedia && postMedia.length > 0) {
      const mappedPostMedia = postMedia.map(media => mapMediaData(media))
      // Open the unified media viewer with all post media
      openMediaDetail(mappedMedia, mappedPostMedia)
    } else {
      // Open the unified media viewer with just the single media
      openMediaDetail(mappedMedia)
    }
  }



    

    

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-600 to-primary-800 p-8 text-white">
            <div className="flex items-center space-x-6">
              <div className="relative">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-24 h-24 rounded-full border-4 border-white"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full border-4 border-white bg-gray-300 flex items-center justify-center">
                    <span className="text-2xl font-bold text-gray-600">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                {user.isVerified && (
                  <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-1">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold">{user.name}</h1>
                {user.username && (
                  <p className="text-primary-100 text-lg">@{user.username}</p>
                )}
                {user.location && (
                  <p className="text-primary-100 flex items-center mt-2">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                    {user.location}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end">
                {renderActionButton()}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 divide-x divide-gray-200">
            <div className="p-6 text-center">
              <div className="text-2xl font-bold text-gray-900">{user._count.posts}</div>
              <div className="text-sm text-gray-600">Posts</div>
            </div>
            <div className="p-6 text-center">
              <div className="text-2xl font-bold text-gray-900">{user._count.followers}</div>
              <div className="text-sm text-gray-600">Followers</div>
            </div>
            <div className="p-6 text-center">
              <div className="text-2xl font-bold text-gray-900">{user._count.following}</div>
              <div className="text-sm text-gray-600">Following</div>
            </div>
          </div>

          {/* Bio and Details */}
          <div className="p-8">
            {user.bio && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">About</h3>
                <p className="text-gray-700 leading-relaxed">{user.bio}</p>
              </div>
            )}

            {user.website && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Website</h3>
                <a
                  href={user.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-800 underline"
                >
                  {user.website}
                </a>
              </div>
            )}

            <div className="text-sm text-gray-500">
              Member since {formatDate(user.createdAt)}
            </div>
          </div>

          {/* Content Tabs */}
          <div className="border-t border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('posts')}
                className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
                  activeTab === 'posts'
                    ? 'text-primary-600 border-b-2 border-primary-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Posts ({posts.length})
              </button>
              <button
                onClick={() => setActiveTab('media')}
                className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
                  activeTab === 'media'
                    ? 'text-primary-600 border-b-2 border-primary-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Media ({media.length})
              </button>
            </div>

            {/* Posts Tab */}
            {activeTab === 'posts' && (
              <div className="p-6">
                {postsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                  </div>
                ) : posts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No public posts available</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {posts.map((post: any) => (
                      <motion.div
                        key={post.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
                      >
                        {/* Post Header */}
                        <div className="p-4 border-b border-gray-100">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-accent-500 rounded-full flex items-center justify-center text-white font-semibold">
                              {user?.avatar ? (
                                <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full object-cover" />
                              ) : (
                                user?.name?.charAt(0).toUpperCase() || 'U'
                              )}
                            </div>
                            <div>
                              <h3 className="font-medium text-gray-900">{user?.name}</h3>
                              <div className="flex items-center space-x-2">
                                <p className="text-sm text-gray-500 flex items-center">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {formatDate(post.createdAt)}
                                </p>
                                {post.visibility && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                    {post.visibility.toLowerCase()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Post Content */}
                        <div className="p-4">
                          <p className="text-gray-900 mb-4">{post.content}</p>
                          
                          {/* Post Media */}
                          {post.media && post.media.length > 0 && (
                            <PostMediaDisplay 
                              media={post.media} 
                              onMediaClick={handleMediaClick}
                              isOwner={false}
                              showReorderControls={false}
                              isPublicView={true}
                            />
                          )}
                        </div>

                        {/* Post Actions (Read-only for public profiles) */}
                        <div className="px-4 py-3 border-t border-gray-100">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-6">
                              <div className="flex items-center space-x-2 text-gray-500">
                                <Heart className="h-5 w-5" />
                                <span>{post._count?.reactions || 0}</span>
                              </div>
                              
                              <div className="flex items-center space-x-2 text-gray-500">
                                <MessageCircle className="h-5 w-5" />
                                <span>{post._count?.comments || 0}</span>
                              </div>
                              
                              <div className="flex items-center space-x-2 text-gray-500">
                                <Share className="h-5 w-5" />
                                <span>Share</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Media Tab */}
            {activeTab === 'media' && (
              <div className="p-6">
                {mediaLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                  </div>
                ) : media.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No public media available</p>
                  </div>
                ) : (
                  <MediaGrid
                    media={media}
                    viewMode="grid"
                    selectedMedia={[]}
                    onMediaClick={handleMediaClick}
                    showTags={false}
                    className="gap-4"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>


    </div>
  )
} 