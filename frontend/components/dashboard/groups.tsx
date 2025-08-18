'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Users, Plus, Search, Grid, List, Calendar, User } from 'lucide-react'
import { useAuth } from '../../lib/api-hooks'
import { useToast } from '../common/toast'
import { Group } from '../../lib/types'
import CreateGroupModal from '../create-group-modal'
import { API_BASE_URL, getAuthHeaders } from '../../lib/api'

export function Groups() {
  const router = useRouter()
  const { data: authData } = useAuth()
  const { showToast } = useToast()
  const [groups, setGroups] = useState<Group[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (authData?.data?.user?.id) {
      fetchUserGroups()
    }
  }, [authData])

  const fetchUserGroups = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') || undefined : undefined
      const response = await fetch(`${API_BASE_URL}/groups/user/${authData?.data?.user?.id}`, {
        headers: getAuthHeaders(token)
      })

      if (response.ok) {
        const data = await response.json()
        console.log('User groups response:', data)
        console.log('Setting groups to:', data.data?.groups || [])
        setGroups(data.data?.groups || [])
      } else {
        const errorData = await response.text()
        console.error('Failed to fetch user groups:', response.status, errorData)
      }
    } catch (error) {
      console.error('Error fetching user groups:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateGroup = () => {
    setShowCreateModal(true)
  }

  const handleGroupCreated = (newGroup: Group) => {
    setGroups(prev => [newGroup, ...prev])
    setShowCreateModal(false)
    showToast({
      type: 'success',
      message: 'Group created successfully!'
    })
  }

  const handleFindGroups = () => {
    router.push('/groups')
  }

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    group.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

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

  // Helper function to get group cover photo URL
  const getGroupCoverUrl = (coverPhoto: string | undefined): string => {
    if (!coverPhoto) return ''
    
    // If it's already a full URL, return as is
    if (coverPhoto.startsWith('http://') || coverPhoto.startsWith('https://')) {
      return coverPhoto
    }
    
    // If it's a data URL, return as is
    if (coverPhoto.startsWith('data:')) {
      return coverPhoto
    }
    
    // For group cover photos, use the public media serving endpoint (no auth required)
    return `${API_BASE_URL}/media/serve/${coverPhoto}`
  }
  
  console.log('Groups state:', groups)
  console.log('Filtered groups:', filteredGroups)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Groups</h2>
          <p className="text-gray-600">Manage and participate in your communities</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleCreateGroup}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>New Group</span>
          </button>
          <button
            onClick={handleFindGroups}
            className="btn-secondary flex items-center space-x-2"
          >
            <Search className="h-4 w-4" />
            <span>Find Groups</span>
          </button>
        </div>
      </div>

      {/* Search and View Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search your groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'grid' ? 'bg-primary-100 text-primary-700' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Grid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'list' ? 'bg-primary-100 text-primary-700' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Groups Content */}
      {filteredGroups.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12"
        >
          <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No groups yet</h3>
          <p className="text-gray-600 mb-6">
            You haven't joined any groups yet. Create your own community or discover existing ones.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleCreateGroup}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Create Your First Group</span>
            </button>
            <button
              onClick={handleFindGroups}
              className="btn-secondary flex items-center space-x-2"
            >
              <Search className="h-4 w-4" />
              <span>Discover Groups</span>
            </button>
          </div>
        </motion.div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
          {filteredGroups.map((group) => (
            <motion.div
              key={group.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer ${
                viewMode === 'list' ? 'flex' : ''
              }`}
              onClick={() => router.push(`/groups/${group.username}`)}
            >
              {viewMode === 'grid' ? (
                <>
                  <div 
                    className="aspect-video relative flex items-center justify-center overflow-hidden"
                    style={{
                      backgroundImage: group.coverPhoto ? `url(${getGroupCoverUrl(group.coverPhoto)})` : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat'
                    }}
                  >
                    {/* Fallback gradient background if no cover photo */}
                    {!group.coverPhoto && (
                      <div className="absolute inset-0 bg-gradient-to-br from-primary-100 to-accent-100" />
                    )}
                    
                    {/* Subtle overlay for better avatar visibility */}
                    {group.coverPhoto && (
                      <div className="absolute inset-0 bg-black bg-opacity-20" />
                    )}
                    
                    {/* White circle background for avatar */}
                    <div className="relative z-10 w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg">
                      {group.avatar ? (
                        <img 
                          src={getGroupImageUrl(group.avatar)} 
                          alt={group.name} 
                          className="w-16 h-16 rounded-full object-cover" 
                        />
                      ) : (
                        <Users className="h-16 w-16 text-primary-400" />
                      )}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-2">{group.name}</h3>
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                      {group.description || 'No description available'}
                    </p>
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span className="flex items-center space-x-1">
                        <Users className="h-4 w-4" />
                        <span>{group._count?.members || 0} members</span>
                      </span>
                      <span className="capitalize">{group.visibility.replace('_', ' ').toLowerCase()}</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 bg-gradient-to-br from-primary-100 to-accent-100 flex items-center justify-center flex-shrink-0">
                    {/* White circle background for avatar */}
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg">
                      {group.avatar ? (
                        <img 
                          src={getGroupImageUrl(group.avatar)} 
                          alt={group.name} 
                          className="w-12 h-12 rounded-full object-cover" 
                        />
                      ) : (
                        <Users className="h-12 w-12 text-primary-400" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1 p-4">
                    <h3 className="font-semibold text-gray-900 mb-1">{group.name}</h3>
                    <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                      {group.description || 'No description available'}
                    </p>
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span className="flex items-center space-x-1">
                        <Users className="h-4 w-4" />
                        <span>{group._count?.members || 0} members</span>
                      </span>
                      <span className="capitalize">{group.visibility.replace('_', ' ').toLowerCase()}</span>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <CreateGroupModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onGroupCreated={handleGroupCreated}
        />
      )}
    </div>
  )
} 