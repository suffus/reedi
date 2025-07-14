// API configuration
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8088/api'
export const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8088'

// Image serving configuration
export const IMAGE_BASE_URL = process.env.NEXT_PUBLIC_IMAGE_BASE_URL || BACKEND_BASE_URL

// API endpoints
export const API_ENDPOINTS = {
  // Auth
  AUTH: {
    REGISTER: `${API_BASE_URL}/auth/register`,
    LOGIN: `${API_BASE_URL}/auth/login`,
    ME: `${API_BASE_URL}/auth/me`,
    PROFILE: `${API_BASE_URL}/auth/profile`,
    CHANGE_PASSWORD: `${API_BASE_URL}/auth/change-password`,
  },
  
  // Users
  USERS: {
    PROFILE: (identifier: string) => `${API_BASE_URL}/users/${identifier}`,
    PUBLIC_PROFILE: (identifier: string) => `${API_BASE_URL}/users/${identifier}/public`,
    FOLLOW: (userId: string) => `${API_BASE_URL}/users/${userId}/follow`,
    FOLLOWERS: (userId: string) => `${API_BASE_URL}/users/${userId}/followers`,
    FOLLOWING: (userId: string) => `${API_BASE_URL}/users/${userId}/following`,
  },
  
  // Posts
  POSTS: {
    LIST: `${API_BASE_URL}/posts`,
    FEED: `${API_BASE_URL}/posts/feed`,
    PUBLIC_FEED: `${API_BASE_URL}/posts/public`,
    USER_POSTS: (userId: string) => `${API_BASE_URL}/posts/user/${userId}`,
    PUBLIC_USER_POSTS: (identifier: string) => `${API_BASE_URL}/posts/user/${identifier}/public`,
    CREATE: `${API_BASE_URL}/posts`,
    DETAIL: (id: string) => `${API_BASE_URL}/posts/${id}`,
    UPDATE: (id: string) => `${API_BASE_URL}/posts/${id}`,
    DELETE: (id: string) => `${API_BASE_URL}/posts/${id}`,
  },
  
  // Comments
  COMMENTS: {
    LIST: (postId: string) => `${API_BASE_URL}/comments/post/${postId}`,
    CREATE: `${API_BASE_URL}/comments`,
    UPDATE: (id: string) => `${API_BASE_URL}/comments/${id}`,
    DELETE: (id: string) => `${API_BASE_URL}/comments/${id}`,
  },
  
  // Images
  IMAGES: {
    USER: (userId: string) => `${API_BASE_URL}/images/user/${userId}`,
    PUBLIC_USER: (identifier: string) => `${API_BASE_URL}/images/user/${identifier}/public`,
    UPLOAD: `${API_BASE_URL}/images`,
    DELETE: (id: string) => `${API_BASE_URL}/images/${id}`,
  },
  
  // Galleries
  GALLERIES: {
    USER: (userId: string) => `${API_BASE_URL}/galleries/user/${userId}`,
    PUBLIC_USER: (identifier: string) => `${API_BASE_URL}/galleries/user/${identifier}/public`,
    CREATE: `${API_BASE_URL}/galleries`,
    DETAIL: (id: string) => `${API_BASE_URL}/galleries/${id}`,
    UPDATE: (id: string) => `${API_BASE_URL}/galleries/${id}`,
    DELETE: (id: string) => `${API_BASE_URL}/galleries/${id}`,
  },
  
  // Search
  SEARCH: {
    SEARCH: `${API_BASE_URL}/search`,
    SUGGESTIONS: `${API_BASE_URL}/search/suggestions`,
  },
}

// API client configuration
export const apiConfig = {
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
}

// Helper function to get auth headers
export const getAuthHeaders = (token?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  return headers
}

// Helper function to get full image URL
export const getImageUrl = (imagePath: string): string => {
  if (!imagePath) return ''
  
  // If it's already a full URL, return as is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath
  }
  
  // If it's a data URL, return as is
  if (imagePath.startsWith('data:')) {
    return imagePath
  }
  
  // For relative paths starting with /uploads, use the appropriate base URL
  if (imagePath.startsWith('/uploads/')) {
    return `${IMAGE_BASE_URL}${imagePath}`
  }
  
  // Default: assume it's a relative path and prepend the appropriate base URL
  return `${IMAGE_BASE_URL}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`
}

// Helper function to get image URL from image object or path
export const getImageUrlFromImage = (image: any, useThumbnail: boolean = false): string => {
  if (!image) return ''
  
  // If image has an ID, use the new backend serving endpoint
  if (image.id) {
    const endpoint = useThumbnail ? '/thumbnail' : ''
    return `${API_BASE_URL}/images/serve/${image.id}${endpoint}`
  }
  
  // Fallback to the old getImageUrl function for backward compatibility
  const path = useThumbnail ? (image.thumbnail || image.url) : image.url
  return getImageUrl(path)
}

// Helper function to handle API responses
export const handleApiResponse = async (response: Response) => {
  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(data.error || 'API request failed')
  }
  
  return data
} 