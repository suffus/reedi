'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { API_BASE_URL, getAuthHeaders } from '@/lib/api'

interface FriendRequest {
  id: string
  sender: {
    id: string
    name: string
    username: string
    avatar: string
    bio: string
  }
  receiver: {
    id: string
    name: string
    username: string
    avatar: string
    bio: string
  }
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED'
  createdAt: string
}

export default function FriendRequests() {
  const [receivedRequests, setReceivedRequests] = useState<FriendRequest[]>([])
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    fetchFriendRequests()
  }, [])

  const fetchFriendRequests = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      
      const [receivedResponse, sentResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/friends/requests/received`, {
          headers: getAuthHeaders(token || undefined)
        }),
        fetch(`${API_BASE_URL}/friends/requests/sent`, {
          headers: getAuthHeaders(token || undefined)
        })
      ])

      const receivedData = await receivedResponse.json()
      const sentData = await sentResponse.json()

      if (receivedData.success) {
        setReceivedRequests(receivedData.data.requests)
      }
      if (sentData.success) {
        setSentRequests(sentData.data.requests)
      }
    } catch (err) {
      console.error('Failed to fetch friend requests:', err)
    } finally {
      setLoading(false)
    }
  }

  const acceptRequest = async (requestId: string) => {
    try {
      setActionLoading(requestId)
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/friends/accept/${requestId}`, {
        method: 'PUT',
        headers: getAuthHeaders(token || undefined)
      })
      const data = await response.json()
      if (data.success) {
        // Remove from received requests
        setReceivedRequests(prev => prev.filter(req => req.id !== requestId))
      }
    } catch (err) {
      console.error('Failed to accept friend request:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const rejectRequest = async (requestId: string) => {
    try {
      setActionLoading(requestId)
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/friends/reject/${requestId}`, {
        method: 'PUT',
        headers: getAuthHeaders(token || undefined)
      })
      const data = await response.json()
      if (data.success) {
        // Remove from received requests
        setReceivedRequests(prev => prev.filter(req => req.id !== requestId))
      }
    } catch (err) {
      console.error('Failed to reject friend request:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const cancelRequest = async (requestId: string) => {
    try {
      setActionLoading(requestId)
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/friends/cancel/${requestId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token || undefined)
      })
      const data = await response.json()
      if (data.success) {
        // Remove from sent requests
        setSentRequests(prev => prev.filter(req => req.id !== requestId))
      }
    } catch (err) {
      console.error('Failed to cancel friend request:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const renderUserCard = (request: FriendRequest, isReceived: boolean = true) => {
    const user = isReceived ? request.sender : request.receiver
    return (
      <div key={request.id} className="bg-white rounded-lg shadow-md p-6 mb-4">
        <div className="flex items-center space-x-4">
          <Link href={`/user/${user.username || user.id}`} className="flex-shrink-0">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-16 h-16 rounded-full hover:opacity-80 transition-opacity cursor-pointer"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer">
                <span className="text-xl font-bold text-gray-600">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </Link>
          <div className="flex-1">
            <Link 
              href={`/user/${user.username || user.id}`}
              className="block hover:text-primary-600 transition-colors"
            >
              <h3 className="text-lg font-semibold text-gray-900 hover:text-primary-600 transition-colors cursor-pointer">
                {user.name}
              </h3>
            </Link>
            {user.username && (
              <Link 
                href={`/user/${user.username}`}
                className="block hover:text-primary-600 transition-colors"
              >
                <p className="text-gray-600 hover:text-primary-600 transition-colors cursor-pointer">
                  @{user.username}
                </p>
              </Link>
            )}
            {user.bio && (
              <p className="text-gray-500 text-sm mt-1">{user.bio}</p>
            )}
          </div>
          <div className="flex space-x-3">
            {isReceived ? (
              <>
                <button
                  onClick={() => acceptRequest(request.id)}
                  disabled={actionLoading === request.id}
                  className="btn-primary px-4 py-2 text-sm font-medium transition-colors"
                >
                  {actionLoading === request.id ? 'Accepting...' : 'Accept'}
                </button>
                <button
                  onClick={() => rejectRequest(request.id)}
                  disabled={actionLoading === request.id}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-4 py-2 rounded-none text-sm font-medium transition-colors shadow-lg"
                >
                  {actionLoading === request.id ? 'Rejecting...' : 'Reject'}
                </button>
              </>
            ) : (
              <button
                onClick={() => cancelRequest(request.id)}
                disabled={actionLoading === request.id}
                className="btn-secondary px-4 py-2 text-sm font-medium transition-colors"
              >
                {actionLoading === request.id ? 'Cancelling...' : 'Cancel'}
              </button>
            )}
          </div>
        </div>
      </div>
    )
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
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Friend Requests</h1>
        
        {/* Tabs */}
        <div className="flex space-x-1 bg-white rounded-lg p-1 mb-6">
          <button
            onClick={() => setActiveTab('received')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'received'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Received ({receivedRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'sent'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Sent ({sentRequests.length})
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {activeTab === 'received' ? (
            receivedRequests.length > 0 ? (
              receivedRequests.map(request => renderUserCard(request, true))
            ) : (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">👥</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No friend requests</h3>
                <p className="text-gray-500">You don't have any pending friend requests.</p>
              </div>
            )
          ) : (
            sentRequests.length > 0 ? (
              sentRequests.map(request => renderUserCard(request, false))
            ) : (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">📤</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No sent requests</h3>
                <p className="text-gray-500">You haven't sent any friend requests yet.</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
} 