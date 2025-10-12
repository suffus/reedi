import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { 
  useAuth, 
  usePostsFeed, 
  useCreatePost, 
  usePostReaction, 
  useCreateComment, 
  useUserMedia, 
  useUploadMedia, 
  useUpdatePostStatus,
  useComments,
  useReorderPostMedia 
} from '../../lib/api-hooks'

// Mock localStorage for getToken function
const mockLocalStorage = {
  getItem: jest.fn(() => 'test-token'),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}

// Mock global fetch
global.fetch = jest.fn() as jest.Mock

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
    // Reset fetch mock
    ;(global.fetch as jest.Mock).mockClear()
  })

  describe('useAuth', () => {
    it('fetches user authentication data', async () => {
      const mockUser = { id: 'user1', name: 'Test User' }
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { user: mockUser } }),
      })

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data?.data.user).toEqual(mockUser)
      expect(global.fetch).toHaveBeenCalled()
    })

    it('handles authentication errors', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Unauthorized' }),
      })

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
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { posts: mockPosts } }),
      })

      const { result } = renderHook(() => usePostsFeed(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data?.data.posts).toEqual(mockPosts)
      expect(global.fetch).toHaveBeenCalled()
    })

    it('handles feed loading errors', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed to load feed' }),
      })

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
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockPost }),
      })

      const { result } = renderHook(() => useCreatePost(), {
        wrapper: createWrapper(),
      })

      const postData = { content: 'New post', mediaIds: [] }
      await result.current.mutateAsync(postData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })
    })

    it('handles post creation errors', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed to create post' }),
      })

      const { result } = renderHook(() => useCreatePost(), {
        wrapper: createWrapper(),
      })

      const postData = { content: 'New post', mediaIds: [] }
      
      await expect(result.current.mutateAsync(postData)).rejects.toThrow()
    })
  })

  describe('usePostReaction', () => {
    it('adds a reaction to a post', async () => {
      const mockReaction = { id: 'reaction1', type: 'LIKE' }
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockReaction }),
      })

      const { result } = renderHook(() => usePostReaction(), {
        wrapper: createWrapper(),
      })

      const reactionData = { postId: 'post1', type: 'LIKE' }
      await result.current.mutateAsync(reactionData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })
    })

    it('handles reaction errors', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed to add reaction' }),
      })

      const { result } = renderHook(() => usePostReaction(), {
        wrapper: createWrapper(),
      })

      const reactionData = { postId: 'post1', type: 'LIKE' }
      
      await expect(result.current.mutateAsync(reactionData)).rejects.toThrow()
    })
  })

  describe('useCreateComment', () => {
    it('creates a new comment', async () => {
      const mockComment = { id: 'comment1', content: 'New comment' }
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockComment }),
      })

      const { result } = renderHook(() => useCreateComment(), {
        wrapper: createWrapper(),
      })

      const commentData = { postId: 'post1', content: 'New comment' }
      await result.current.mutateAsync(commentData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })
    })

    it('handles comment creation errors', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed to create comment' }),
      })

      const { result } = renderHook(() => useCreateComment(), {
        wrapper: createWrapper(),
      })

      const commentData = { postId: 'post1', content: 'New comment' }
      
      await expect(result.current.mutateAsync(commentData)).rejects.toThrow()
    })
  })

  describe('useUserMedia', () => {
    it('fetches user media', async () => {
      const mockMedia = [
        { id: 'media1', url: '/test1.jpg' },
        { id: 'media2', url: '/test2.jpg' },
      ]
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          data: { 
            media: mockMedia,
            pagination: { page: 1, limit: 20, total: 2, hasNext: false }
          } 
        }),
      })

      const { result } = renderHook(() => useUserMedia('user1'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data?.data.media).toEqual(mockMedia)
    })

    it('loads more media with pagination', async () => {
      const mockMediaPage1 = [{ id: 'media1', url: '/test1.jpg' }]
      const mockMediaPage2 = [{ id: 'media2', url: '/test2.jpg' }]
      
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ 
            data: { 
              media: mockMediaPage1,
              pagination: { page: 1, limit: 20, total: 2, hasNext: true }
            } 
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ 
            data: { 
              media: mockMediaPage2,
              pagination: { page: 2, limit: 20, total: 2, hasNext: false }
            } 
          }),
        })

      const { result } = renderHook(() => useUserMedia('user1'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      result.current.loadMore()

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2)
      })
    })

    it('handles media loading errors', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed to load media' }),
      })

      const { result } = renderHook(() => useUserMedia('user1'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      })
    })
  })

  describe('useUploadMedia', () => {
    it('uploads media', async () => {
      const mockMedia = { id: 'media1', url: '/uploaded.jpg' }
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockMedia }),
      })

      const { result } = renderHook(() => useUploadMedia(), {
        wrapper: createWrapper(),
      })

      const formData = new FormData()
      formData.append('file', new File(['test'], 'test.jpg'))
      
      await result.current.mutateAsync(formData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })
    })

    it('handles upload errors', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Upload failed' }),
      })

      const { result } = renderHook(() => useUploadMedia(), {
        wrapper: createWrapper(),
      })

      const formData = new FormData()
      formData.append('file', new File(['test'], 'test.jpg'))
      
      await expect(result.current.mutateAsync(formData)).rejects.toThrow()
    })
  })

  describe('useUpdatePostStatus', () => {
    it('updates post publication status', async () => {
      const mockPost = { id: 'post1', publicationStatus: 'PAUSED' }
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockPost }),
      })

      const { result } = renderHook(() => useUpdatePostStatus(), {
        wrapper: createWrapper(),
      })

      const updateData = { postId: 'post1', publicationStatus: 'PAUSED' as const }
      await result.current.mutateAsync(updateData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })
    })

    it('handles status update errors', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Update failed' }),
      })

      const { result } = renderHook(() => useUpdatePostStatus(), {
        wrapper: createWrapper(),
      })

      const updateData = { postId: 'post1', publicationStatus: 'PAUSED' as const }
      
      await expect(result.current.mutateAsync(updateData)).rejects.toThrow()
    })
  })

  describe('useComments', () => {
    it('fetches comments for a post', async () => {
      const mockComments = [
        { id: 'comment1', content: 'Comment 1' },
        { id: 'comment2', content: 'Comment 2' },
      ]
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { comments: mockComments } }),
      })

      const { result } = renderHook(() => useComments('post1'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data?.data.comments).toEqual(mockComments)
    })

    it('handles comment loading errors', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed to load comments' }),
      })

      const { result } = renderHook(() => useComments('post1'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      })
    })
  })

  describe('useReorderPostMedia', () => {
    it('reorders post media', async () => {
      const mockResult = { success: true }
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockResult }),
      })

      const { result } = renderHook(() => useReorderPostMedia(), {
        wrapper: createWrapper(),
      })

      const reorderData = { postId: 'post1', mediaIds: ['media2', 'media1'] }
      await result.current.mutateAsync(reorderData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })
    })

    it('handles reorder errors', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Reorder failed' }),
      })

      const { result } = renderHook(() => useReorderPostMedia(), {
        wrapper: createWrapper(),
      })

      const reorderData = { postId: 'post1', mediaIds: ['media2', 'media1'] }
      
      await expect(result.current.mutateAsync(reorderData)).rejects.toThrow()
    })
  })
})

// Import additional hooks for expanded tests
import {
  useLogin,
  useRegister,
  useUpdateProfile,
  useUpdateMedia,
  useBulkUpdateMedia,
  useDeleteMedia,
  useCreateGallery,
  useUpdateGallery,
  useAddMediaToGallery,
  useRemoveMediaFromGallery,
  useReorderGalleryMedia,
  useDeleteGallery,
  useUpdatePostVisibility,
  useMyGalleries,
  useFilteredUserMedia,
} from '../../lib/api-hooks'

describe('API Hooks - Expanded Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    })
    // Reset and configure fetch mock
    ;(global.fetch as jest.Mock).mockClear()
    ;(global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: {} }),
      })
    )
  })

  describe('Authentication Hooks', () => {
    describe('useLogin', () => {
      it('logs in a user', async () => {
        const mockResponse = { data: { token: 'test-token', user: { id: 'user1', name: 'Test' } } }
        ;(global.fetch as jest.Mock).mockImplementation(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockResponse),
          })
        )

        const { result } = renderHook(() => useLogin(), {
          wrapper: createWrapper(),
        })

        const credentials = { email: 'test@example.com', password: 'password123' }
        await result.current.mutateAsync(credentials)

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true)
        })
      })

      it('handles login errors', async () => {
        ;(global.fetch as jest.Mock).mockImplementation(() =>
          Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Invalid credentials' }),
          })
        )

        const { result } = renderHook(() => useLogin(), {
          wrapper: createWrapper(),
        })

        const credentials = { email: 'test@example.com', password: 'wrong' }
        await expect(result.current.mutateAsync(credentials)).rejects.toThrow()
      })
    })

    describe('useRegister', () => {
      it('registers a new user', async () => {
        const mockResponse = { data: { token: 'test-token', user: { id: 'user1', name: 'Test' } } }
        ;(global.fetch as jest.Mock).mockImplementation(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockResponse),
          })
        )

        const { result } = renderHook(() => useRegister(), {
          wrapper: createWrapper(),
        })

        const userData = {
          email: 'new@example.com',
          password: 'password123',
          name: 'New User',
          username: 'newuser',
        }
        await result.current.mutateAsync(userData)

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true)
        })
      })

      it('handles registration errors', async () => {
        ;(global.fetch as jest.Mock).mockImplementation(() =>
          Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Email already exists' }),
          })
        )

        const { result } = renderHook(() => useRegister(), {
          wrapper: createWrapper(),
        })

        const userData = { email: 'existing@example.com', password: 'password123' }
        await expect(result.current.mutateAsync(userData)).rejects.toThrow()
      })
    })

    describe('useUpdateProfile', () => {
      it('updates user profile', async () => {
        const mockResponse = { data: { user: { id: 'user1', name: 'Updated Name', bio: 'New bio' } } }
        ;(global.fetch as jest.Mock).mockImplementation(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockResponse),
          })
        )

        const { result } = renderHook(() => useUpdateProfile(), {
          wrapper: createWrapper(),
        })

        const updates = { name: 'Updated Name', bio: 'New bio' }
        await result.current.mutateAsync(updates)

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true)
        })
      })

      it('handles profile update errors', async () => {
        ;(global.fetch as jest.Mock).mockImplementation(() =>
          Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Update failed' }),
          })
        )

        const { result } = renderHook(() => useUpdateProfile(), {
          wrapper: createWrapper(),
        })

        await expect(result.current.mutateAsync({ name: 'Test' })).rejects.toThrow()
      })
    })
  })

  describe('Media Management Hooks', () => {
    describe('useUserMedia', () => {
      it('fetches user media', async () => {
        const mockMedia = [
          { id: 'media1', url: '/test1.jpg' },
          { id: 'media2', url: '/test2.jpg' },
        ]
        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ 
            data: { 
              media: mockMedia,
              pagination: { page: 1, limit: 20, total: 2, hasNext: false }
            }
          }),
        })

        const { result } = renderHook(() => useUserMedia('user1'), {
          wrapper: createWrapper(),
        })

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.data?.data.media).toEqual(mockMedia)
      })
    })

    describe('useFilteredUserMedia', () => {
      it('fetches filtered media', async () => {
        const mockMedia = [{ id: 'media1', mediaType: 'IMAGE' }]
        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ 
            data: { 
              media: mockMedia,
              pagination: { page: 1, limit: 20, total: 1, hasNext: false }
            }
          }),
        })

        const { result } = renderHook(
          () => useFilteredUserMedia('user1', { mediaType: 'IMAGE' }),
          { wrapper: createWrapper() }
        )

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.data?.data.media).toEqual(mockMedia)
      })
    })

    describe('useUpdateMedia', () => {
      it('updates media metadata', async () => {
        const mockMedia = { id: 'media1', caption: 'Updated caption' }
        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { media: mockMedia } }),
        })

        const { result } = renderHook(() => useUpdateMedia(), {
          wrapper: createWrapper(),
        })

        const updateData = { mediaId: 'media1', description: 'Updated caption' }
        await result.current.mutateAsync(updateData)

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true)
        })
      })

      it('handles update errors', async () => {
        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Update failed' }),
        })

        const { result } = renderHook(() => useUpdateMedia(), {
          wrapper: createWrapper(),
        })

        await expect(
          result.current.mutateAsync({ mediaId: 'media1', description: 'Test' })
        ).rejects.toThrow()
      })
    })

    describe('useBulkUpdateMedia', () => {
      it('updates multiple media items with replace mode', async () => {
        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { updated: 2 } }),
        })

        const { result } = renderHook(() => useBulkUpdateMedia(), {
          wrapper: createWrapper(),
        })

        const updateData = {
          mediaIds: ['media1', 'media2'],
          tags: ['new', 'tags'],
          mergeTags: false,
        }
        await result.current.mutateAsync(updateData)

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true)
        })
      })

      it('updates multiple media items with merge mode', async () => {
        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { updated: 2 } }),
        })

        const { result } = renderHook(() => useBulkUpdateMedia(), {
          wrapper: createWrapper(),
        })

        const updateData = {
          mediaIds: ['media1', 'media2'],
          tags: ['additional'],
          mergeTags: true,
        }
        await result.current.mutateAsync(updateData)

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true)
        })
      })

      it('updates visibility for multiple media', async () => {
        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { updated: 2 } }),
        })

        const { result } = renderHook(() => useBulkUpdateMedia(), {
          wrapper: createWrapper(),
        })

        const updateData = {
          mediaIds: ['media1', 'media2'],
          visibility: 'PRIVATE',
        }
        await result.current.mutateAsync(updateData)

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true)
        })
      })

      it('handles bulk update errors', async () => {
        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Bulk update failed' }),
        })

        const { result } = renderHook(() => useBulkUpdateMedia(), {
          wrapper: createWrapper(),
        })

        await expect(
          result.current.mutateAsync({ mediaIds: ['media1'], tags: ['test'] })
        ).rejects.toThrow()
      })
    })

    describe('useDeleteMedia', () => {
      it('deletes media', async () => {
        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { success: true } }),
        })

        const { result } = renderHook(() => useDeleteMedia(), {
          wrapper: createWrapper(),
        })

        await result.current.mutateAsync('media1')

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true)
        })
      })

      it('handles delete errors', async () => {
        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Delete failed' }),
        })

        const { result } = renderHook(() => useDeleteMedia(), {
          wrapper: createWrapper(),
        })

        await expect(result.current.mutateAsync('media1')).rejects.toThrow()
      })
    })
  })

  describe('Gallery Management Hooks', () => {
    describe('useMyGalleries', () => {
      it('fetches user galleries', async () => {
        const mockGalleries = [
          { id: 'gallery1', name: 'Gallery 1' },
          { id: 'gallery2', name: 'Gallery 2' },
        ]
        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ 
            data: { 
              galleries: mockGalleries,
              pagination: { page: 1, limit: 20, total: 2, hasNext: false }
            }
          }),
        })

        const { result } = renderHook(() => useMyGalleries(), {
          wrapper: createWrapper(),
        })

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.data?.data.galleries).toEqual(mockGalleries)
      })
    })

    describe('useCreateGallery', () => {
      it('creates a new gallery', async () => {
        const mockGallery = { id: 'gallery1', name: 'New Gallery' }
        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { gallery: mockGallery } }),
        })

        const { result } = renderHook(() => useCreateGallery(), {
          wrapper: createWrapper(),
        })

        const galleryData = {
          name: 'New Gallery',
          description: 'Test description',
          visibility: 'PUBLIC' as const,
        }
        await result.current.mutateAsync(galleryData)

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true)
        })
      })

      it('handles creation errors', async () => {
        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Creation failed' }),
        })

        const { result } = renderHook(() => useCreateGallery(), {
          wrapper: createWrapper(),
        })

        await expect(
          result.current.mutateAsync({ name: 'Test', visibility: 'PUBLIC' as const })
        ).rejects.toThrow()
      })
    })

    describe('useUpdateGallery', () => {
      it('updates gallery details', async () => {
        const mockGallery = { id: 'gallery1', name: 'Updated Gallery' }
        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { gallery: mockGallery } }),
        })

        const { result } = renderHook(() => useUpdateGallery(), {
          wrapper: createWrapper(),
        })

        const updateData = {
          galleryId: 'gallery1',
          name: 'Updated Gallery',
          description: 'New description',
        }
        await result.current.mutateAsync(updateData)

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true)
        })
      })
    })

    describe('useAddMediaToGallery', () => {
      it('adds media to gallery', async () => {
        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { gallery: { id: 'gallery1' } } }),
        })

        const { result } = renderHook(() => useAddMediaToGallery(), {
          wrapper: createWrapper(),
        })

        const addData = {
          galleryId: 'gallery1',
          mediaIds: ['media1', 'media2'],
        }
        await result.current.mutateAsync(addData)

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true)
        })
      })
    })

    describe('useRemoveMediaFromGallery', () => {
      it('removes media from gallery', async () => {
        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { success: true } }),
        })

        const { result } = renderHook(() => useRemoveMediaFromGallery(), {
          wrapper: createWrapper(),
        })

        const removeData = {
          galleryId: 'gallery1',
          mediaIds: ['media1'],
        }
        await result.current.mutateAsync(removeData)

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true)
        })
      })
    })

    describe('useReorderGalleryMedia', () => {
      it('reorders gallery media', async () => {
        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ data: { success: true } }),
        })

        const { result } = renderHook(() => useReorderGalleryMedia(), {
          wrapper: createWrapper(),
        })

        const reorderData = {
          galleryId: 'gallery1',
          mediaIds: ['media2', 'media1', 'media3'],
        }
        await result.current.mutateAsync(reorderData)

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true)
        })
      })
    })

    describe('useDeleteGallery', () => {
      it('deletes a gallery', async () => {
        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { success: true } }),
        })

        const { result } = renderHook(() => useDeleteGallery(), {
          wrapper: createWrapper(),
        })

        await result.current.mutateAsync('gallery1')

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true)
        })
      })
    })
  })

  describe('Post Management Hooks', () => {
    describe('useUpdatePostVisibility', () => {
      it('updates post visibility', async () => {
        const mockPost = { id: 'post1', visibility: 'FRIENDS_ONLY' }
        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { post: mockPost } }),
        })

        const { result } = renderHook(() => useUpdatePostVisibility(), {
          wrapper: createWrapper(),
        })

        const updateData = {
          postId: 'post1',
          visibility: 'FRIENDS_ONLY' as const,
        }
        await result.current.mutateAsync(updateData)

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true)
        })
      })
    })
  })
}) 