'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { API_BASE_URL, getAuthHeaders, fetchFreshMediaData } from '@/lib/api'
import { User, Group, GroupMember, GroupPost, GroupActivity } from '@/lib/types'
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
  Image as ImageIcon,
  X
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useToast } from '@/components/common/toast'
import { PostMediaDisplay } from '@/components/common/post-media-display'
import { GroupPostForm } from '@/components/common/group-post-form'
import { useMediaDetail } from '@/components/common/media-detail-context'
import { mapMediaData } from '@/lib/media-utils'
import { GroupSettingsModal } from './group-settings-modal'
import { useGroupActivity } from '@/lib/api-hooks'
import { useQueryClient } from '@tanstack/react-query'


interface GroupProfileProps {
  group?: Group
  currentUser?: User
}

const GroupProfile: React.FC<GroupProfileProps> = ({ group, currentUser }) => {
  const params = useParams()
  const { showToast } = useToast()
  const { openMediaDetail } = useMediaDetail()
  const queryClient = useQueryClient()

  
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
  const [activeTab, setActiveTab] = useState<'feed' | 'about' | 'rules' | 'members' | 'management'>('feed')
  const [showApplyModal, setShowApplyModal] = useState(false)
  const [showPostModal, setShowPostModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState<{ postId: string; isOpen: boolean }>({ postId: '', isOpen: false })
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [applyMessage, setApplyMessage] = useState('')
  const [pendingApplications, setPendingApplications] = useState<any[]>([])
  const [membersWithStats, setMembersWithStats] = useState<any[]>([])
  const [isLoadingMembers, setIsLoadingMembers] = useState(false)

  const groupId = params?.identifier as string
  
  // Group activity hook
  const { data: groupActivity, isLoading: isLoadingActivity } = useGroupActivity(groupId, 10)



  useEffect(() => {
    console.log('useEffect: groupId changed to:', groupId)
    if (groupId) {
      loadGroupData()
    }
  }, [groupId])

  // Reload group data when currentUser becomes available
  useEffect(() => {
    console.log('useEffect: currentUser changed to:', currentUser?.id)
    if (groupId && currentUser) {
      console.log('useEffect: Reloading group data with currentUser')
      loadGroupData()
    }
  }, [groupId, currentUser])

  // Load detailed members when members tab is active
  useEffect(() => {
    if (activeTab === 'members' && isMember && (userRole === 'ADMIN' || userRole === 'OWNER')) {
      loadDetailedMembers()
    }
  }, [activeTab, isMember, userRole])

  const loadGroupData = async () => {
    try {
      setIsLoading(true)
      
      // Get authentication token
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') || undefined : undefined

      
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
      } else {
        console.error('loadGroupData: Failed to load group data:', groupData.error)
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
        // Invalidate activity cache to refresh the management timeline
        invalidateActivityCache()
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
      // Invalidate activity cache to refresh the management timeline
      invalidateActivityCache()
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

  const loadDetailedMembers = async () => {
    if (!isMember || (userRole !== 'ADMIN' && userRole !== 'OWNER')) {
      return
    }

    try {
      setIsLoadingMembers(true)
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') || undefined : undefined
      
      // Load members with detailed stats
      const membersResponse = await fetch(`${API_BASE_URL}/groups/${groupId}/members?detailed=true`, {
        headers: getAuthHeaders(token)
      })
      const membersData = await membersResponse.json()
      if (membersData.success) {
        setMembersWithStats(membersData.data.members)
      }

      // Load pending applications
      const applicationsResponse = await fetch(`${API_BASE_URL}/groups/${groupId}/applications`, {
        headers: getAuthHeaders(token)
      })
      const applicationsData = await applicationsResponse.json()
      if (applicationsData.success) {
        setPendingApplications(applicationsData.data.applications)
      }
    } catch (error) {
      console.error('Error loading detailed members:', error)
      showToast({
        type: 'error',
        message: 'Failed to load member details'
      })
    } finally {
      setIsLoadingMembers(false)
    }
  }

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') || undefined : undefined
      
      const response = await fetch(`${API_BASE_URL}/groups/${groupId}/members/${memberId}/role`, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ newRole })
      })

      if (response.ok) {
        showToast({
          type: 'success',
          message: 'Member role updated successfully'
        })
        // Reload member data
        loadDetailedMembers()
        loadGroupData()
        // Invalidate activity cache to refresh the management timeline
        invalidateActivityCache()
      } else {
        const errorData = await response.json()
        showToast({
          type: 'error',
          message: errorData.error || 'Failed to update member role'
        })
      }
    } catch (error) {
      console.error('Error updating member role:', error)
      showToast({
        type: 'error',
        message: 'Failed to update member role'
      })
    }
  }

  const handleApplicationReview = async (applicationId: string, action: 'approve' | 'reject', message?: string) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') || undefined : undefined
      
      const requestBody = { action, message }
      console.log('Sending application review request:', requestBody)
      
      const response = await fetch(`${API_BASE_URL}/groups/${groupId}/applications/${applicationId}`, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify(requestBody)
      })

      if (response.ok) {
        showToast({
          type: 'success',
          message: `Application ${action === 'approve' ? 'approved' : 'reject'} successfully`
        })
        
        if (action === 'approve') {
          // For approved applications, we need to refresh the members list immediately
          // since the new member should now appear in the list
          const token = typeof window !== 'undefined' ? localStorage.getItem('token') || undefined : undefined
          
          // Small delay to ensure database consistency
          await new Promise(resolve => setTimeout(resolve, 500))
          
          // Refresh members list
          const membersResponse = await fetch(`${API_BASE_URL}/groups/${groupId}/members`, {
            headers: getAuthHeaders(token)
          })
          const membersData = await membersResponse.json()
          if (membersData.success) {
            console.log('Updated members list after approval:', membersData.data.members)
            setMembers(membersData.data.members)
          }
        }
        
        // Reload detailed data
        loadDetailedMembers()
        loadGroupData()
        // Invalidate activity cache to refresh the management timeline
        invalidateActivityCache()
      } else {
        const errorData = await response.json()
        showToast({
          type: 'error',
          message: errorData.error || `Failed to ${action} application`
        })
        }
      } catch (error) {
        console.error(`Error ${action}ing application:`, error)
        showToast({
          type: 'error',
          message: `Failed to ${action} application`
        })
      }
    }

  const handleMediaClick = (media: any, allMedia?: any[]) => {
    // Handle nested PostMedia structure - extract the actual Media object
    const extractMediaData = (mediaItem: any) => {
      if (typeof mediaItem === 'string') {
        // If mediaItem is just an ID string, create a basic media object
        return {
          id: mediaItem,
          url: `${API_BASE_URL}/media/serve/${mediaItem}`,
          thumbnail: `${API_BASE_URL}/media/serve/${mediaItem}`,
          mediaType: 'IMAGE' as const
        }
      }
      
      // If mediaItem has a nested 'media' property (PostMedia structure), use that
      if (mediaItem.media && typeof mediaItem.media === 'object') {
        return {
          ...mediaItem.media,
          id: mediaItem.media.id || mediaItem.id // Use media.id if available, fallback to mediaItem.id
        }
      }
      
      // Otherwise, use the mediaItem directly
      return mediaItem
    }
    
    // Open the unified media detail modal
    if (allMedia && allMedia.length > 0) {
      // Map the media to ensure proper structure for the modal
      const mappedMedia = allMedia.map(extractMediaData)
      
      // Extract the current media data
      const currentMedia = extractMediaData(media)
      
      openMediaDetail(currentMedia, mappedMedia)
    } else {
      // Fallback to just the single media item
      const currentMedia = extractMediaData(media)
      openMediaDetail(currentMedia)
    }
  }



  // Handle post approval/rejection
  const handlePostApproval = async (postId: string, action: 'approve' | 'reject', reason?: string) => {
    try {
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No token found')

      const response = await fetch(`${API_BASE_URL}/groups/${groupId}/posts/${postId}/approve`, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ action, reason })
      })

      if (response.ok) {
        showToast({
          type: 'success',
          message: `Post ${action}d successfully`
        })
        // Reload group data to update the feed
        loadGroupData()
        // Invalidate activity cache to refresh the management timeline
        invalidateActivityCache()
        // Close reject modal if it was open
        if (action === 'reject') {
          setShowRejectModal({ postId: '', isOpen: false })
          setRejectReason('')
        }
      } else {
        const errorData = await response.json()
        showToast({
          type: 'error',
          message: errorData.error || `Failed to ${action} post`
        })
      }
    } catch (error) {
      console.error(`Error ${action}ing post:`, error)
      showToast({
        type: 'error',
        message: `Failed to ${action} post`
      })
    }
  }

  // Handle group settings update
  const handleGroupSettingsUpdate = (updatedGroup: Group) => {
    setGroupData(updatedGroup)
    setShowSettingsModal(false)
    // Invalidate activity cache to refresh the management timeline
    invalidateActivityCache()
    showToast({
      type: 'success',
      message: 'Group settings updated successfully'
    })
  }

  // Invalidate group activity cache to refresh the timeline
  const invalidateActivityCache = () => {
    queryClient.invalidateQueries({ queryKey: ['group-activity', groupId] })
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
        <div className="h-64 bg-gradient-to-r from-gray-800 to-gray-900 relative">
          {groupData.coverPhoto && (
            <img
              src={getGroupImageUrl(groupData.coverPhoto)}
              alt={`${groupData.name} cover`}
              className="w-full h-full object-cover"
            />
          )}
          
          {/* Group Info Overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-8">
            <div className="flex items-end space-x-4">
              {/* Avatar */}
                              <div className="relative">
                  <div className="w-24 h-24 border-4 border-white rounded-sm overflow-hidden shadow-lg">
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
                    <span className="absolute bottom-0 right-0 bg-olive-600 text-white text-sm font-bold rounded-sm w-8 h-8 flex items-center justify-center">
                      {groupData.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  {isMember && (
                    <span className="absolute -bottom-2 -right-2 bg-white text-gray-900 text-xs font-semibold px-3 py-1 rounded-sm shadow-md border border-gray-200">
                      {userRole.toUpperCase()}
                    </span>
                  )}
                </div>
              
              {/* Group Details */}
              <div className="flex-1 text-white">
                <h1 className="text-4xl font-bold mb-3 tracking-wide">{groupData.name}</h1>
                <p className="text-lg mb-4 text-gray-200">@{groupData.username}</p>
                <div className="flex items-center space-x-6 text-sm">
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-gray-300" />
                    <span className="font-medium">{members?.length || 0} MEMBERS</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-gray-300" />
                    <span className="font-medium">CREATED {formatDistanceToNow(new Date(groupData.createdAt)).toUpperCase()} AGO</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getVisibilityIcon()}
                    <span className="font-medium">{getVisibilityLabel().toUpperCase()}</span>
                  </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex space-x-3">
                {!isMember ? (
                  <button
                    onClick={handleJoinGroup}
                    className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-sm font-medium tracking-wide transition-colors duration-200"
                  >
                    {groupData.visibility === 'PUBLIC' ? 'JOIN GROUP' : 'REQUEST TO JOIN'}
                  </button>
                ) : (
                  <button className="bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 px-6 py-3 rounded-sm font-medium tracking-wide transition-colors duration-200">
                    <MessageSquare className="w-4 h-4 mr-2 inline" />
                    POST
                  </button>
                )}
                
                {isMember && (userRole === 'OWNER' || userRole === 'ADMIN') && (
                  <button 
                    onClick={() => setActiveTab('management')}
                    className="bg-olive-600 hover:bg-olive-700 text-white px-6 py-3 rounded-sm font-medium tracking-wide transition-colors duration-200"
                  >
                    <Settings className="w-4 h-4 mr-2 inline" />
                    MANAGE
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
            <div className="flex space-x-1 mb-6 border-b border-gray-200">
              <button
                onClick={() => setActiveTab('feed')}
                className={`px-6 py-3 text-sm font-medium tracking-wide transition-colors duration-200 ${
                  activeTab === 'feed' 
                    ? 'text-olive-700 border-b-2 border-olive-700 bg-olive-50' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                FEED
              </button>
              <button
                onClick={() => setActiveTab('about')}
                className={`px-6 py-3 text-sm font-medium tracking-wide transition-colors duration-200 ${
                  activeTab === 'about' 
                    ? 'text-olive-700 border-b-2 border-olive-700 bg-olive-50' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                ABOUT
              </button>
              <button
                onClick={() => setActiveTab('rules')}
                className={`px-6 py-3 text-sm font-medium tracking-wide transition-colors duration-200 ${
                  activeTab === 'rules' 
                    ? 'text-olive-700 border-b-2 border-olive-700 bg-olive-50' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                RULES
              </button>
              {isMember && (userRole === 'OWNER' || userRole === 'ADMIN') && (
                <button
                  onClick={() => setActiveTab('members')}
                  className={`px-6 py-3 text-sm font-medium tracking-wide transition-colors duration-200 ${
                    activeTab === 'members' 
                      ? 'text-olive-700 border-b-2 border-olive-700 bg-olive-50' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  MEMBERS
                </button>
              )}
              {isMember && (userRole === 'OWNER' || userRole === 'ADMIN') && (
                <button
                  onClick={() => setActiveTab('management')}
                  className={`px-6 py-3 text-sm font-medium tracking-wide transition-colors duration-200 ${
                    activeTab === 'management' 
                      ? 'text-olive-700 border-b-2 border-olive-700 bg-olive-50' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  MANAGEMENT
                </button>
              )}
            </div>
            
            {activeTab === 'feed' && (
              <div className="space-y-4">
                {/* Moderation Notice */}
                {isMember && groupData?.moderationPolicy === 'ADMIN_APPROVAL_REQUIRED' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <Shield className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">Moderation Notice</span>
                    </div>
                    <p className="text-sm text-blue-700 mt-1">
                      Posts in this group require admin approval before they appear publicly. Your posts will be visible to you and admins while pending.
                    </p>
                  </div>
                )}
                
                {/* Post Button - Only show for members */}
                {isMember && (
                  <div className="flex justify-center">
                    <button
                      onClick={() => setShowPostModal(true)}
                      className="px-8 py-3 bg-olive-600 hover:bg-olive-700 text-white rounded-sm font-medium tracking-wide transition-colors duration-200 flex items-center space-x-2"
                    >
                      <Plus className="w-5 h-5" />
                      <span>Create Post</span>
                    </button>
                  </div>
                )}
                
                {posts.length === 0 ? (
                  <div className="bg-white p-8 rounded-lg shadow-md text-center">
                    <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No posts yet</h3>
                    <p className="text-gray-600 mb-4">
                      {isMember ? 'Be the first to post something to this group!' : 'Join the group to see posts and start contributing.'}
                    </p>
                    {!isMember ? (
                      <button
                        onClick={() => setShowApplyModal(true)}
                        className="px-6 py-2 bg-olive-600 hover:bg-olive-700 text-white rounded-sm font-medium tracking-wide transition-colors duration-200"
                      >
                        <UserPlus className="w-4 h-4 mr-2 inline" />
                        Join Group to Post
                      </button>
                    ) : (
                      <div className="text-sm text-gray-500">
                        <p>Ready to start the conversation? Use the form above to create your first post!</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Call-to-action for non-members when there are posts */}
                    {!isMember && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <UserPlus className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-800">Join the group to post and interact</span>
                          </div>
                          <button
                            onClick={() => setShowApplyModal(true)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-sm font-medium transition-colors duration-200"
                          >
                            Join Group
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {posts.map((groupPost) => (
                    <div key={groupPost.id} className={`p-6 rounded-lg shadow-md ${
                      groupPost.status === 'PENDING_APPROVAL' 
                        ? 'bg-gray-100 border border-gray-300' 
                        : 'bg-white'
                    } ${groupPost.isPriority ? 'border-2 border-yellow-400' : ''}`}>
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
                        
                        <div className="flex items-center space-x-2">
                          {groupPost.status === 'PENDING_APPROVAL' && (
                            <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">
                              Pending Approval
                            </span>
                          )}
                          {groupPost.status === 'REJECTED' && (
                            <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                              Rejected
                            </span>
                          )}
                          {groupPost.status === 'APPROVED' && groupPost.isPriority && (
                            <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                              Priority
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className={`pt-4 border-t ${groupPost.status === 'PENDING_APPROVAL' ? 'bg-gray-50 p-4 rounded-lg' : ''}`}>
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

                        {/* Approval Actions - Only show for admins/owners on pending posts */}
                        {groupPost.status === 'PENDING_APPROVAL' && (userRole === 'ADMIN' || userRole === 'OWNER') && (
                          <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <Shield className="w-4 h-4 text-orange-600" />
                                <span className="text-sm font-medium text-orange-800">Post requires approval</span>
                              </div>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handlePostApproval(groupPost.post.id, 'approve')}
                                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded-sm font-medium transition-colors duration-200"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => setShowRejectModal({ postId: groupPost.post.id, isOpen: true })}
                                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded-sm font-medium transition-colors duration-200"
                                >
                                  Reject
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  </>
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

            {activeTab === 'management' && (
              <div className="space-y-6">
                {/* Management Header */}
                <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-olive-600">
                  <h3 className="flex items-center space-x-2 text-xl font-bold mb-2 text-gray-900">
                    <Settings className="w-6 h-6 text-olive-600" />
                    <span>GROUP MANAGEMENT</span>
                  </h3>
                  <p className="text-gray-600">Manage your group settings, members, and moderation policies.</p>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <h4 className="text-lg font-semibold mb-3 text-gray-900">MEMBERS</h4>
                    <p className="text-gray-600 mb-4">Manage group membership, roles, and applications.</p>
                    <button 
                      onClick={() => setActiveTab('members')}
                      className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-sm font-medium text-sm transition-colors duration-200"
                    >
                      MANAGE MEMBERS
                    </button>
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <h4 className="text-lg font-semibold mb-3 text-gray-900">SETTINGS</h4>
                    <p className="text-gray-600 mb-4">Update group information, visibility, and policies.</p>
                    {(userRole === 'ADMIN' || userRole === 'OWNER') ? (
                      <button 
                        onClick={() => setShowSettingsModal(true)}
                        className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-sm font-medium text-sm transition-colors duration-200"
                      >
                        EDIT SETTINGS
                      </button>
                    ) : (
                      <button 
                        disabled
                        className="bg-gray-400 text-white px-4 py-2 rounded-sm font-medium text-sm cursor-not-allowed"
                        title="Only admins and owners can edit group settings"
                      >
                        EDIT SETTINGS
                      </button>
                    )}
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <h4 className="text-lg font-semibold mb-3 text-gray-900">MODERATION</h4>
                    <p className="text-gray-600 mb-4">Review posts, manage content, and handle reports.</p>
                    <button className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-sm font-medium text-sm transition-colors duration-200">
                      MODERATE CONTENT
                    </button>
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <h4 className="text-lg font-semibold mb-3 text-gray-900">ANALYTICS</h4>
                    <p className="text-gray-600 mb-4">View group activity, engagement, and growth metrics.</p>
                    <button className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-sm font-medium text-sm transition-colors duration-200">
                      VIEW ANALYTICS
                    </button>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-gray-900">RECENT ACTIVITY</h4>
                    <button
                      onClick={invalidateActivityCache}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                      title="Refresh activity timeline"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                  <div className="space-y-3">
                    {isLoadingActivity ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-olive-600 mx-auto"></div>
                      </div>
                    ) : groupActivity && groupActivity.length > 0 ? (
                      groupActivity.map((activity: any) => (
                        <div key={activity.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-sm">
                          <div className="w-2 h-2 bg-olive-600 rounded-full"></div>
                          <div className="flex-1 min-w-0">
                            {activity.type === 'action' && (
                              <span className="text-sm text-gray-600">{activity.description}</span>
                            )}
                            {activity.type === 'post' && (
                              <div>
                                <span className="text-sm text-gray-600">
                                  {activity.status === 'PENDING_APPROVAL' && 'Post submitted for approval'}
                                  {activity.status === 'APPROVED' && 'Post approved'}
                                  {activity.status === 'REJECTED' && 'Post rejected'}
                                </span>
                                {activity.post && (
                                  <div className="text-xs text-gray-500 mt-1 truncate">
                                    "{activity.post.title || activity.post.content.substring(0, 50)}..."
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 text-xs text-gray-400">
                            {activity.user && (
                              <span className="text-olive-600 font-medium">
                                {activity.user.name}
                              </span>
                            )}
                            <span>{formatDistanceToNow(new Date(activity.timestamp))} ago</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <div className="w-8 h-8 bg-gray-200 rounded-full mx-auto mb-2"></div>
                        <p>No recent activity</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'members' && (
              <div className="space-y-6">
                {/* Members Header */}
                <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-olive-600">
                  <h3 className="flex items-center space-x-2 text-xl font-bold mb-2 text-gray-900">
                    <Users className="w-6 h-6 text-olive-600" />
                    <span>MEMBER MANAGEMENT</span>
                  </h3>
                  <p className="text-gray-600">Manage group membership, roles, and review pending applications.</p>
                </div>

                {/* Pending Applications */}
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                  <h4 className="text-lg font-semibold mb-4 text-gray-900">PENDING APPLICATIONS</h4>
                  <div className="space-y-4">
                    {isLoadingMembers ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-olive-600 mx-auto"></div>
                      </div>
                    ) : pendingApplications.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <UserPlus className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>No pending applications</p>
                      </div>
                    ) : (
                      pendingApplications.map((application) => (
                        <div key={application.id} className="border border-gray-200 rounded-sm p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 rounded-sm overflow-hidden bg-gray-200 flex items-center justify-center">
                                {application.applicant.avatar ? (
                                  <img
                                    src={application.applicant.avatar}
                                    alt={application.applicant.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className="text-sm font-bold bg-olive-600 text-white w-10 h-10 flex items-center justify-center">
                                    {application.applicant.name.charAt(0).toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{application.applicant.name}</p>
                                <p className="text-sm text-gray-500">@{application.applicant.username}</p>
                                <a 
                                  href={`/user/${application.applicant.username}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-olive-600 hover:text-olive-700 underline"
                                >
                                  View Profile →
                                </a>
                              </div>
                            </div>
                            <span className="text-xs text-gray-400">
                              {formatDistanceToNow(new Date(application.createdAt))} ago
                            </span>
                          </div>
                          
                          {/* Applicant History */}
                          {application.applicantHistory && (
                            <div className="mb-4 p-3 bg-gray-50 rounded-sm">
                              <h5 className="text-sm font-semibold text-gray-700 mb-2">APPLICANT HISTORY</h5>
                              
                              {/* Quick Summary */}
                              <div className="mb-3 p-2 bg-white border border-gray-200 rounded-sm">
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                  <div>
                                    <span className="font-medium text-gray-700">Total Posts:</span>
                                    <span className="ml-2 text-gray-600">{application.applicantHistory.totalPosts}</span>
                                  </div>
                                  <div>
                                    <span className="font-medium text-gray-700">Total Comments:</span>
                                    <span className="ml-2 text-gray-600">{application.applicantHistory.totalComments}</span>
                                  </div>
                                  <div>
                                    <span className="font-medium text-gray-700">Group Actions:</span>
                                    <span className="ml-2 text-gray-600">{application.applicantHistory.groupActions.length}</span>
                                  </div>
                                  <div>
                                    <span className="font-medium text-gray-700">Previous Member:</span>
                                    <span className={`ml-2 ${application.applicantHistory.previousMembership ? 'text-yellow-600 font-medium' : 'text-gray-500'}`}>
                                      {application.applicantHistory.previousMembership ? 'Yes' : 'No'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Previous Membership Status */}
                              {application.applicantHistory.previousMembership && (
                                <div className="mb-2">
                                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-sm bg-yellow-100 text-yellow-800">
                                    ⚠️ Previously a member
                                  </span>
                                  <span className="text-xs text-gray-500 ml-2">
                                    Joined {formatDistanceToNow(new Date(application.applicantHistory.previousMembership.joinedAt))} ago
                                  </span>
                                </div>
                              )}
                              
                              {/* Group Actions History */}
                              {application.applicantHistory.groupActions.length > 0 && (
                                <div className="mb-2">
                                  <p className="text-xs text-gray-600 mb-1">Recent group actions:</p>
                                  <div className="space-y-1">
                                    {application.applicantHistory.groupActions.slice(0, 3).map((action: any, index: number) => {
                                      const getActionIcon = (actionType: string) => {
                                        switch (actionType) {
                                          case 'MEMBER_JOINED': return '👋'
                                          case 'MEMBER_LEFT': return '👋'
                                          case 'MEMBER_BANNED': return '🚫'
                                          case 'MEMBER_UNBANNED': return '✅'
                                          case 'ROLE_CHANGED': return '🔄'
                                          case 'POST_CREATED': return '📝'
                                          case 'POST_DELETED': return '🗑️'
                                          case 'COMMENT_CREATED': return '💬'
                                          case 'COMMENT_DELETED': return '🗑️'
                                          case 'APPLICATION_APPROVED': return '✅'
                                          case 'APPLICATION_REJECTED': return '❌'
                                          default: return '📋'
                                        }
                                      }
                                      
                                      const getActionColor = (actionType: string) => {
                                        if (actionType.includes('BANNED') || actionType.includes('REJECTED') || actionType.includes('DELETED')) {
                                          return 'bg-red-100 text-red-800'
                                        } else if (actionType.includes('APPROVED') || actionType.includes('UNBANNED')) {
                                          return 'bg-green-100 text-green-800'
                                        } else if (actionType.includes('JOINED') || actionType.includes('CREATED')) {
                                          return 'bg-blue-100 text-blue-800'
                                        } else {
                                          return 'bg-gray-100 text-gray-800'
                                        }
                                      }
                                      
                                      return (
                                        <div key={index} className="text-xs text-gray-500 flex items-center space-x-2">
                                          <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                                          <span className="mr-1">{getActionIcon(action.actionType)}</span>
                                          <span className={`inline-flex px-2 py-1 rounded-sm text-xs font-medium ${getActionColor(action.actionType)}`}>
                                            {action.actionType.toLowerCase().replace(/_/g, ' ')}
                                          </span>
                                          <span>•</span>
                                          <span>{formatDistanceToNow(new Date(action.createdAt))} ago</span>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
                              
                              {/* Overall Activity Stats */}
                              <div className="flex space-x-4 text-xs text-gray-600">
                                <span>Posts: {application.applicantHistory.totalPosts}</span>
                                <span>Comments: {application.applicantHistory.totalComments}</span>
                              </div>
                            </div>
                          )}
                          
                          <p className="text-gray-700 mb-4">{application.message}</p>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleApplicationReview(application.id, 'approve')}
                              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-sm font-medium text-sm transition-colors duration-200"
                            >
                              APPROVE
                            </button>
                            <button
                              onClick={() => handleApplicationReview(application.id, 'reject')}
                              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-sm font-medium text-sm transition-colors duration-200"
                            >
                              REJECT
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Current Members */}
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                  <h4 className="text-lg font-semibold mb-4 text-gray-900">CURRENT MEMBERS</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-semibold text-gray-900">MEMBER</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-900">ROLE</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-900">JOINED</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-900">POSTS</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-900">RECENT ACTIVITY</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-900">REACTIONS</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-900">STATUS</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-900">ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {isLoadingMembers ? (
                          <tr>
                            <td colSpan={8} className="py-8 text-center">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-olive-600 mx-auto"></div>
                            </td>
                          </tr>
                        ) : (membersWithStats.length > 0 ? membersWithStats : members).map((member) => {
                          const hasStats = 'stats' in member
                          const stats = hasStats ? member.stats : null
                          
                          return (
                            <tr key={member.id} className="hover:bg-gray-50 transition-colors duration-200">
                              <td className="py-4 px-4">
                                <div className="flex items-center space-x-3">
                                  <div className="w-10 h-10 rounded-sm overflow-hidden bg-gray-200 flex items-center justify-center">
                                    {member.user.avatar ? (
                                      <img
                                        src={member.user.avatar}
                                        alt={member.user.name}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <span className="text-sm font-bold bg-olive-600 text-white w-10 h-10 flex items-center justify-center">
                                        {member.user.name.charAt(0).toUpperCase()}
                                      </span>
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900">{member.user.name}</p>
                                    <p className="text-sm text-gray-500">@{member.user.username}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-4">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-sm ${
                                  member.role === 'OWNER' ? 'bg-red-100 text-red-800' :
                                  member.role === 'ADMIN' ? 'bg-blue-100 text-blue-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {member.role}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-sm text-gray-600">
                                {formatDistanceToNow(new Date(member.joinedAt))} ago
                              </td>
                              <td className="py-4 px-4 text-sm text-gray-600">
                                {hasStats ? (
                                  <div>
                                    <div className="font-medium">{stats.totalPosts}</div>
                                    <div className="text-xs text-gray-400">+{stats.recentPosts} (90d)</div>
                                  </div>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="py-4 px-4 text-sm text-gray-600">
                                {hasStats ? (
                                  <div>
                                    <div className="font-medium">{stats.totalComments}</div>
                                    <div className="text-xs text-gray-400">+{stats.recentComments} (90d)</div>
                                  </div>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="py-4 px-4 text-sm text-gray-600">
                                {hasStats ? (
                                  <div>
                                    <div className="font-medium">+{stats.reactionsReceived}</div>
                                    <div className="text-xs text-gray-400">Given: {stats.reactionsGiven}</div>
                                  </div>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="py-4 px-4">
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-sm bg-green-100 text-green-800">
                                  ACTIVE
                                </span>
                              </td>
                              <td className="py-4 px-4">
                                <div className="flex space-x-2">
                                  {userRole === 'OWNER' && member.role === 'ADMIN' && (
                                    <button 
                                      onClick={() => handleRoleChange(member.userId, 'OWNER')}
                                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-sm transition-colors duration-200"
                                    >
                                      PROMOTE TO OWNER
                                    </button>
                                  )}
                                  {userRole === 'OWNER' && member.role === 'MEMBER' && (
                                    <button 
                                      onClick={() => handleRoleChange(member.userId, 'ADMIN')}
                                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-sm transition-colors duration-200"
                                    >
                                      PROMOTE TO ADMIN
                                    </button>
                                  )}
                                  {userRole === 'OWNER' && member.role === 'ADMIN' && (
                                    <button 
                                      onClick={() => handleRoleChange(member.userId, 'MEMBER')}
                                      className="text-xs bg-yellow-600 hover:bg-yellow-700 text-white px-2 py-1 rounded-sm transition-colors duration-200"
                                    >
                                      DEMOTE TO MEMBER
                                    </button>
                                  )}
                                  {userRole === 'ADMIN' && member.role === 'MEMBER' && (
                                    <button 
                                      onClick={() => handleRoleChange(member.userId, 'ADMIN')}
                                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-sm transition-colors duration-200"
                                    >
                                      PROMOTE TO ADMIN
                                    </button>
                                  )}
                                  {userRole === 'ADMIN' && member.role === 'ADMIN' && (
                                    <button 
                                      onClick={() => handleRoleChange(member.userId, 'MEMBER')}
                                      className="text-xs bg-yellow-600 hover:bg-yellow-700 text-white px-2 py-1 rounded-sm transition-colors duration-200"
                                    >
                                      DEMOTE TO MEMBER
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Sidebar */}
          <div className="space-y-6">
            {/* Group Stats */}
            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 tracking-wide">GROUP STATS</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-sm">
                  <span className="text-gray-600 font-medium">MEMBERS</span>
                  <span className="font-bold text-gray-900">
                    {members?.length || 0}
                    {members && <span className="text-xs text-gray-400 ml-1">({members.map(m => m.user.username).join(', ')})</span>}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-sm">
                  <span className="text-gray-600 font-medium">POSTS</span>
                  <span className="font-bold text-gray-900">{posts.length}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-sm">
                  <span className="text-gray-600 font-medium">CREATED</span>
                  <span className="font-bold text-gray-900">
                    {formatDistanceToNow(new Date(groupData.createdAt)).toUpperCase()} AGO
                  </span>
                </div>
              </div>
            </div>
            

            
            {/* Recent Members */}
            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 tracking-wide">RECENT MEMBERS</h3>
              <div className="space-y-3">
                {members && members.slice(0, 5).map((member) => (
                  <div key={member.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-sm transition-colors duration-200">
                    <div className="w-8 h-8 rounded-sm overflow-hidden bg-gray-200 flex items-center justify-center">
                      {member.user.avatar ? (
                        <img
                          src={member.user.avatar}
                          alt={member.user.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-bold bg-olive-600 text-white w-8 h-8 flex items-center justify-center">
                          {member.user.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {member.user.name}
                      </p>
                      <p className="text-xs text-gray-500 font-medium">
                        {member.role.toUpperCase()} • {formatDistanceToNow(new Date(member.joinedAt)).toUpperCase()} AGO
                      </p>
                    </div>
                  </div>
                ))}
                
                {members && members.length > 5 && (
                  <button className="w-full mt-3 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-sm font-medium text-sm transition-colors duration-200">
                    <UserPlus className="w-4 h-4 mr-2 inline" />
                    VIEW ALL MEMBERS
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reject Post Modal */}
      {showRejectModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-sm shadow-xl w-full max-w-md border border-gray-200">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900 tracking-wide">Reject Post</h3>
              <button
                onClick={() => setShowRejectModal({ postId: '', isOpen: false })}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-gray-600 mb-4">Please provide a reason for rejecting this post:</p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for rejection..."
                className="w-full p-3 border border-gray-300 rounded-sm resize-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors duration-200"
                rows={3}
              />
            </div>
            
            <div className="flex space-x-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowRejectModal({ postId: '', isOpen: false })}
                className="flex-1 bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 px-6 py-3 rounded-sm font-medium tracking-wide transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handlePostApproval(showRejectModal.postId, 'reject', rejectReason)}
                disabled={!rejectReason.trim()}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-sm font-medium tracking-wide transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reject Post
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Post Modal */}
      {showPostModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-sm shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-gray-200">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-bold text-gray-900 tracking-wide">Create Post in {groupData?.name}</h3>
                {groupData?.moderationPolicy && groupData.moderationPolicy !== 'NO_MODERATION' && (
                  <p className="text-sm text-blue-600 mt-1">
                    {groupData.moderationPolicy === 'ADMIN_APPROVAL_REQUIRED' 
                      ? 'Post will be reviewed by moderators before appearing in the feed.'
                      : groupData.moderationPolicy === 'AI_FILTER'
                      ? 'Post will be automatically filtered and may require review.'
                      : 'Post may require moderation based on group rules.'
                    }
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowPostModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              <GroupPostForm
                groupId={groupId}
                groupName={groupData?.name || ''}
                onPostCreated={() => {
                  setShowPostModal(false)
                  loadGroupData()
                  // Invalidate activity cache to refresh the management timeline
                  invalidateActivityCache()
                  showToast({
                    type: 'success',
                    message: 'Post created successfully! It will be reviewed by moderators if required.'
                  })
                }}
                availableGroupFeeds={[]}
                allowLockedPosts={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* Apply to Join Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-sm shadow-xl p-8 w-full max-w-md mx-4 border border-gray-200">
            <h3 className="text-xl font-bold mb-4 text-gray-900 tracking-wide">REQUEST TO JOIN {groupData.name}</h3>
            <p className="text-gray-600 mb-6">
              This is a private group. Please provide a message explaining why you'd like to join.
            </p>
            
            <textarea
              value={applyMessage}
              onChange={(e) => setApplyMessage(e.target.value)}
              placeholder="Tell us why you'd like to join this group..."
              className="w-full p-4 border border-gray-300 rounded-sm resize-none h-24 mb-6 focus:ring-2 focus:ring-olive-500 focus:border-olive-500 transition-colors duration-200"
            />
            
            <div className="flex space-x-3">
              <button
                onClick={handleApplyToJoin}
                className="flex-1 bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-sm font-medium tracking-wide transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!applyMessage.trim()}
              >
                SUBMIT APPLICATION
              </button>
              <button
                onClick={() => setShowApplyModal(false)}
                className="flex-1 bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 px-6 py-3 rounded-sm font-medium tracking-wide transition-colors duration-200"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Settings Modal */}
      {showSettingsModal && (
        <GroupSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          group={groupData!}
          onGroupUpdated={handleGroupSettingsUpdate}
        />
      )}
    </div>
  )
}

export default GroupProfile 