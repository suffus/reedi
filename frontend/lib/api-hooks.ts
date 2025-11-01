import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { useState, useEffect, useCallback } from 'react'
import { API_BASE_URL, getAuthHeaders, API_ENDPOINTS } from './api'

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
interface PaginationResponse {
  data: {
    media: Media[]
    pagination: {
      page: number
      limit: number
      total: number
      hasNext: boolean
    }
  }
}

interface MediaUpdatePayload {
  title?: string
  description?: string
  tags?: string[]
  visibility?: string
  mergeTags?: boolean
}

interface QueryData {
  data: {
    media: Media[]
  }
}

interface PostData {
  data: {
    posts: Array<{
      id: string
      media: Array<{
        media: Media
      }>
    }>
  }
}

interface GalleryData {
  data: {
    gallery: {
      media: Media[]
    }
  }
}

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
  isLocked?: boolean
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
      if (!response.ok) {
        // Handle unverified users specially
        if (response.status === 403 && data.needsVerification) {
          const error = new Error(data.error || 'Login failed') as Error & {
            needsVerification: boolean
            userData: User
          }
          error.needsVerification = true
          error.userData = data.user
          throw error
        }
        throw new Error(data.error || 'Login failed')
      }
      
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
    onSuccess: () => {
      // Don't automatically log in - user needs to verify email first
      // localStorage.setItem('token', data.data.token)
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

// Infinite scroll version of posts feed
export const useInfinitePostsFeed = (limit = 20) => {
  const isClient = useIsClient()
  
  return useInfiniteQuery({
    queryKey: ['infinite-posts', 'feed', limit],
    initialPageParam: 1,
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/posts/feed?page=${pageParam}&limit=${limit}`, {
        headers: getAuthHeaders(token)
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch posts')
      
      return data
    },
    getNextPageParam: (lastPage, allPages) => {
      // If we got fewer posts than the limit, we've reached the end
      if (lastPage.data.posts.length < limit) {
        return undefined
      }
      return allPages.length + 1
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
    mutationFn: async (postData: { 
      title?: string; 
      content: string; 
      visibility?: 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE'; 
      hashtags?: string[]; 
      mediaIds?: string[]; 
      isLocked?: boolean; 
      unlockPrice?: number; 
      lockedMediaIds?: string[];
    }) => {
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
      // Invalidate both regular and infinite posts queries
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      queryClient.invalidateQueries({ queryKey: ['infinite-posts'] })
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
      queryClient.invalidateQueries({ queryKey: ['infinite-posts'] })
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
    mutationFn: async (commentData: { 
      content: string; 
      postId?: string; 
      mediaId?: string; 
      parentId?: string;
      context?: 'FEED' | 'GROUP' | 'USER_PAGE'; // NEW: Comment context
      groupId?: string; // NEW: Group ID for GROUP context
    }) => {
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
        queryClient.invalidateQueries({ queryKey: ['infinite-posts'] })
        
        // If this is a group comment, invalidate group queries
        if (variables.context === 'GROUP' && variables.groupId) {
          queryClient.invalidateQueries({ queryKey: ['groups', variables.groupId, 'posts'] })
          queryClient.invalidateQueries({ queryKey: ['groups', variables.groupId, 'feed'] })
        }
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
// Filter interface for user media
interface UserMediaFilters {
  tags?: string[]
  title?: string
  galleryId?: string
  visibility?: 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE'
  mediaType?: 'IMAGE' | 'VIDEO'
  startDate?: string
  endDate?: string
  showOnlyUnorganized?: boolean
}

export const useFilteredUserMedia = (
  userId: string, 
  filters: UserMediaFilters = {}, 
  page = 1, 
  limit = 20
) => {
  const isClient = useIsClient()
  
  // Build query parameters from filters
  const queryParams = new URLSearchParams()
  queryParams.append('page', page.toString())
  queryParams.append('limit', limit.toString())
  
  if (filters.tags && filters.tags.length > 0) {
    queryParams.append('tags', filters.tags.join(','))
  }
  
  if (filters.title) {
    queryParams.append('title', filters.title)
  }
  
  if (filters.galleryId) {
    queryParams.append('galleryId', filters.galleryId)
  }
  
  if (filters.visibility) {
    queryParams.append('visibility', filters.visibility)
  }
  
  if (filters.mediaType) {
    queryParams.append('mediaType', filters.mediaType)
  }
  
  if (filters.startDate) {
    queryParams.append('startDate', filters.startDate)
  }
  
  if (filters.endDate) {
    queryParams.append('endDate', filters.endDate)
  }
  
  if (filters.showOnlyUnorganized) {
    queryParams.append('showOnlyUnorganized', 'true')
  }
  
  return useQuery({
    queryKey: ['filtered-media', 'user', userId, filters, page, limit],
    queryFn: async () => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const url = `${API_ENDPOINTS.MEDIA.USER(userId)}?${queryParams.toString()}`
      const response = await fetch(url, {
        headers: getAuthHeaders(token)
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch filtered media')
      
      return data
    },
    enabled: isClient && hasToken() && !!userId
  })
}

// Infinite scroll version of filtered user media
export const useInfiniteFilteredUserMedia = (
  userId: string, 
  filters: UserMediaFilters = {}
) => {
  const isClient = useIsClient()
  
  return useInfiniteQuery({
    queryKey: ['infinite-filtered-media', 'user', userId, filters],
    initialPageParam: 1,
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      // Build query parameters from filters
      const queryParams = new URLSearchParams()
      queryParams.append('page', pageParam.toString())
      queryParams.append('limit', '20')
      
      if (filters.tags && filters.tags.length > 0) {
        queryParams.append('tags', filters.tags.join(','))
      }
      
      if (filters.title) {
        queryParams.append('title', filters.title)
      }
      
      if (filters.galleryId) {
        queryParams.append('galleryId', filters.galleryId)
      }
      
      if (filters.visibility) {
        queryParams.append('visibility', filters.visibility)
      }
      
      if (filters.mediaType) {
        queryParams.append('mediaType', filters.mediaType)
      }
      
      if (filters.startDate) {
        queryParams.append('startDate', filters.startDate)
      }
      
      if (filters.endDate) {
        queryParams.append('endDate', filters.endDate)
      }
      
      if (filters.showOnlyUnorganized) {
        queryParams.append('showOnlyUnorganized', 'true')
      }
      
      const url = `${API_ENDPOINTS.MEDIA.USER(userId)}?${queryParams.toString()}`
      const response = await fetch(url, {
        headers: getAuthHeaders(token)
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch filtered media')
      
      return data
    },
    getNextPageParam: (lastPage: PaginationResponse) => {
      const pagination = lastPage.data?.pagination
      return pagination?.hasNext ? pagination.page + 1 : undefined
    },
    enabled: isClient && hasToken() && !!userId
  })
}

export const useUserMedia = (userId: string) => {
  const isClient = useIsClient()
  const [allMedia, setAllMedia] = useState<any[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalMedia, setTotalMedia] = useState(0)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [nextPageSize, setNextPageSize] = useState(20) // Default page size
  
  // Function to update a specific media in the local state
  const updateMedia = useCallback((mediaId: string, updates: Partial<Media>) => {
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
          const existingIds = new Set(prev.map((media: Media) => media.id))
          const uniqueNewMedia = newMedia.filter((media: Media) => !existingIds.has(media.id))
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
  }, [data, currentPage])

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
    mutationFn: async ({ mediaId, title, description, tags }: { 
      mediaId: string; 
      title?: string; 
      description?: string;
      tags?: string[];
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
    onMutate: async ({ mediaId, title, description, tags }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['media'] })
      await queryClient.cancelQueries({ queryKey: ['posts'] })
      await queryClient.cancelQueries({ queryKey: ['gallery'] })
      
      // Snapshot the previous values for potential rollback
      const previousMediaQueries = queryClient.getQueriesData({ queryKey: ['media'] })
      const previousPostQueries = queryClient.getQueriesData({ queryKey: ['posts'] })
      const previousGalleryQueries = queryClient.getQueriesData({ queryKey: ['gallery'] })
      
      // Optimistically update media queries
      queryClient.setQueriesData({ queryKey: ['media'] }, (oldData: QueryData | Media[] | undefined) => {
        if (!oldData) return oldData
        
        // Handle different data structures
        if ('data' in oldData && oldData.data?.media) {
          // For queries that return { data: { media: [...] } }
          return {
            ...oldData,
            data: {
              ...oldData.data,
              media: oldData.data.media.map((item: Media) => 
                item.id === mediaId ? {
                  ...item,
                  altText: title !== undefined ? title : item.altText,
                  caption: description !== undefined ? description : item.caption,
                  tags: tags !== undefined ? tags : item.tags
                } : item
              )
            }
          }
        } else if (Array.isArray(oldData)) {
          // For queries that return array of media
          return oldData.map((item: Media) => 
            item.id === mediaId ? {
              ...item,
              altText: title !== undefined ? title : item.altText,
              caption: description !== undefined ? description : item.caption,
              tags: tags !== undefined ? tags : item.tags
            } : item
          )
        } else if ('id' in oldData && oldData.id === mediaId) {
          // For single media item queries
          const mediaItem = oldData as unknown as Media
          return {
            ...mediaItem,
            altText: title !== undefined ? title : mediaItem.altText,
            caption: description !== undefined ? description : mediaItem.caption,
            tags: tags !== undefined ? tags : mediaItem.tags
          }
        }
        
        return oldData
      })
      
      // Optimistically update post queries that contain this media
      queryClient.setQueriesData({ queryKey: ['posts'] }, (oldData: PostData | undefined) => {
        if (!oldData) return oldData
        
        if (oldData.data?.posts) {
          return {
            ...oldData,
            data: {
              ...oldData.data,
              posts: oldData.data.posts.map((post: { id: string; media: Array<{ media: Media }> }) => ({
                ...post,
                media: post.media?.map((pm: { media: Media }) => {
                  const mediaItem = pm.media || pm
                  if (mediaItem.id === mediaId) {
                    return {
                      ...pm,
                      media: {
                        ...mediaItem,
                        altText: title !== undefined ? title : mediaItem.altText,
                        caption: description !== undefined ? description : mediaItem.caption,
                        tags: tags !== undefined ? tags : mediaItem.tags
                      }
                    }
                  }
                  return pm
                })
              }))
            }
          }
        }
        
        return oldData
      })
      
      // Optimistically update gallery queries that contain this media
      queryClient.setQueriesData({ queryKey: ['gallery'] }, (oldData: GalleryData | undefined) => {
        if (!oldData) return oldData
        
        if (oldData.data?.gallery?.media) {
          return {
            ...oldData,
            data: {
              ...oldData.data,
              gallery: {
                ...oldData.data.gallery,
                media: oldData.data.gallery.media.map((item: Media) => 
                  item.id === mediaId ? {
                    ...item,
                    altText: title !== undefined ? title : item.altText,
                    caption: description !== undefined ? description : item.caption,
                    tags: tags !== undefined ? tags : item.tags
                  } : item
                )
              }
            }
          }
        }
        
        return oldData
      })
      
      return { 
        previousMediaQueries, 
        previousPostQueries, 
        previousGalleryQueries 
      }
    },
    onError: (err, variables, context) => {
      console.error('Failed to update media:', err)
      
      // Rollback optimistic updates on error
      if (context?.previousMediaQueries) {
        context.previousMediaQueries.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueriesData(queryKey, data)
        })
      }
      if (context?.previousPostQueries) {
        context.previousPostQueries.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueriesData(queryKey, data)
        })
      }
      if (context?.previousGalleryQueries) {
        context.previousGalleryQueries.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueriesData(queryKey, data)
        })
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure cache consistency
      console.log('Invalidating media queries and related data...')
      
      // Invalidate media queries
      queryClient.invalidateQueries({ queryKey: ['media'] })
      
      // Invalidate user media queries - match all query key patterns
      queryClient.invalidateQueries({ queryKey: ['media', 'user'] })
      queryClient.invalidateQueries({ queryKey: ['infinite-filtered-media', 'user'] })
      queryClient.invalidateQueries({ queryKey: ['filtered-media', 'user'] })
      
      // Invalidate posts queries since they contain media
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      queryClient.invalidateQueries({ queryKey: ['infinite-posts'] })
      
      // Invalidate gallery queries since they contain media
      queryClient.invalidateQueries({ queryKey: ['gallery'] })
      queryClient.invalidateQueries({ queryKey: ['gallery-media'] })
      queryClient.invalidateQueries({ queryKey: ['galleries'] })
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
      visibility
    }: { 
      mediaIds: string[]; 
      title?: string; 
      description?: string;
      tags?: string[];
      mergeTags?: boolean;
      visibility?: string;
    }) => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      // Build the update payload - only include fields that are provided
      const updates: any = {}
      
      if (title !== undefined) {
        updates.altText = title // Backend uses altText for title
      }
      if (description !== undefined) {
        updates.caption = description // Backend uses caption for description
      }
      if (tags !== undefined) {
        updates.tags = tags
      }
      if (visibility !== undefined) {
        updates.visibility = visibility
      }
      
      // Use the bulk update endpoint
      const response = await fetch(API_ENDPOINTS.MEDIA.BULK_UPDATE, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          mediaIds,
          updates,
          tagMode: mergeTags ? 'merge' : 'replace'
        })
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to bulk update media')
      
      return data
    },
    onMutate: async ({ mediaIds, title, description, tags, mergeTags }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['media'] })
      await queryClient.cancelQueries({ queryKey: ['posts'] })
      await queryClient.cancelQueries({ queryKey: ['gallery'] })
      
      // Snapshot the previous values for potential rollback
      const previousMediaQueries = queryClient.getQueriesData({ queryKey: ['media'] })
      const previousPostQueries = queryClient.getQueriesData({ queryKey: ['posts'] })
      const previousGalleryQueries = queryClient.getQueriesData({ queryKey: ['gallery'] })
      
      // Optimistically update media queries for all affected media
      mediaIds.forEach(mediaId => {
        queryClient.setQueriesData({ queryKey: ['media'] }, (oldData: QueryData | Media[] | undefined) => {
          if (!oldData) return oldData
          
          // Handle different data structures
          if ('data' in oldData && oldData.data?.media) {
            // For queries that return { data: { media: [...] } }
            return {
              ...oldData,
              data: {
                ...oldData.data,
                media: oldData.data.media.map((item: Media) => 
                  item.id === mediaId ? {
                    ...item,
                    altText: title !== undefined ? title : item.altText,
                    caption: description !== undefined ? description : item.caption,
                    tags: tags !== undefined 
                      ? (mergeTags ? Array.from(new Set([...(item.tags || []), ...tags])) : tags)
                      : item.tags
                  } : item
                )
              }
            }
          } else if (Array.isArray(oldData)) {
            // For queries that return array of media
            return oldData.map((item: Media) => 
              item.id === mediaId ? {
                ...item,
                altText: title !== undefined ? title : item.altText,
                caption: description !== undefined ? description : item.caption,
                tags: tags !== undefined 
                  ? (mergeTags ? Array.from(new Set([...(item.tags || []), ...tags])) : tags)
                  : item.tags
              } : item
            )
        } else if ('id' in oldData && oldData.id === mediaId) {
          // For single media item queries
          const mediaItem = oldData as unknown as Media
          return {
            ...mediaItem,
            altText: title !== undefined ? title : mediaItem.altText,
            caption: description !== undefined ? description : mediaItem.caption,
            tags: tags !== undefined 
              ? (mergeTags ? Array.from(new Set([...(mediaItem.tags || []), ...tags])) : tags)
              : mediaItem.tags
          }
        }
          
          return oldData
        })
        
        // Optimistically update post queries that contain this media
        queryClient.setQueriesData({ queryKey: ['posts'] }, (oldData: PostData | undefined) => {
          if (!oldData) return oldData
          
          if (oldData.data?.posts) {
            return {
              ...oldData,
              data: {
                ...oldData.data,
                posts: oldData.data.posts.map((post: { id: string; media: Array<{ media: Media }> }) => ({
                  ...post,
                  media: post.media?.map((pm: { media: Media }) => {
                    const mediaItem = pm.media || pm
                    if (mediaItem.id === mediaId) {
                      return {
                        ...pm,
                        media: {
                          ...mediaItem,
                          altText: title !== undefined ? title : mediaItem.altText,
                          caption: description !== undefined ? description : mediaItem.caption,
                          tags: tags !== undefined 
                            ? (mergeTags ? Array.from(new Set([...(mediaItem.tags || []), ...tags])) : tags)
                            : mediaItem.tags
                        }
                      }
                    }
                    return pm
                  })
                }))
              }
            }
          }
          
          return oldData
        })
        
        // Optimistically update gallery queries that contain this media
        queryClient.setQueriesData({ queryKey: ['gallery'] }, (oldData: GalleryData | undefined) => {
          if (!oldData) return oldData
          
          if (oldData.data?.gallery?.media) {
            return {
              ...oldData,
              data: {
                ...oldData.data,
                gallery: {
                  ...oldData.data.gallery,
                  media: oldData.data.gallery.media.map((item: Media) => 
                    item.id === mediaId ? {
                      ...item,
                      altText: title !== undefined ? title : item.altText,
                      caption: description !== undefined ? description : item.caption,
                      tags: tags !== undefined 
                        ? (mergeTags ? Array.from(new Set([...(item.tags || []), ...tags])) : tags)
                        : item.tags
                    } : item
                  )
                }
              }
            }
          }
          
          return oldData
        })
      })
      
      return { 
        previousMediaQueries, 
        previousPostQueries, 
        previousGalleryQueries 
      }
    },
    onError: (err, variables, context) => {
      console.error('Failed to bulk update media:', err)
      
      // Rollback optimistic updates on error
      if (context?.previousMediaQueries) {
        context.previousMediaQueries.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueriesData(queryKey, data)
        })
      }
      if (context?.previousPostQueries) {
        context.previousPostQueries.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueriesData(queryKey, data)
        })
      }
      if (context?.previousGalleryQueries) {
        context.previousGalleryQueries.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueriesData(queryKey, data)
        })
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure cache consistency
      console.log('Invalidating media queries and related data after bulk update...')
      
      // Invalidate media queries
      queryClient.invalidateQueries({ queryKey: ['media'] })
      
      // Invalidate user media queries - match all query key patterns
      queryClient.invalidateQueries({ queryKey: ['media', 'user'] })
      queryClient.invalidateQueries({ queryKey: ['infinite-filtered-media', 'user'] })
      queryClient.invalidateQueries({ queryKey: ['filtered-media', 'user'] })
      
      // Invalidate posts queries since they contain media
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      queryClient.invalidateQueries({ queryKey: ['infinite-posts'] })
      
      // Invalidate gallery queries since they contain media
      queryClient.invalidateQueries({ queryKey: ['gallery'] })
      queryClient.invalidateQueries({ queryKey: ['gallery-media'] })
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
      console.log('Invalidating media queries and related data after deletion...')
      
      // Invalidate media queries (general)
      queryClient.invalidateQueries({ queryKey: ['media'] })
      
      // Invalidate user media queries - need to match the actual query keys used
      queryClient.invalidateQueries({ queryKey: ['media', 'user'] })
      queryClient.invalidateQueries({ queryKey: ['infinite-filtered-media', 'user'] })
      queryClient.invalidateQueries({ queryKey: ['filtered-media', 'user'] })
      
      // Invalidate posts queries since they contain media
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      queryClient.invalidateQueries({ queryKey: ['infinite-posts'] })
      
      // Invalidate gallery queries since they contain media
      queryClient.invalidateQueries({ queryKey: ['gallery'] })
      queryClient.invalidateQueries({ queryKey: ['gallery-media'] })
      queryClient.invalidateQueries({ queryKey: ['galleries'] })
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
      queryClient.invalidateQueries({ queryKey: ['infinite-posts'] })
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
      queryClient.invalidateQueries({ queryKey: ['infinite-posts'] })
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
      queryClient.invalidateQueries({ queryKey: ['infinite-posts'] })
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

// Infinite scroll galleries hook
export const useInfiniteMyGalleries = () => {
  const isClient = useIsClient()
  
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isLoading,
    error,
    refetch
  } = useInfiniteQuery({
    queryKey: ['galleries', 'my'],
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/galleries/my?page=${pageParam}&limit=20`, {
        headers: getAuthHeaders(token)
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch my galleries')
      
      return data.data
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage: { galleries?: any[]; pagination?: { hasNext: boolean; page: number; total: number } }) => {
      return lastPage.pagination?.hasNext ? lastPage.pagination.page + 1 : undefined
    },
    enabled: isClient && hasToken(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Flatten all pages into a single array
  const allGalleries = data?.pages?.flatMap(page => page.galleries || []) || []
  const totalGalleries = data?.pages?.[0]?.pagination?.total || 0

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetching && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [hasNextPage, isFetching, isFetchingNextPage, fetchNextPage])

  const reset = useCallback(() => {
    // Reset is handled by React Query's refetch
    refetch()
  }, [refetch])

  const refresh = useCallback(() => {
    refetch()
  }, [refetch])

  return {
    data: {
      data: {
        galleries: allGalleries,
        pagination: {
          total: totalGalleries,
          hasNext: hasNextPage || false
        }
      }
    },
    isLoading,
    isFetching: isFetchingNextPage,
    error: error?.message || null,
    loadMore,
    reset,
    refresh
  }
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

export const useGalleryMedia = (galleryId: string, page = 1, limit = 20) => {
  const isClient = useIsClient()
  
  return useQuery({
    queryKey: ['gallery-media', galleryId, page, limit],
    queryFn: async () => {
      const token = getToken()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }
      
      const url = `${API_BASE_URL}/galleries/${galleryId}/media?page=${page}&limit=${limit}`
      
      const response = await fetch(url, {
        headers
      })
      
      const data = await response.json()
      
      if (!response.ok) throw new Error(data.error || 'Failed to fetch gallery media')
      
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
      queryClient.invalidateQueries({ queryKey: ['galleries', 'my'] })
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
      queryClient.invalidateQueries({ queryKey: ['galleries', 'my'] })
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
      queryClient.invalidateQueries({ queryKey: ['galleries', 'my'] })
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
      // Invalidate gallery queries
      queryClient.invalidateQueries({ queryKey: ['galleries', 'my'] })
      queryClient.invalidateQueries({ queryKey: ['gallery', variables.galleryId] })
      queryClient.invalidateQueries({ queryKey: ['gallery-media'] })
      
      // Invalidate media queries to refresh media library view
      queryClient.invalidateQueries({ queryKey: ['media'] })
      queryClient.invalidateQueries({ queryKey: ['media', 'user'] })
      queryClient.invalidateQueries({ queryKey: ['infinite-filtered-media', 'user'] })
      queryClient.invalidateQueries({ queryKey: ['filtered-media', 'user'] })
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
      queryClient.invalidateQueries({ queryKey: ['galleries', 'my'] })
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
      queryClient.invalidateQueries({ queryKey: ['galleries', 'my'] })
      queryClient.invalidateQueries({ queryKey: ['gallery', variables.galleryId] })
    }
  })
}

// Reprocess media hook
export const useReprocessMedia = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (mediaId: string) => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/media/${mediaId}/reprocess`, {
        method: 'POST',
        headers: getAuthHeaders(token)
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to reprocess media')
      
      return data
    },
    onMutate: async (mediaId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['media'] })
      await queryClient.cancelQueries({ queryKey: ['posts'] })
      await queryClient.cancelQueries({ queryKey: ['gallery'] })
      
      // Snapshot the previous values for potential rollback
      const previousMediaQueries = queryClient.getQueriesData({ queryKey: ['media'] })
      const previousPostQueries = queryClient.getQueriesData({ queryKey: ['posts'] })
      const previousGalleryQueries = queryClient.getQueriesData({ queryKey: ['gallery'] })
      
      // Optimistically update media queries to show PENDING status
      queryClient.setQueriesData({ queryKey: ['media'] }, (oldData: QueryData | Media[] | undefined) => {
        if (!oldData) return oldData
        
        // Handle different data structures
        if ('data' in oldData && oldData.data?.media) {
          // For queries that return { data: { media: [...] } }
          return {
            ...oldData,
            data: {
              ...oldData.data,
              media: oldData.data.media.map((item: Media) => 
                item.id === mediaId ? {
                  ...item,
                  processingStatus: 'PENDING'
                } : item
              )
            }
          }
        } else if (Array.isArray(oldData)) {
          // For queries that return array of media
          return oldData.map((item: Media) => 
            item.id === mediaId ? {
              ...item,
              processingStatus: 'PENDING'
            } : item
          )
        } else if ('id' in oldData && oldData.id === mediaId) {
          // For single media item queries
          return {
            ...oldData,
            processingStatus: 'PENDING'
          }
        }
        
        return oldData
      })
      
      // Optimistically update post queries that contain this media
      queryClient.setQueriesData({ queryKey: ['posts'] }, (oldData: PostData | undefined) => {
        if (!oldData) return oldData
        
        if (oldData.data?.posts) {
          return {
            ...oldData,
            data: {
              ...oldData.data,
              posts: oldData.data.posts.map((post: { id: string; media: Array<{ media: Media }> }) => ({
                ...post,
                media: post.media?.map((pm: { media: Media }) => {
                  const mediaItem = pm.media || pm
                  if (mediaItem.id === mediaId) {
                    return {
                      ...pm,
                      media: {
                        ...mediaItem,
                        processingStatus: 'PENDING'
                      }
                    }
                  }
                  return pm
                })
              }))
            }
          }
        }
        
        return oldData
      })
      
      // Optimistically update gallery queries that contain this media
      queryClient.setQueriesData({ queryKey: ['gallery'] }, (oldData: GalleryData | undefined) => {
        if (!oldData) return oldData
        
        if (oldData.data?.gallery?.media) {
          return {
            ...oldData,
            data: {
              ...oldData.data,
              gallery: {
                ...oldData.data.gallery,
                media: oldData.data.gallery.media.map((item: Media) => 
                  item.id === mediaId ? {
                    ...item,
                    processingStatus: 'PENDING'
                  } : item
                )
              }
            }
          }
        }
        
        return oldData
      })
      
      return { 
        previousMediaQueries, 
        previousPostQueries, 
        previousGalleryQueries 
      }
    },
    onError: (err, mediaId, context) => {
      console.error('Failed to reprocess media:', err)
      
      // Rollback optimistic updates on error
      if (context?.previousMediaQueries) {
        context.previousMediaQueries.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueriesData(queryKey, data)
        })
      }
      if (context?.previousPostQueries) {
        context.previousPostQueries.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueriesData(queryKey, data)
        })
      }
      if (context?.previousGalleryQueries) {
        context.previousGalleryQueries.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueriesData(queryKey, data)
        })
      }
    },
    onSuccess: (_, mediaId) => {
      console.log('Invalidating media queries and related data after reprocessing...')
      
      // Invalidate media queries to refresh the processing status
      queryClient.invalidateQueries({ queryKey: ['media', mediaId] })
      queryClient.invalidateQueries({ queryKey: ['media'] })
      
      // Invalidate posts queries since they contain media
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      queryClient.invalidateQueries({ queryKey: ['infinite-posts'] })
      
      // Invalidate gallery queries since they contain media
      queryClient.invalidateQueries({ queryKey: ['gallery'] })
      queryClient.invalidateQueries({ queryKey: ['gallery-media'] })
      queryClient.invalidateQueries({ queryKey: ['galleries'] })
      
      // Invalidate user media queries
      queryClient.invalidateQueries({ queryKey: ['media', 'user'] })
    }
  })
}

// Video quality hooks
export interface VideoQuality {
  quality: string
  width: number
  height: number
  bitrate: string
  url: string
  fileSize: number
}

export const useVideoQualities = (mediaId: string) => {
  return useQuery({
    queryKey: ['video-qualities', mediaId],
    queryFn: async (): Promise<VideoQuality[]> => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/media/serve/${mediaId}/qualities`, {
        headers: getAuthHeaders(token)
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch video qualities')
      
      return data.qualities || []
    },
    enabled: !!mediaId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// User hook for fetching individual user data
export const useUser = (userId: string) => {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: async (): Promise<User> => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
        headers: getAuthHeaders(token)
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch user')
      
      return data.data.user
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Group activity hook
export const useGroupActivity = (groupIdentifier: string, limit: number = 20) => {
  return useQuery({
    queryKey: ['group-activity', groupIdentifier, limit],
    queryFn: async () => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/groups/${groupIdentifier}/activity?limit=${limit}`, {
        headers: getAuthHeaders(token)
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch group activity')
      
      return data.data.activities
    },
    enabled: !!groupIdentifier,
    staleTime: 30 * 1000, // 30 seconds
  })
}

// Email verification hooks
export const useVerifyEmail = () => {
  return useMutation({
    mutationFn: async (data: { email: string; code: string }) => {
      const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Verification failed')
      
      return result
    }
  })
}

export const useResendVerification = () => {
  return useMutation({
    mutationFn: async (data: { email: string }) => {
      const response = await fetch(`${API_BASE_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to resend verification code')
      
      return result
    }
  })
} 