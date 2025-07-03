import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { API_BASE_URL, getAuthHeaders } from './api'

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
  isPrivate: boolean
  isVerified: boolean
}

interface Post {
  id: string
  title: string | null
  content: string
  isPublished: boolean
  isPrivate: boolean
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
  altText: string | null
  caption: string | null
  width: number | null
  height: number | null
  size: number | null
  mimeType: string | null
  postId: string | null
  authorId: string
  galleryId: string | null
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

export const useCreatePost = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (postData: { title?: string; content: string; isPrivate?: boolean; hashtags?: string[] }) => {
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

// Images Hooks
export const useUserImages = (userId: string, page = 1, limit = 20) => {
  const isClient = useIsClient()
  
  return useQuery({
    queryKey: ['images', 'user', userId, page, limit],
    queryFn: async () => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/images/user/${userId}?page=${page}&limit=${limit}`, {
        headers: getAuthHeaders(token)
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch images')
      
      return data
    },
    enabled: isClient && hasToken() && !!userId
  })
}

// Paginated user images hook that accumulates images from multiple pages
export const usePaginatedUserImages = (userId: string) => {
  const isClient = useIsClient()
  const [currentPage, setCurrentPage] = useState(1)
  const [allImages, setAllImages] = useState<any[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [totalImages, setTotalImages] = useState(0)
  
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
        // Subsequent pages - append new images
        setAllImages(prev => [...prev, ...newImages])
      }
      
      setTotalImages(pagination?.total || 0)
      setHasMore(pagination?.hasNext || false)
    }
  }, [data, currentPage])

  const loadMore = () => {
    if (hasMore && !isFetching) {
      setCurrentPage(prev => prev + 1)
    }
  }

  const reset = () => {
    setCurrentPage(1)
    setAllImages([])
    setHasMore(true)
    setTotalImages(0)
  }

  return {
    images: allImages,
    totalImages,
    hasMore,
    isLoading: isLoading && currentPage === 1,
    isFetching,
    error,
    loadMore,
    reset
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
    onSuccess: () => {
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