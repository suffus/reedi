import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { 
  useAuth, 
  usePostsFeed, 
  useCreatePost, 
  usePostReaction, 
  useCreateComment, 
  useUserImages, 
  useUploadImage, 
  useUpdatePostStatus,
  useComments,
  useReorderPostImages 
} from '../../lib/api-hooks'

// Mock the API functions
jest.mock('../../lib/api', () => ({
  getImageUrl: jest.fn((url) => url),
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}))

// Mock localStorage for getToken function
const mockLocalStorage = {
  getItem: jest.fn(() => 'test-token'),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}

const mockApi = require('../../lib/api').api

// Create a wrapper for React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('API Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Set up localStorage mock
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    })
  })

  describe('useAuth', () => {
    it('fetches user authentication data', async () => {
      const mockUser = { id: 'user1', name: 'Test User' }
      mockApi.get.mockResolvedValue({ data: { user: mockUser } })

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data?.data.user).toEqual(mockUser)
      expect(mockApi.get).toHaveBeenCalledWith('/auth/me')
    })

    it('handles authentication errors', async () => {
      mockApi.get.mockRejectedValue(new Error('Unauthorized'))

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      })
    })
  })

  describe('usePostsFeed', () => {
    it('fetches posts feed data', async () => {
      const mockPosts = [
        { id: 'post1', content: 'Test post 1' },
        { id: 'post2', content: 'Test post 2' },
      ]
      mockApi.get.mockResolvedValue({ data: { posts: mockPosts } })

      const { result } = renderHook(() => usePostsFeed(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data?.data.posts).toEqual(mockPosts)
      expect(mockApi.get).toHaveBeenCalledWith('/posts/feed')
    })

    it('handles feed loading errors', async () => {
      mockApi.get.mockRejectedValue(new Error('Failed to load feed'))

      const { result } = renderHook(() => usePostsFeed(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      })
    })
  })

  describe('useCreatePost', () => {
    it('creates a new post', async () => {
      const mockPost = { id: 'post1', content: 'New post' }
      mockApi.post.mockResolvedValue({ data: mockPost })

      const { result } = renderHook(() => useCreatePost(), {
        wrapper: createWrapper(),
      })

      const postData = { content: 'New post', imageIds: [] }
      await result.current.mutateAsync(postData)

      expect(mockApi.post).toHaveBeenCalledWith('/posts', postData)
    })

    it('handles post creation errors', async () => {
      mockApi.post.mockRejectedValue(new Error('Failed to create post'))

      const { result } = renderHook(() => useCreatePost(), {
        wrapper: createWrapper(),
      })

      const postData = { content: 'New post', imageIds: [] }
      
      await expect(result.current.mutateAsync(postData)).rejects.toThrow('Failed to create post')
    })
  })

  describe('usePostReaction', () => {
    it('adds a reaction to a post', async () => {
      const mockReaction = { id: 'reaction1', type: 'LIKE' }
      mockApi.post.mockResolvedValue({ data: mockReaction })

      const { result } = renderHook(() => usePostReaction(), {
        wrapper: createWrapper(),
      })

      const reactionData = { postId: 'post1', type: 'LIKE' }
      await result.current.mutateAsync(reactionData)

      expect(mockApi.post).toHaveBeenCalledWith('/posts/post1/reactions', { type: 'LIKE' })
    })

    it('handles reaction errors', async () => {
      mockApi.post.mockRejectedValue(new Error('Failed to add reaction'))

      const { result } = renderHook(() => usePostReaction(), {
        wrapper: createWrapper(),
      })

      const reactionData = { postId: 'post1', type: 'LIKE' }
      
      await expect(result.current.mutateAsync(reactionData)).rejects.toThrow('Failed to add reaction')
    })
  })

  describe('useCreateComment', () => {
    it('creates a new comment', async () => {
      const mockComment = { id: 'comment1', content: 'New comment' }
      mockApi.post.mockResolvedValue({ data: mockComment })

      const { result } = renderHook(() => useCreateComment(), {
        wrapper: createWrapper(),
      })

      const commentData = { postId: 'post1', content: 'New comment' }
      await result.current.mutateAsync(commentData)

      expect(mockApi.post).toHaveBeenCalledWith('/posts/post1/comments', { content: 'New comment' })
    })

    it('handles comment creation errors', async () => {
      mockApi.post.mockRejectedValue(new Error('Failed to create comment'))

      const { result } = renderHook(() => useCreateComment(), {
        wrapper: createWrapper(),
      })

      const commentData = { postId: 'post1', content: 'New comment' }
      
      await expect(result.current.mutateAsync(commentData)).rejects.toThrow('Failed to create comment')
    })
  })

  describe('useUserImages', () => {
    it('fetches user images', async () => {
      const mockImages = [
        { id: 'img1', url: '/test1.jpg' },
        { id: 'img2', url: '/test2.jpg' },
      ]
      mockApi.get.mockResolvedValue({ data: { images: mockImages } })

      const { result } = renderHook(() => useUserImages('user1'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data?.data.images).toEqual(mockImages)
      expect(mockApi.get).toHaveBeenCalledWith('/users/user1/images')
    })

    it('loads more images with pagination', async () => {
      const mockImages = [{ id: 'img3', url: '/test3.jpg' }]
      mockApi.get.mockResolvedValue({ data: { images: mockImages } })

      const { result } = renderHook(() => useUserImages('user1'), {
        wrapper: createWrapper(),
      })

      await result.current.loadMore()

      expect(mockApi.get).toHaveBeenCalledWith('/users/user1/images?page=2')
    })

    it('handles image loading errors', async () => {
      mockApi.get.mockRejectedValue(new Error('Failed to load images'))

      const { result } = renderHook(() => useUserImages('user1'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      })
    })
  })

  describe('useUploadImage', () => {
    it('uploads an image', async () => {
      const mockImage = { id: 'img1', url: '/uploaded.jpg' }
      mockApi.post.mockResolvedValue({ data: mockImage })

      const { result } = renderHook(() => useUploadImage(), {
        wrapper: createWrapper(),
      })

      const formData = new FormData()
      formData.append('file', new File(['test'], 'test.jpg'))
      
      await result.current.mutateAsync(formData)

      expect(mockApi.post).toHaveBeenCalledWith('/images/upload', formData)
    })

    it('handles upload errors', async () => {
      mockApi.post.mockRejectedValue(new Error('Upload failed'))

      const { result } = renderHook(() => useUploadImage(), {
        wrapper: createWrapper(),
      })

      const formData = new FormData()
      formData.append('file', new File(['test'], 'test.jpg'))
      
      await expect(result.current.mutateAsync(formData)).rejects.toThrow('Upload failed')
    })
  })

  describe('useUpdatePostStatus', () => {
    it('updates post publication status', async () => {
      const mockPost = { id: 'post1', publicationStatus: 'PAUSED' }
      mockApi.patch.mockResolvedValue({ data: mockPost })

      const { result } = renderHook(() => useUpdatePostStatus(), {
        wrapper: createWrapper(),
      })

      const updateData = { postId: 'post1', publicationStatus: 'PAUSED' as const }
      await result.current.mutateAsync(updateData)

      expect(mockApi.patch).toHaveBeenCalledWith('/posts/post1/status', { publicationStatus: 'PAUSED' })
    })

    it('handles status update errors', async () => {
      mockApi.patch.mockRejectedValue(new Error('Update failed'))

      const { result } = renderHook(() => useUpdatePostStatus(), {
        wrapper: createWrapper(),
      })

      const updateData = { postId: 'post1', publicationStatus: 'PAUSED' as const }
      
      await expect(result.current.mutateAsync(updateData)).rejects.toThrow('Update failed')
    })
  })

  describe('useComments', () => {
    it('fetches comments for a post', async () => {
      const mockComments = [
        { id: 'comment1', content: 'Comment 1' },
        { id: 'comment2', content: 'Comment 2' },
      ]
      mockApi.get.mockResolvedValue({ data: { comments: mockComments } })

      const { result } = renderHook(() => useComments('post1'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data?.data.comments).toEqual(mockComments)
      expect(mockApi.get).toHaveBeenCalledWith('/posts/post1/comments')
    })

    it('handles comment loading errors', async () => {
      mockApi.get.mockRejectedValue(new Error('Failed to load comments'))

      const { result } = renderHook(() => useComments('post1'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      })
    })
  })

  describe('useReorderPostImages', () => {
    it('reorders post images', async () => {
      const mockResult = { success: true }
      mockApi.patch.mockResolvedValue({ data: mockResult })

      const { result } = renderHook(() => useReorderPostImages(), {
        wrapper: createWrapper(),
      })

      const reorderData = { postId: 'post1', imageIds: ['img2', 'img1'] }
      await result.current.mutateAsync(reorderData)

      expect(mockApi.patch).toHaveBeenCalledWith('/posts/post1/images/reorder', { imageIds: ['img2', 'img1'] })
    })

    it('handles reorder errors', async () => {
      mockApi.patch.mockRejectedValue(new Error('Reorder failed'))

      const { result } = renderHook(() => useReorderPostImages(), {
        wrapper: createWrapper(),
      })

      const reorderData = { postId: 'post1', imageIds: ['img2', 'img1'] }
      
      await expect(result.current.mutateAsync(reorderData)).rejects.toThrow('Reorder failed')
    })
  })
}) 