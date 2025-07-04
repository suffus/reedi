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



// Simple user images hook for the first page
export const useUserImages = (userId: string) => {
  const isClient = useIsClient()
  
  return useQuery({
    queryKey: ['images', 'user', userId],
    queryFn: async () => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/images/user/${userId}?page=1&limit=100`, {
        headers: getAuthHeaders(token)
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch images')
      
      return data
    },
    enabled: isClient && hasToken() && !!userId
  })
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
    mutationFn: async ({ imageId, altText, caption }: { imageId: string; altText?: string; caption?: string }) => {
      const token = getToken()
      if (!token) throw new Error('No token found')
      
      const response = await fetch(`${API_BASE_URL}/images/${imageId}`, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ altText, caption })
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to update image')
      
      return data
    },
    onMutate: async ({ imageId, altText, caption }) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ['images'] })
      
      // Snapshot the previous value
      const previousImages = queryClient.getQueriesData({ queryKey: ['images'] })
      
      // Optimistically update all image queries that contain this image
      queryClient.setQueriesData(
        { queryKey: ['images'] },
        (old: any) => {
          if (!old?.data?.images) return old
          
          return {
            ...old,
            data: {
              ...old.data,
              images: old.data.images.map((img: any) =>
                img.id === imageId
                  ? { ...img, altText: altText || null, caption: caption || null }
                  : img
              )
            }
          }
        }
      )
      
      // Return a context object with the snapshotted value
      return { previousImages }
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousImages) {
        context.previousImages.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
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