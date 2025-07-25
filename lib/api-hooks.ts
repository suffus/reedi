import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useCallback } from 'react'
import { API_BASE_URL, getAuthHeaders, getImageUrl, API_ENDPOINTS } from './api'
import { GalleryMedia, Comment } from './types'

// Helper functions to safely access localStorage
const getToken = () => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

const hasToken = () => {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem('token')
}

// Hook to handle hydration safely
const useIsClient = () => {
  const [isClient, setIsClient] = useState(false)
  
  useEffect(() => {
    setIsClient(true)
  }, [])
  
  return isClient
}

// Types
interface User {
  id: string
  name: string
  email: string
  username: string | null
  avatar: string | null
  bio: string | null
  location: string | null
  website: string | null
  isVerified: boolean
}

interface Post {
  id: string
  title: string | null
  content: string
  publicationStatus: 'PUBLIC' | 'PAUSED' | 'CONTROLLED' | 'DELETED'
  visibility: 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE'
  authorId: string
  createdAt: string
  updatedAt: string
  author: User
  comments: PostComment[]
  reactions: Reaction[]
  media: Media[]
  hashtags: Hashtag[]
  _count: {
    comments: number
    reactions: number
  }
}

interface PostComment {
  id: string
  content: string
  postId: string
  authorId: string
  parentId: string | null
  createdAt: string
  updatedAt: string
  author: User
  replies: PostComment[]
  reactions: Reaction[]
}

interface Reaction {
  id: string
  type: 'LIKE' | 'LOVE' | 'HAHA' | 'WOW' | 'SAD' | 'ANGRY'
  postId: string | null
  commentId: string | null
  authorId: string
  createdAt: string
  author: User
}

interface Media {
  id: string
  url: string
  thumbnail: string | null
  altText: string | null
  caption: string | null
  width: number | null
  height: number | null
  size: number | null
  mimeType: string | null
  tags: string[]
  visibility: 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE'
  mediaType: 'IMAGE' | 'VIDEO'
  processingStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'FAILED'
  duration?: number | null
  codec?: string | null
  bitrate?: number | null
  framerate?: number | null
  videoUrl?: string | null
  videoS3Key?: string | null
  createdAt: string
  updatedAt: string
  authorId: string
}

interface Hashtag {
  id: string
  name: string
  createdAt: string
}

// Auth Hooks
export const useAuth = () => {
  const isClient = useIsClient()
  
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: getAuthHeaders(token)
      })
      
      if (!response.ok) {
        // Clear invalid token
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token')
        }
        throw new Error('Authentication failed')
      }
      
      return response.json()
    },
    enabled: isClient && hasToken(),
    retry: false
  })
}

export const useLogin = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Login failed')
      
      return data
    },
    onSuccess: (data) => {
      localStorage.setItem('token', data.data.token)
      queryClient.invalidateQueries({ queryKey: ['auth'] })
    }
  })
}

export const useRegister = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (userData: { name: string; email: string; password: string }) => {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Registration failed')
      
      return data
    },
    onSuccess: (data) => {
      localStorage.setItem('token', data.data.token)
      queryClient.invalidateQueries({ queryKey: ['auth'] })
    }
  })
}

export const useUpdateProfile = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (profileData: Partial<User>) => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/users/profile`, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify(profileData)
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Profile update failed')
      
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] })
      queryClient.invalidateQueries({ queryKey: ['user'] })
    }
  })
}

export const useUploadAvatar = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/users/avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Avatar upload failed')
      
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] })
      queryClient.invalidateQueries({ queryKey: ['user'] })
    }
  })
}

// Posts Hooks
export const usePostsFeed = (page = 1, limit = 20) => {
  const isClient = useIsClient()
  
  return useQuery({
    queryKey: ['posts', 'feed', page, limit],
    queryFn: async () => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/posts/feed?page=${page}&limit=${limit}`, {
        headers: getAuthHeaders(token)
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch posts')
      
      return data
    },
    enabled: isClient && hasToken()
  })
}

export const usePublicPostsFeed = (page = 1, limit = 20) => {
  return useQuery({
    queryKey: ['posts', 'public', 'feed', page, limit],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/posts/public?page=${page}&limit=${limit}`)
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch public posts')
      
      return data
    }
  })
}

export const useUserPosts = (userId: string, page = 1, limit = 20) => {
  const isClient = useIsClient()
  
  return useQuery({
    queryKey: ['posts', 'user', userId, page, limit],
    queryFn: async () => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/posts/user/${userId}?page=${page}&limit=${limit}`, {
        headers: getAuthHeaders(token)
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch user posts')
      
      return data
    },
    enabled: isClient && hasToken() && !!userId
  })
}

export const usePublicUserPosts = (identifier: string, page = 1, limit = 20) => {
  return useQuery({
    queryKey: ['posts', 'user', 'public', identifier, page, limit],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/posts/user/${identifier}/public?page=${page}&limit=${limit}`)
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch public user posts')
      
      return data
    },
    enabled: !!identifier
  })
}

export const useCreatePost = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (postData: { title?: string; content: string; visibility?: 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE'; hashtags?: string[]; mediaIds?: string[] }) => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/posts`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(postData)
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to create post')
      
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    }
  })
}

export const usePostReaction = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ postId, type }: { postId: string; type: string }) => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/posts/${postId}/reactions`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ type })
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to add reaction')
      
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    }
  })
}

// Comments Hooks
export const useComments = (postId: string) => {
  const isClient = useIsClient()
  
  return useQuery({
    queryKey: ['comments', postId],
    queryFn: async () => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/comments/post/${postId}`, {
        headers: getAuthHeaders(token)
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch comments')
      
      return data
    },
    enabled: isClient && hasToken() && !!postId
  })
}

export const useCreateComment = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (commentData: { content: string; postId?: string; mediaId?: string; parentId?: string }) => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/comments`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(commentData)
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to create comment')
      
      return data
    },
    onSuccess: (_, variables) => {
      if (variables.postId) {
        queryClient.invalidateQueries({ queryKey: ['comments', variables.postId] })
        queryClient.invalidateQueries({ queryKey: ['posts'] })
      }
      if (variables.mediaId) {
        queryClient.invalidateQueries({ queryKey: ['comments', 'media', variables.mediaId] })
        queryClient.invalidateQueries({ queryKey: ['media'] })
      }
    }
  })
}

export const useMediaComments = (mediaId: string) => {
  const isClient = useIsClient()
  
  return useQuery({
    queryKey: ['comments', 'media', mediaId],
    queryFn: async () => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/comments/media/${mediaId}`, {
        headers: getAuthHeaders(token)
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch media comments')
      
      return data
    },
    enabled: isClient && hasToken() && !!mediaId
  })
}

export const usePublicUserMedia = (identifier: string, page = 1, limit = 20) => {
  return useQuery({
    queryKey: ['media', 'user', 'public', identifier, page, limit],
    queryFn: async () => {
      const response = await fetch(`${API_ENDPOINTS.MEDIA.PUBLIC_USER(identifier)}?page=${page}&limit=${limit}`)
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch public user media')
      
      return data
    },
    enabled: !!identifier
  })
}

// Infinite scroll user media hook
export const useUserMedia = (userId: string) => {
  const isClient = useIsClient()
  const [allMedia, setAllMedia] = useState<any[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalMedia, setTotalMedia] = useState(0)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [nextPageSize, setNextPageSize] = useState(20) // Default page size
  
  // Function to update a specific media in the local state
  const updateMedia = useCallback((mediaId: string, updates: Partial<any>) => {
    setAllMedia(prev => 
      prev.map(media => 
        media.id === mediaId ? { ...media, ...updates } : media
      )
    )
  }, [])
  
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['media', 'user', userId, currentPage],
    queryFn: async () => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_ENDPOINTS.MEDIA.USER(userId)}?page=${currentPage}&limit=20`, {
        headers: getAuthHeaders(token)
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch media')
      
      return data
    },
    enabled: isClient && hasToken() && !!userId
  })

  // Update accumulated media when new data arrives
  useEffect(() => {
    if (data?.data) {
      const newMedia = data.data.media || []
      const pagination = data.data.pagination
      
      if (currentPage === 1) {
        // First page - replace all media
        setAllMedia(newMedia)
      } else {
        // Subsequent pages - append new media, avoiding duplicates
        setAllMedia(prev => {
          const existingIds = new Set(prev.map((media: any) => media.id))
          const uniqueNewMedia = newMedia.filter((media: any) => !existingIds.has(media.id))
          return [...prev, ...uniqueNewMedia]
        })
      }
      
      setTotalMedia(pagination?.total || 0)
      setHasMore(pagination?.hasNext || false)
      
      // Calculate next page size for predictive loading
      if (pagination?.total && pagination?.hasNext) {
        const remainingMedia = pagination.total - allMedia.length - newMedia.length
        const nextSize = Math.min(20, remainingMedia) // Max 20 per page
        setNextPageSize(nextSize)
      }
      
      // Stop loading immediately since we're using lazy loading
      setIsLoadingMore(false)
    }
  }, [data, currentPage, allMedia.length])

  const loadMore = useCallback(() => {
    if (hasMore && !isFetching && !isLoadingMore) {
      setIsLoadingMore(true)
      setCurrentPage(prev => prev + 1)
    }
  }, [hasMore, isFetching, isLoadingMore, currentPage])

  const reset = useCallback(() => {
    setAllMedia([])
    setHasMore(true)
    setCurrentPage(1)
    setTotalMedia(0)
    setIsLoadingMore(false)
  }, [])

  return {
    data: {
      data: {
        media: allMedia,
        pagination: {
          total: totalMedia,
          hasNext: hasMore
        }
      }
    },
    isLoading: isLoading && currentPage === 1,
    isFetching,
    error,
    loadMore,
    reset,
    hasMore,
    isLoadingMore,
    nextPageSize,
    updateMedia
  }
}

export const useUploadMedia = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_ENDPOINTS.MEDIA.UPLOAD}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to upload media')
      
      return data
    },
    onSuccess: (data, variables) => {
      // Extract userId from form data to invalidate specific user's media
      const userId = variables.get('userId') as string
      console.log('Upload successful, invalidating queries for userId:', userId)
      if (userId) {
        // Invalidate queries but don't remove them - this will trigger refetch while keeping old data visible
        queryClient.invalidateQueries({ 
          queryKey: ['media', 'user', userId],
          exact: false 
        })
        console.log('Invalidated user media queries')
        
        // Force a fresh fetch after a short delay to ensure DB transaction is committed
        setTimeout(() => {
          queryClient.refetchQueries({ 
            queryKey: ['media', 'user', userId],
            exact: false 
          })
          console.log('Forced fresh fetch of user media')
        }, 500)
      }
      // Also invalidate general media queries
      queryClient.invalidateQueries({ queryKey: ['media'] })
      console.log('Invalidated general media queries')
    }
  })
}

export const useUpdateMedia = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ mediaId, title, description, tags, onOptimisticUpdate }: { 
      mediaId: string; 
      title?: string; 
      description?: string;
      tags?: string[];
      onOptimisticUpdate?: (mediaId: string, updates: any) => void;
    }) => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_ENDPOINTS.MEDIA.UPDATE(mediaId)}`, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ title, description, tags })
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to update media')
      
      return data
    },
    onMutate: async ({ mediaId, title, description, tags, onOptimisticUpdate }) => {
      // Apply optimistic update to local state if callback provided
      if (onOptimisticUpdate) {
        onOptimisticUpdate(mediaId, {
          altText: title || null,
          caption: description || null,
          title: title || null,
          description: description || null,
          tags: tags || []
        })
      }
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['media'] })
      
      // Snapshot the previous value
      const previousMedia = queryClient.getQueriesData({ queryKey: ['media'] })
      
      return { previousMedia, onOptimisticUpdate }
    },
    onError: (err, variables, context) => {
      // If the mutation fails, we could rollback the optimistic update
      // but since we're using local state, we'll just let the error be handled
      console.error('Failed to update media:', err)
    },
    onSettled: () => {
      // Always refetch after error or success to ensure cache consistency
      queryClient.invalidateQueries({ queryKey: ['media'] })
    }
  })
}

export const useBulkUpdateMedia = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ 
      mediaIds, 
      title, 
      description, 
      tags, 
      mergeTags = false,
      onOptimisticUpdate 
    }: { 
      mediaIds: string[]; 
      title?: string; 
      description?: string;
      tags?: string[];
      mergeTags?: boolean;
      onOptimisticUpdate?: (mediaId: string, updates: any) => void;
    }) => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      // Update each media individually since there's no bulk endpoint
      const results = await Promise.all(
        mediaIds.map(async (mediaId) => {
          // Build the update payload - only include fields that are provided
          const updatePayload: any = {}
          
          if (title !== undefined) {
            updatePayload.title = title
          }
          if (description !== undefined) {
            updatePayload.description = description
          }
          if (tags !== undefined) {
            if (mergeTags) {
              // For merging tags, we need to get the current media data first
              // This will be handled by the backend, but we send a flag
              updatePayload.tags = tags
              updatePayload.mergeTags = true
            } else {
              updatePayload.tags = tags
            }
          }
          
          const response = await fetch(`${API_ENDPOINTS.MEDIA.UPDATE(mediaId)}`, {
            method: 'PUT',
            headers: getAuthHeaders(token),
            body: JSON.stringify(updatePayload)
          })
          
          const data = await response.json()
          if (!response.ok) throw new Error(data.error || `Failed to update media ${mediaId}`)
          
          return { mediaId, data }
        })
      )
      
      return results
    },
    onMutate: async ({ mediaIds, title, description, tags, mergeTags, onOptimisticUpdate }) => {
      // Apply optimistic updates to local state if callback provided
      if (onOptimisticUpdate) {
        mediaIds.forEach(mediaId => {
          const updates: any = {}
          
          if (title !== undefined) {
            updates.altText = title
            updates.title = title
          }
          if (description !== undefined) {
            updates.caption = description
            updates.description = description
          }
          if (tags !== undefined) {
            if (mergeTags) {
              // For optimistic updates with tag merging, we'll let the backend handle it
              // and just update the tags field - the actual merging will be done by the backend
              updates.tags = tags
            } else {
              updates.tags = tags
            }
          }
          
          onOptimisticUpdate(mediaId, updates)
        })
      }
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['media'] })
      
      // Snapshot the previous value
      const previousMedia = queryClient.getQueriesData({ queryKey: ['media'] })
      
      return { previousMedia, onOptimisticUpdate }
    },
    onError: (err, variables, context) => {
      console.error('Failed to bulk update media:', err)
    },
    onSettled: () => {
      // Always refetch after error or success to ensure cache consistency
      queryClient.invalidateQueries({ queryKey: ['media'] })
      queryClient.invalidateQueries({ queryKey: ['galleries'] })
    }
  })
}

export const useDeleteMedia = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (mediaId: string) => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_ENDPOINTS.MEDIA.DELETE(mediaId)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token)
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to delete media')
      
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] })
    }
  })
}

export const useReorderPostMedia = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ postId, mediaIds }: { postId: string; mediaIds: string[] }) => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/posts/${postId}/media/reorder`, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ mediaIds })
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to reorder media')
      
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    }
  })
}

export const useUpdatePostStatus = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ postId, publicationStatus }: { postId: string; publicationStatus: 'PUBLIC' | 'PAUSED' | 'CONTROLLED' | 'DELETED' }) => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/posts/${postId}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ publicationStatus })
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to update post status')
      
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    }
  })
}

export const useUpdatePostVisibility = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ postId, visibility }: { postId: string; visibility: 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE' }) => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/posts/${postId}/visibility`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(token),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ visibility })
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to update post visibility')
      
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      queryClient.invalidateQueries({ queryKey: ['userPosts'] })
    }
  })
}

// Search media by tags across all users
export const useSearchMediaByTags = (tags: string[], page = 1, limit = 20) => {
  const isClient = useIsClient()
  
  return useQuery({
    queryKey: ['searchMediaByTags', tags, page, limit],
    queryFn: async () => {
      const token = getToken()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }
      
      const tagsParam = tags.join(',')
      const response = await fetch(`${API_ENDPOINTS.MEDIA.SEARCH_TAGS}?tags=${encodeURIComponent(tagsParam)}&page=${page}&limit=${limit}`, {
        headers
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to search media by tags')
      }
      
      return response.json()
    },
    enabled: isClient && tags.length > 0,
    staleTime: 5 * 60 * 1000 // 5 minutes
  })
}

// Gallery Hooks
export const useUserGalleries = (userId: string, page = 1, limit = 20) => {
  const isClient = useIsClient()
  
  return useQuery({
    queryKey: ['galleries', 'user', userId, page, limit],
    queryFn: async () => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/galleries/user/${userId}?page=${page}&limit=${limit}`, {
        headers: getAuthHeaders(token)
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch user galleries')
      
      return data
    },
    enabled: isClient && hasToken() && !!userId
  })
}

export const useMyGalleries = (page = 1, limit = 20) => {
  const isClient = useIsClient()
  
  return useQuery({
    queryKey: ['galleries', 'my', page, limit],
    queryFn: async () => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/galleries/my?page=${page}&limit=${limit}`, {
        headers: getAuthHeaders(token)
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch my galleries')
      
      return data
    },
    enabled: isClient && hasToken()
  })
}

export const useGallery = (galleryId: string) => {
  const isClient = useIsClient()
  
  return useQuery({
    queryKey: ['gallery', galleryId],
    queryFn: async () => {
      const token = getToken()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }
      
      const response = await fetch(`${API_BASE_URL}/galleries/${galleryId}`, {
        headers
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch gallery')
      
      return data
    },
    enabled: isClient && !!galleryId
  })
}

export const useCreateGallery = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (galleryData: { name: string; description?: string; visibility?: 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE' }) => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/galleries`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(galleryData)
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to create gallery')
      
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galleries'] })
    }
  })
}

export const useUpdateGallery = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ galleryId, ...galleryData }: { 
      galleryId: string; 
      name?: string; 
      description?: string; 
      visibility?: 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE' 
    }) => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/galleries/${galleryId}`, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify(galleryData)
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to update gallery')
      
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['galleries'] })
      queryClient.invalidateQueries({ queryKey: ['gallery', variables.galleryId] })
    }
  })
}

export const useDeleteGallery = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (galleryId: string) => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/galleries/${galleryId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token)
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to delete gallery')
      
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galleries'] })
    }
  })
}

export const useAddMediaToGallery = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ galleryId, mediaIds }: { galleryId: string; mediaIds: string[] }) => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/galleries/${galleryId}/media`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ mediaIds })
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to add media to gallery')
      
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['galleries'] })
      queryClient.invalidateQueries({ queryKey: ['gallery', variables.galleryId] })
      queryClient.invalidateQueries({ queryKey: ['media'] })
    }
  })
}

export const useRemoveMediaFromGallery = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ galleryId, mediaIds }: { galleryId: string; mediaIds: string[] }) => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/galleries/${galleryId}/media`, {
        method: 'DELETE',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ mediaIds })
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to remove media from gallery')
      
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['galleries'] })
      queryClient.invalidateQueries({ queryKey: ['gallery', variables.galleryId] })
      queryClient.invalidateQueries({ queryKey: ['media'] })
    }
  })
}

export const useSetGalleryCover = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ galleryId, mediaId }: { galleryId: string; mediaId?: string }) => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/galleries/${galleryId}/cover`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ mediaId })
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to set gallery cover')
      
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['galleries'] })
      queryClient.invalidateQueries({ queryKey: ['gallery', variables.galleryId] })
    }
  })
}

export const useReorderGalleryMedia = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ galleryId, mediaIds }: { galleryId: string; mediaIds: string[] }) => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      console.log('Making reorder API call to:', `${API_BASE_URL}/galleries/${galleryId}/media/reorder`)
      console.log('With mediaIds:', mediaIds)
      
      const response = await fetch(`${API_BASE_URL}/galleries/${galleryId}/media/reorder`, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ mediaIds })
      })
      
      console.log('Response status:', response.status)
      console.log('Response headers:', Object.fromEntries(response.headers.entries()))
      
      const data = await response.json()
      console.log('Response data:', data)
      
      if (!response.ok) throw new Error(data.error || 'Failed to reorder gallery images')
      
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['galleries'] })
      queryClient.invalidateQueries({ queryKey: ['gallery', variables.galleryId] })
    }
  })
} 