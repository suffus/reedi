import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useCallback } from 'react'
import { API_BASE_URL, getAuthHeaders, getImageUrl } from './api'

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
  comments: Comment[]
  reactions: Reaction[]
  images: Image[]
  hashtags: Hashtag[]
  _count: {
    comments: number
    reactions: number
  }
}

interface Comment {
  id: string
  content: string
  postId: string
  authorId: string
  parentId: string | null
  createdAt: string
  updatedAt: string
  author: User
  replies: Comment[]
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

interface Image {
  id: string
  url: string
  thumbnail: string | null
  altText: string | null
  caption: string | null
  width: number | null
  height: number | null
  size: number | null
  mimeType: string | null
  postId: string | null
  authorId: string
  galleryId: string | null
  visibility: 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE'
  createdAt: string
  updatedAt: string
}

interface Hashtag {
  id: string
  name: string
  createdAt: string
}

interface GalleryImage {
  id: string
  url: string
  title: string | null
  description: string | null
  createdAt: string
  tags: string[]
  metadata: {
    width: number
    height: number
    size: number
    format: string
  }
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
    mutationFn: async (postData: { title?: string; content: string; visibility?: 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE'; hashtags?: string[]; imageIds?: string[] }) => {
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
    mutationFn: async (commentData: { content: string; postId?: string; imageId?: string; parentId?: string }) => {
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
      if (variables.imageId) {
        queryClient.invalidateQueries({ queryKey: ['comments', 'image', variables.imageId] })
        queryClient.invalidateQueries({ queryKey: ['images'] })
      }
    }
  })
}

export const useImageComments = (imageId: string) => {
  const isClient = useIsClient()
  
  return useQuery({
    queryKey: ['comments', 'image', imageId],
    queryFn: async () => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/comments/image/${imageId}`, {
        headers: getAuthHeaders(token)
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch image comments')
      
      return data
    },
    enabled: isClient && hasToken() && !!imageId
  })
}

export const usePublicUserImages = (identifier: string, page = 1, limit = 20) => {
  return useQuery({
    queryKey: ['images', 'user', 'public', identifier, page, limit],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/images/user/${identifier}/public?page=${page}&limit=${limit}`)
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch public user images')
      
      return data
    },
    enabled: !!identifier
  })
}

// Infinite scroll user images hook
export const useUserImages = (userId: string) => {
  const isClient = useIsClient()
  const [allImages, setAllImages] = useState<any[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalImages, setTotalImages] = useState(0)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [nextPageSize, setNextPageSize] = useState(20) // Default page size
  
  // Function to update a specific image in the local state
  const updateImage = useCallback((imageId: string, updates: Partial<any>) => {
    setAllImages(prev => 
      prev.map(img => 
        img.id === imageId ? { ...img, ...updates } : img
      )
    )
  }, [])
  
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['images', 'user', userId, currentPage],
    queryFn: async () => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/images/user/${userId}?page=${currentPage}&limit=20`, {
        headers: getAuthHeaders(token)
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch images')
      
      return data
    },
    enabled: isClient && hasToken() && !!userId
  })

  // Update accumulated images when new data arrives
  useEffect(() => {
    if (data?.data) {
      const newImages = data.data.images || []
      const pagination = data.data.pagination
      
      if (currentPage === 1) {
        // First page - replace all images
        setAllImages(newImages)
      } else {
        // Subsequent pages - append new images, avoiding duplicates
        setAllImages(prev => {
          const existingIds = new Set(prev.map((img: any) => img.id))
          const uniqueNewImages = newImages.filter((img: any) => !existingIds.has(img.id))
          return [...prev, ...uniqueNewImages]
        })
      }
      
      setTotalImages(pagination?.total || 0)
      setHasMore(pagination?.hasNext || false)
      
      // Calculate next page size for predictive loading
      if (pagination?.total && pagination?.hasNext) {
        const remainingImages = pagination.total - allImages.length - newImages.length
        const nextSize = Math.min(20, remainingImages) // Max 20 per page
        setNextPageSize(nextSize)
      }
      
      // Stop loading immediately since we're using lazy loading
      setIsLoadingMore(false)
    }
  }, [data, currentPage, allImages.length])

  const loadMore = useCallback(() => {
    if (hasMore && !isFetching && !isLoadingMore) {
      setIsLoadingMore(true)
      setCurrentPage(prev => prev + 1)
    }
  }, [hasMore, isFetching, isLoadingMore, currentPage])

  const reset = useCallback(() => {
    setAllImages([])
    setHasMore(true)
    setCurrentPage(1)
    setTotalImages(0)
    setIsLoadingMore(false)
  }, [])

  return {
    data: {
      data: {
        images: allImages,
        pagination: {
          total: totalImages,
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
    updateImage
  }
}

export const useUploadImage = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/images/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to upload image')
      
      return data
    },
    onSuccess: (data, variables) => {
      // Extract userId from form data to invalidate specific user's images
      const userId = variables.get('userId') as string
      console.log('Upload successful, invalidating queries for userId:', userId)
      if (userId) {
        // Invalidate queries but don't remove them - this will trigger refetch while keeping old data visible
        queryClient.invalidateQueries({ 
          queryKey: ['images', 'user', userId],
          exact: false 
        })
        console.log('Invalidated user image queries')
        
        // Force a fresh fetch after a short delay to ensure DB transaction is committed
        setTimeout(() => {
          queryClient.refetchQueries({ 
            queryKey: ['images', 'user', userId],
            exact: false 
          })
          console.log('Forced fresh fetch of user images')
        }, 500)
      }
      // Also invalidate general images queries
      queryClient.invalidateQueries({ queryKey: ['images'] })
      console.log('Invalidated general image queries')
    }
  })
}

export const useUpdateImage = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ imageId, title, description, tags, onOptimisticUpdate }: { 
      imageId: string; 
      title?: string; 
      description?: string;
      tags?: string[];
      onOptimisticUpdate?: (imageId: string, updates: any) => void;
    }) => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/images/${imageId}`, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ title, description, tags })
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to update image')
      
      return data
    },
    onMutate: async ({ imageId, title, description, tags, onOptimisticUpdate }) => {
      // Apply optimistic update to local state if callback provided
      if (onOptimisticUpdate) {
        onOptimisticUpdate(imageId, {
          altText: title || null,
          caption: description || null,
          title: title || null,
          description: description || null,
          tags: tags || []
        })
      }
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['images'] })
      
      // Snapshot the previous value
      const previousImages = queryClient.getQueriesData({ queryKey: ['images'] })
      
      return { previousImages, onOptimisticUpdate }
    },
    onError: (err, variables, context) => {
      // If the mutation fails, we could rollback the optimistic update
      // but since we're using local state, we'll just let the error be handled
      console.error('Failed to update image:', err)
    },
    onSettled: () => {
      // Always refetch after error or success to ensure cache consistency
      queryClient.invalidateQueries({ queryKey: ['images'] })
    }
  })
}

export const useDeleteImage = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (imageId: string) => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/images/${imageId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token)
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to delete image')
      
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['images'] })
    }
  })
}

export const useReorderPostImages = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ postId, imageIds }: { postId: string; imageIds: string[] }) => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/posts/${postId}/images/reorder`, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ imageIds })
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to reorder images')
      
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
        headers: getAuthHeaders(token),
        body: JSON.stringify({ visibility })
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to update post visibility')
      
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    }
  })
} 