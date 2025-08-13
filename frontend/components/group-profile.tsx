'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { API_BASE_URL, getAuthHeaders } from '@/lib/api'
import { User, Group, GroupMember, GroupPost } from '@/lib/types'
import { 
  Users, 
  Calendar, 
  Shield, 
  Eye, 
  EyeOff, 
  Lock, 
  Globe,
  Plus,
  MessageSquare,
  Heart,
  Share2,
  MoreHorizontal,
  Settings,
  UserPlus,
  FileText,
  Image as ImageIcon
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useToast } from '@/components/common/toast'
import { PostMediaDisplay } from '@/components/common/post-media-display'

interface GroupProfileProps {
  group?: Group
  currentUser?: User
}

const GroupProfile: React.FC<GroupProfileProps> = ({ group, currentUser }) => {
  const params = useParams()
  const { showToast } = useToast()
  
  // Helper function to get group image URL
  const getGroupImageUrl = (mediaId: string | undefined): string => {
    if (!mediaId) return ''
    
    // If it's already a full URL, return as is
    if (mediaId.startsWith('http://') || mediaId.startsWith('https://')) {
      return mediaId
    }
    
    // If it's a data URL, return as is
    if (mediaId.startsWith('data:')) {
      return mediaId
    }
    
    // For group images, use the public media serving endpoint (no auth required)
    return `${API_BASE_URL}/media/serve/${mediaId}`
  }
  const [groupData, setGroupData] = useState<Group | null>(group || null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [posts, setPosts] = useState<GroupPost[]>([])
  const [isMember, setIsMember] = useState(false)
  const [userRole, setUserRole] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('feed')
  const [showApplyModal, setShowApplyModal] = useState(false)
  const [applyMessage, setApplyMessage] = useState('')

  const groupId = params?.identifier as string

  useEffect(() => {
    if (groupId) {
      loadGroupData()
    }
  }, [groupId])

  // Reload group data when currentUser becomes available
  useEffect(() => {
    if (groupId && currentUser) {
      loadGroupData()
    }
  }, [groupId, currentUser])

  const loadGroupData = async () => {
    try {
      setIsLoading(true)
      
      // Get authentication token
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') || undefined : undefined
      console.log('GroupProfile: Token available:', !!token)
      console.log('GroupProfile: Current user:', currentUser)
      
      // Load group details
      const groupResponse = await fetch(`${API_BASE_URL}/groups/${groupId}`, {
        headers: getAuthHeaders(token)
      })
      const groupData = await groupResponse.json()
      if (groupData.success) {
        setGroupData(groupData.data.group)
        
        // Check if current user is a member (only if we have currentUser data)
        if (currentUser && groupData.data.group.members) {
          const membership = groupData.data.group.members.find(
            (m: GroupMember) => m.user.id === currentUser.id
          )
          
          if (membership) {
            setIsMember(true)
            setUserRole(membership.role)
          }
        }
      }

      // Load members
      const membersResponse = await fetch(`${API_BASE_URL}/groups/${groupId}/members`, {
        headers: getAuthHeaders(token)
      })
      const membersData = await membersResponse.json()
      if (membersData.success) {
        setMembers(membersData.data.members)
      }

      // Load posts
      const postsResponse = await fetch(`${API_BASE_URL}/groups/${groupId}/feed`, {
        headers: getAuthHeaders(token)
      })
      const postsData = await postsResponse.json()
      if (postsData.success) {
        setPosts(postsData.data.posts)
      }
    } catch (error) {
      console.error('Error loading group data:', error)
      showToast({
        type: 'error',
        message: 'Failed to load group data'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoinGroup = async () => {
    if (!currentUser) {
      showToast({
        type: 'error',
        message: 'Please log in to join this group'
      })
      return
    }

    try {
      // Get authentication token
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') || undefined : undefined
      
      if (groupData?.visibility === 'PUBLIC') {
        // Direct join for public groups
        await fetch(`${API_BASE_URL}/groups/${groupId}/members`, {
          method: 'POST',
          headers: getAuthHeaders(token),
          body: JSON.stringify({ userId: currentUser.id })
        })
        setIsMember(true)
        setUserRole('MEMBER')
        showToast({
          type: 'success',
          message: 'You have joined the group!'
        })
        loadGroupData()
      } else {
        // Show application modal for private groups
        setShowApplyModal(true)
      }
    } catch (error) {
      console.error('Error joining group:', error)
      showToast({
        type: 'error',
        message: 'Failed to join group'
      })
    }
  }

  const handleApplyToJoin = async () => {
    try {
      // Get authentication token
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') || undefined : undefined
      
      await fetch(`${API_BASE_URL}/groups/${groupId}/apply`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ message: applyMessage })
      })
      setShowApplyModal(false)
      setApplyMessage('')
      showToast({
        type: 'success',
        message: 'Your application has been submitted for review'
      })
    } catch (error) {
      console.error('Error applying to group:', error)
      showToast({
        type: 'error',
        message: 'Failed to submit application'
      })
    }
  }

  const handleMediaClick = (media: any, allMedia?: any[]) => {
    // Handle media click - could open a media detail modal
    console.log('Media clicked:', media)
    // TODO: Implement media detail modal
  }

  const getVisibilityIcon = () => {
    switch (groupData?.visibility) {
      case 'PUBLIC':
        return <Globe className="w-4 h-4" />
      case 'PRIVATE_VISIBLE':
        return <Eye className="w-4 h-4" />
      case 'PRIVATE_HIDDEN':
        return <EyeOff className="w-4 h-4" />
      default:
        return <Lock className="w-4 h-4" />
    }
  }

  const getVisibilityLabel = () => {
    switch (groupData?.visibility) {
      case 'PUBLIC':
        return 'Public'
      case 'PRIVATE_VISIBLE':
        return 'Private (Visible)'
      case 'PRIVATE_HIDDEN':
        return 'Private (Hidden)'
      default:
        return 'Unknown'
    }
  }

  const getTypeLabel = () => {
    switch (groupData?.type) {
      case 'GENERAL':
        return 'General'
      case 'SOCIAL_LEARNING':
        return 'Social Learning'
      case 'GAMING':
        return 'Gaming'
      case 'JOBS':
        return 'Jobs'
      case 'BUY_SELL':
        return 'Buy & Sell'
      case 'PARENTING':
        return 'Parenting'
      case 'WORK':
        return 'Work'
      default:
        return 'Unknown'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!groupData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Group Not Found</h1>
          <p className="text-gray-600 mt-2">The group you're looking for doesn't exist or you don't have access to it.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Group Header */}
      <div className="relative">
        {/* Cover Photo */}
        <div className="h-64 bg-gradient-to-r from-blue-500 to-purple-600 relative">
          {groupData.coverPhoto && (
            <img
              src={getGroupImageUrl(groupData.coverPhoto)}
              alt={`${groupData.name} cover`}
              className="w-full h-full object-cover"
            />
          )}
          
          {/* Group Info Overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
            <div className="flex items-end space-x-4">
              {/* Avatar */}
              <div className="relative">
                <div className="w-24 h-24 border-4 border-white rounded-full overflow-hidden">
                  {groupData.avatar ? (
                    <img
                      src={getGroupImageUrl(groupData.avatar)}
                      alt={groupData.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-gray-500" />
                    </div>
                  )}
                  <span className="absolute bottom-0 right-0 bg-blue-600 text-white text-lg font-bold rounded-full w-8 h-8 flex items-center justify-center">
                    {groupData.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                {isMember && (
                  <span className="absolute -bottom-2 -right-2 bg-green-600 text-white text-sm font-semibold px-2 py-1 rounded-full">
                    {userRole}
                  </span>
                )}
              </div>
              
              {/* Group Details */}
              <div className="flex-1 text-white">
                <h1 className="text-3xl font-bold mb-2">{groupData.name}</h1>
                <p className="text-lg mb-2">@{groupData.username}</p>
                <div className="flex items-center space-x-4 text-sm">
                  <div className="flex items-center space-x-1">
                    <Users className="w-4 h-4" />
                    <span>{members?.length || 0} members</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-4 h-4" />
                    <span>Created {formatDistanceToNow(new Date(groupData.createdAt))} ago</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    {getVisibilityIcon()}
                    <span>{getVisibilityLabel()}</span>
                  </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex space-x-2">
                {!isMember ? (
                  <button
                    onClick={handleJoinGroup}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
                  >
                    {groupData.visibility === 'PUBLIC' ? 'Join Group' : 'Request to Join'}
                  </button>
                ) : (
                  <button className="border-white text-white hover:bg-white hover:text-gray-900 px-4 py-2 rounded-md">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Post
                  </button>
                )}
                
                {isMember && (userRole === 'OWNER' || userRole === 'ADMIN') && (
                  <button className="border-white text-white hover:bg-white hover:text-gray-900 px-4 py-2 rounded-md">
                    <Settings className="w-4 h-4 mr-2" />
                    Manage
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Group Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <div className="flex space-x-3 mb-4">
              <button
                onClick={() => setActiveTab('feed')}
                className={`px-4 py-2 rounded-md text-gray-700 hover:bg-gray-200 ${activeTab === 'feed' ? 'bg-gray-200 font-semibold' : ''}`}
              >
                Feed
              </button>
              <button
                onClick={() => setActiveTab('about')}
                className={`px-4 py-2 rounded-md text-gray-700 hover:bg-gray-200 ${activeTab === 'about' ? 'bg-gray-200 font-semibold' : ''}`}
              >
                About
              </button>
              <button
                onClick={() => setActiveTab('rules')}
                className={`px-4 py-2 rounded-md text-gray-700 hover:bg-gray-200 ${activeTab === 'rules' ? 'bg-gray-200 font-semibold' : ''}`}
              >
                Rules
              </button>
            </div>
            
            {activeTab === 'feed' && (
              <div className="space-y-4">
                {posts.length === 0 ? (
                  <div className="bg-white p-8 rounded-lg shadow-md text-center">
                    <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No posts yet</h3>
                    <p className="text-gray-600">
                      {isMember ? 'Be the first to post something to this group!' : 'Join the group to see posts and start contributing.'}
                    </p>
                  </div>
                ) : (
                  posts.map((groupPost) => (
                    <div key={groupPost.id} className={`bg-white p-6 rounded-lg shadow-md ${groupPost.isPriority ? 'border-2 border-yellow-400' : ''}`}>
                      <div className="flex items-center justify-between pb-3 border-b">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                            <img
                              src={groupPost.post.author.avatar}
                              alt={groupPost.post.author.name}
                              className="w-full h-full object-cover"
                            />
                            <span className="text-lg font-bold bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center">
                              {groupPost.post.author.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold">{groupPost.post.author.name}</span>
                              {groupPost.isPriority && (
                                <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                                  Priority
                                </span>
                              )}
                            </div>
                            <span className="text-sm text-gray-500">
                              {formatDistanceToNow(new Date(groupPost.post.createdAt))} ago
                            </span>
                          </div>
                        </div>
                        
                        {groupPost.status === 'PENDING_APPROVAL' && (
                          <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">
                            Pending Approval
                          </span>
                        )}
                      </div>
                      
                      <div className="pt-4 border-t">
                        {groupPost.post.title && (
                          <h3 className="font-semibold text-lg mb-2">{groupPost.post.title}</h3>
                        )}
                        <p className="text-gray-700 mb-4">{groupPost.post.content}</p>
                        
                        {/* Post Media */}
                        {groupPost.post.media && groupPost.post.media.length > 0 && (
                          <PostMediaDisplay 
                            media={groupPost.post.media} 
                            onMediaClick={handleMediaClick} 
                          />
                        )}
                        
                        {/* Post Actions */}
                        <div className="flex items-center justify-between pt-4 border-t">
                          <div className="flex items-center space-x-4">
                            <button className="text-gray-600 hover:text-red-600">
                              <Heart className="w-4 h-4 mr-2" />
                              Like
                            </button>
                            <button className="text-gray-600 hover:text-blue-600">
                              <MessageSquare className="w-4 h-4 mr-2" />
                              Comment
                            </button>
                            <button className="text-gray-600 hover:text-green-600">
                              <Share2 className="w-4 h-4 mr-2" />
                              Share
                            </button>
                          </div>
                          
                          <div className="flex items-center space-x-2 text-sm text-gray-500">
                            <span>{groupPost.post._count?.reactions || 0} reactions</span>
                            <span>•</span>
                            <span>{groupPost.post._count?.comments || 0} comments</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            
            {activeTab === 'about' && (
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="flex items-center space-x-2 text-lg font-semibold mb-4">
                  <FileText className="w-5 h-5" />
                  <span>About {groupData.name}</span>
                </h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Description</h4>
                    <p className="text-gray-700">
                      {groupData.description || 'No description provided.'}
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Group Type</h4>
                    <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">
                      {getTypeLabel()}
                    </span>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Privacy</h4>
                    <div className="flex items-center space-x-2">
                      {getVisibilityIcon()}
                      <span>{getVisibilityLabel()}</span>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Moderation Policy</h4>
                    <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">
                      {groupData.moderationPolicy === 'NO_MODERATION' && 'No Moderation'}
                      {groupData.moderationPolicy === 'ADMIN_APPROVAL_REQUIRED' && 'Admin Approval Required'}
                      {groupData.moderationPolicy === 'AI_FILTER' && 'AI Filter'}
                      {groupData.moderationPolicy === 'SELECTIVE_MODERATION' && 'Selective Moderation'}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'rules' && (
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="flex items-center space-x-2 text-lg font-semibold mb-4">
                  <Shield className="w-5 h-5" />
                  <span>Group Rules</span>
                </h3>
                <div className="prose max-w-none">
                  <pre className="whitespace-pre-wrap text-gray-700 font-sans">
                    {groupData.rules || 'No rules have been set for this group.'}
                  </pre>
                </div>
              </div>
            )}
          </div>
          
          {/* Sidebar */}
          <div className="space-y-6">
            {/* Group Stats */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-4">Group Stats</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Members</span>
                                      <span className="font-semibold">{members?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Posts</span>
                  <span className="font-semibold">{posts.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Created</span>
                  <span className="font-semibold">
                    {formatDistanceToNow(new Date(groupData.createdAt))} ago
                  </span>
                </div>
              </div>
            </div>
            
            {/* Recent Members */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-4">Recent Members</h3>
              <div className="space-y-3">
                {members.slice(0, 5).map((member) => (
                  <div key={member.id} className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                      <img
                        src={member.user.avatar}
                        alt={member.user.name}
                        className="w-full h-full object-cover"
                      />
                      <span className="text-lg font-bold bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center">
                        {member.user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {member.user.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {member.role} • {formatDistanceToNow(new Date(member.joinedAt))} ago
                      </p>
                    </div>
                  </div>
                ))}
                
                                  {members && members.length > 5 && (
                  <button className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md">
                    <UserPlus className="w-4 h-4 mr-2" />
                    View All Members
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Apply to Join Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Request to Join {groupData.name}</h3>
            <p className="text-gray-600 mb-4">
              This is a private group. Please provide a message explaining why you'd like to join.
            </p>
            
            <textarea
              value={applyMessage}
              onChange={(e) => setApplyMessage(e.target.value)}
              placeholder="Tell us why you'd like to join this group..."
              className="w-full p-3 border border-gray-300 rounded-lg resize-none h-24 mb-4"
            />
            
            <div className="flex space-x-3">
              <button
                onClick={handleApplyToJoin}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
                disabled={!applyMessage.trim()}
              >
                Submit Application
              </button>
              <button
                onClick={() => setShowApplyModal(false)}
                className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-100 px-4 py-2 rounded-md"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GroupProfile 