// API configuration
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8088/api'

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
    FOLLOW: (userId: string) => `${API_BASE_URL}/users/${userId}/follow`,
    FOLLOWERS: (userId: string) => `${API_BASE_URL}/users/${userId}/followers`,
    FOLLOWING: (userId: string) => `${API_BASE_URL}/users/${userId}/following`,
  },
  
  // Posts
  POSTS: {
    LIST: `${API_BASE_URL}/posts`,
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
    UPLOAD: `${API_BASE_URL}/images`,
    DELETE: (id: string) => `${API_BASE_URL}/images/${id}`,
  },
  
  // Galleries
  GALLERIES: {
    USER: (userId: string) => `${API_BASE_URL}/galleries/user/${userId}`,
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

// Helper function to handle API responses
export const handleApiResponse = async (response: Response) => {
  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(data.error || 'API request failed')
  }
  
  return data
} 