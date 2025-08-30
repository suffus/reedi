'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { API_BASE_URL, getAuthHeaders } from '@/lib/api'
import { Group } from '@/lib/types'
import { 
  Search, 
  Users, 
  Globe, 
  Eye, 
  EyeOff, 
  Plus,
  Filter,
  Grid3X3,
  List
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import CreateGroupModal from '@/components/create-group-modal'

const GroupsPage: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([])
  const [filteredGroups, setFilteredGroups] = useState<Group[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<string>('')
  const [selectedVisibility, setSelectedVisibility] = useState<string>('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  })

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

  useEffect(() => {
    loadGroups()
  }, [pagination.page])

  useEffect(() => {
    filterGroups()
  }, [groups, searchQuery, selectedType, selectedVisibility])

  const loadGroups = async () => {
    try {
      setIsLoading(true)
      
      // Get authentication token
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') || undefined : undefined
      
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      })

      if (searchQuery) params.append('q', searchQuery)
      if (selectedType) params.append('type', selectedType)
      if (selectedVisibility) params.append('visibility', selectedVisibility)

      let response: Response
      let endpoint: string

      if (token) {
        // Try authenticated search first (includes all groups user can see)
        endpoint = 'search'
        response = await fetch(`${API_BASE_URL}/groups/search?${params.toString()}`, {
          headers: getAuthHeaders(token)
        })
        
        if (response.status === 401) {
          // Token expired or invalid, try public endpoint
          endpoint = 'public'
          response = await fetch(`${API_BASE_URL}/groups/public?${params.toString()}`)
        }
      } else {
        // No token, use public endpoint
        endpoint = 'public'
        response = await fetch(`${API_BASE_URL}/groups/public?${params.toString()}`)
      }
      
      if (response.ok) {
        const data = await response.json()
        setGroups(data.data.groups)
        setPagination(prev => ({
          ...prev,
          total: data.data.pagination.total,
          pages: data.data.pagination.pages
        }))
        
        // Log which endpoint was used for debugging
        console.log(`Groups loaded from ${endpoint} endpoint`)
      } else {
        console.error(`Failed to load groups from ${endpoint} endpoint:`, response.status)
      }
    } catch (error) {
      console.error('Error loading groups:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filterGroups = () => {
    let filtered = [...groups]

    if (searchQuery) {
      filtered = filtered.filter(group =>
        group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        group.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        group.username.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    if (selectedType) {
      filtered = filtered.filter(group => group.type === selectedType)
    }

    if (selectedVisibility) {
      filtered = filtered.filter(group => group.visibility === selectedVisibility)
    }

    setFilteredGroups(filtered)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPagination(prev => ({ ...prev, page: 1 }))
    loadGroups()
  }

  const handleGroupCreated = (group: Group) => {
    // Refresh the groups list
    setPagination(prev => ({ ...prev, page: 1 }))
    loadGroups()
  }

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case 'PUBLIC':
        return <Globe className="w-4 h-4" />
      case 'PRIVATE_VISIBLE':
        return <Eye className="w-4 h-4" />
      case 'PRIVATE_HIDDEN':
        return <EyeOff className="w-4 h-4" />
      default:
        return <Globe className="w-4 h-4" />
    }
  }

  const getVisibilityLabel = (visibility: string) => {
    switch (visibility) {
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

  const getTypeLabel = (type: string) => {
    switch (type) {
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

  const getVisibilityColor = (visibility: string) => {
    switch (visibility) {
      case 'PUBLIC':
        return 'bg-green-100 text-green-800'
      case 'PRIVATE_VISIBLE':
        return 'bg-yellow-100 text-yellow-800'
      case 'PRIVATE_HIDDEN':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (isLoading && groups.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Groups</h1>
              <p className="text-gray-600 mt-2">Discover and join communities that interest you</p>
              {typeof window !== 'undefined' && !localStorage.getItem('token') && (
                <p className="text-sm text-blue-600 mt-1">
                  🔒 Showing public groups only. <Link href="/" className="underline hover:text-blue-800">Sign in</Link> to see all groups you have access to.
                </p>
              )}
            </div>
            <button onClick={() => setShowCreateModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md">
              <Plus className="w-4 h-4 mr-2" />
              Create Group
            </button>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search groups..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </form>

            {/* Filters */}
            <div className="flex gap-3">
              <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="w-40">
                <option value="">All Types</option>
                <option value="GENERAL">General</option>
                <option value="SOCIAL_LEARNING">Social Learning</option>
                <option value="GAMING">Gaming</option>
                <option value="JOBS">Jobs</option>
                <option value="BUY_SELL">Buy & Sell</option>
                <option value="PARENTING">Parenting</option>
                <option value="WORK">Work</option>
              </select>

              <select value={selectedVisibility} onChange={(e) => setSelectedVisibility(e.target.value)} className="w-40">
                <option value="">All Visibility</option>
                <option value="PUBLIC">Public</option>
                {typeof window !== 'undefined' && localStorage.getItem('token') && (
                  <>
                    <option value="PRIVATE_VISIBLE">Private (Visible)</option>
                    <option value="PRIVATE_HIDDEN">Private (Hidden)</option>
                  </>
                )}
              </select>

              {/* View Mode Toggle */}
              <div className="flex border rounded-lg">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-r-none ${viewMode === 'grid' ? 'bg-gray-200' : ''}`}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-l-none ${viewMode === 'list' ? 'bg-gray-200' : ''}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Groups Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {filteredGroups.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No groups found</h3>
            <p className="text-gray-600 mb-6">
              {searchQuery || selectedType || selectedVisibility 
                ? 'Try adjusting your search criteria or filters.'
                : 'Be the first to create a group in your area of interest!'
              }
            </p>
            {!searchQuery && !selectedType && !selectedVisibility && (
              <button onClick={() => setShowCreateModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md">
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Group
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Results Count */}
            <div className="flex items-center justify-between mb-6">
              <p className="text-gray-600">
                Showing {filteredGroups.length} of {pagination.total} groups
              </p>
              <p className="text-sm text-gray-500">
                Page {pagination.page} of {pagination.pages}
              </p>
            </div>

            {/* Groups Grid/List */}
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredGroups.map((group) => (
                  <Link key={group.id} href={`/groups/${group.username}`}>
                    <div className="h-full hover:shadow-lg transition-shadow cursor-pointer group">
                      {/* Cover Photo */}
                      <div className="h-32 bg-gradient-to-r from-blue-500 to-purple-600 relative overflow-hidden rounded-t-lg">
                        {group.coverPhoto && (
                          <img
                            src={getGroupImageUrl(group.coverPhoto)}
                            alt={`${group.name} cover`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        )}
                        <div className="absolute top-3 right-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getVisibilityColor(group.visibility)}`}>
                            {getVisibilityIcon(group.visibility)}
                            <span className="ml-1">{getVisibilityLabel(group.visibility)}</span>
                          </span>
                        </div>
                      </div>

                      <div className="p-3">
                        <div className="flex items-start space-x-3">
                          <div className="w-12 h-12 -mt-6 border-4 border-white rounded-full overflow-hidden">
                            <img src={getGroupImageUrl(group.avatar)} alt={group.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold group-hover:text-blue-600 transition-colors">
                              {group.name}
                            </h3>
                            <p className="text-sm text-gray-500">@{group.username}</p>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 pt-0">
                        {group.description && (
                          <p className="text-gray-700 mb-4 line-clamp-2">
                            {group.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between text-sm text-gray-500">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-1">
                              <Users className="w-4 h-4" />
                              <span>{group._count?.members || 0} members</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <span>•</span>
                              <span>{group._count?.posts || 0} posts</span>
                            </div>
                          </div>
                          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-800">
                            {getTypeLabel(group.type)}
                          </span>
                        </div>

                        <div className="mt-3 text-xs text-gray-400">
                          Created {formatDistanceToNow(new Date(group.createdAt))} ago
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredGroups.map((group) => (
                  <Link key={group.id} href={`/groups/${group.username}`}>
                    <div className="hover:shadow-md transition-shadow cursor-pointer group">
                      <div className="p-6">
                        <div className="flex items-center space-x-4">
                          <div className="w-16 h-16 rounded-full overflow-hidden">
                            <img src={getGroupImageUrl(group.avatar)} alt={group.name} className="w-full h-full object-cover" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-3 mb-2">
                              <h3 className="text-xl font-semibold group-hover:text-blue-600 transition-colors">
                                {group.name}
                              </h3>
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getVisibilityColor(group.visibility)}`}>
                                {getVisibilityIcon(group.visibility)}
                                <span className="ml-1">{getVisibilityLabel(group.visibility)}</span>
                              </span>
                              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-800">
                                {getTypeLabel(group.type)}
                              </span>
                            </div>
                            
                            <p className="text-gray-500 mb-1">@{group.username}</p>
                            
                            {group.description && (
                              <p className="text-gray-700 mb-3 line-clamp-2">
                                {group.description}
                              </p>
                            )}
                            
                            <div className="flex items-center space-x-6 text-sm text-gray-500">
                              <div className="flex items-center space-x-1">
                                <Users className="w-4 h-4" />
                                <span>{group._count?.members || 0} members</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <span>•</span>
                                <span>{group._count?.posts || 0} posts</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <span>•</span>
                                <span>Created {formatDistanceToNow(new Date(group.createdAt))} ago</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-center space-x-2 mt-8">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  disabled={pagination.page === 1}
                  className="px-3 py-2 rounded-md text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                    const pageNum = i + 1
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPagination(prev => ({ ...prev, page: pageNum }))}
                        className={`px-3 py-2 rounded-md text-gray-700 hover:bg-gray-200 ${pagination.page === pageNum ? 'bg-blue-600 text-white' : ''}`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>
                
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.min(pagination.pages, prev.page + 1) }))}
                  disabled={pagination.page === pagination.pages}
                  className="px-3 py-2 rounded-md text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onGroupCreated={handleGroupCreated}
      />
    </div>
  )
}

export default GroupsPage 