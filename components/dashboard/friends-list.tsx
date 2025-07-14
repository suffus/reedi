'use client'

import { useState, useEffect } from 'react'
import { API_BASE_URL, getAuthHeaders } from '@/lib/api'
import Link from 'next/link'

interface Friend {
  id: string
  name: string
  username: string
  avatar: string
  bio: string
}

export default function FriendsList() {
  const [friends, setFriends] = useState<Friend[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    fetchCurrentUser()
  }, [])

  useEffect(() => {
    if (currentUserId) {
      fetchFriends()
    }
  }, [currentUserId])

  const fetchCurrentUser = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: getAuthHeaders(token || undefined)
      })
      const data = await response.json()
      if (data.success) {
        setCurrentUserId(data.data.user.id)
      }
    } catch (err) {
      console.error('Failed to fetch current user:', err)
    }
  }

  const fetchFriends = async () => {
    if (!currentUserId) return

    try {
      setLoading(true)
      const response = await fetch(`${API_BASE_URL}/friends/${currentUserId}/friends`)
      const data = await response.json()
      if (data.success) {
        setFriends(data.data.friends)
      }
    } catch (err) {
      console.error('Failed to fetch friends:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Friends</h1>
        
        {friends.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {friends.map(friend => (
              <div key={friend.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center space-x-4 mb-4">
                  {friend.avatar ? (
                    <img
                      src={friend.avatar}
                      alt={friend.name}
                      className="w-16 h-16 rounded-full"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center">
                      <span className="text-xl font-bold text-gray-600">
                        {friend.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{friend.name}</h3>
                    {friend.username && (
                      <p className="text-gray-600">@{friend.username}</p>
                    )}
                  </div>
                </div>
                
                {friend.bio && (
                  <p className="text-gray-500 text-sm mb-4">{friend.bio}</p>
                )}
                
                <Link
                  href={`/user/${friend.username || friend.id}`}
                  className="block w-full btn-primary text-center py-2 font-medium transition-colors"
                >
                  View Profile
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">👥</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No friends yet</h3>
            <p className="text-gray-500 mb-6">Start connecting with people by sending friend requests!</p>
            <Link
              href="/search"
              className="inline-block btn-primary px-6 py-3 font-medium transition-colors"
            >
              Find People
            </Link>
          </div>
        )}
      </div>
    </div>
  )
} 