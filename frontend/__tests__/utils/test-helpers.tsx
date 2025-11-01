import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'

// Create a custom render function that includes providers
export function renderWithProviders(
  ui: ReactElement,
  {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          cacheTime: 0,
        },
        mutations: {
          retry: false,
        },
      },
    }),
    ...renderOptions
  }: { queryClient?: QueryClient } & Omit<RenderOptions, 'wrapper'> = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  }
}

// Create user event instance for simulating user interactions
export const createUser = () => userEvent.setup()

// Mock data generators
export const mockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  username: 'testuser',
  avatar: null,
  bio: 'Test bio',
  location: null,
  website: null,
  isVerified: false,
  isPrivate: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

export const mockPost = (overrides = {}) => ({
  id: 'test-post-id',
  title: 'Test Post Title',
  content: 'Test post content',
  authorId: 'test-user-id',
  visibility: 'PUBLIC',
  publicationStatus: 'PUBLIC',
  isLocked: false,
  unlockPrice: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  author: mockUser(),
  media: [],
  hashtags: [],
  _count: {
    comments: 0,
    reactions: 0,
  },
  ...overrides,
})

export const mockMedia = (overrides = {}) => ({
  id: 'test-media-id',
  s3Key: 'test-key',
  url: '/api/media/serve/test-media-id',
  thumbnail: '/api/media/serve/test-media-id/thumbnail',
  altText: 'Test image',
  caption: 'Test caption',
  width: 1920,
  height: 1080,
  size: 1024000,
  mimeType: 'image/jpeg',
  tags: ['test', 'image'],
  mediaType: 'IMAGE',
  visibility: 'PUBLIC',
  processingStatus: 'COMPLETED',
  authorId: 'test-user-id',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

export const mockGallery = (overrides = {}) => ({
  id: 'test-gallery-id',
  name: 'Test Gallery',
  description: 'Test gallery description',
  visibility: 'PUBLIC',
  userId: 'test-user-id',
  coverMediaId: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  media: [],
  _count: {
    media: 0,
  },
  ...overrides,
})

export const mockComment = (overrides = {}) => ({
  id: 'test-comment-id',
  content: 'Test comment content',
  postId: 'test-post-id',
  authorId: 'test-user-id',
  parentId: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  author: mockUser(),
  replies: [],
  reactions: [],
  ...overrides,
})

export const mockFriendRequest = (overrides = {}) => ({
  id: 'test-request-id',
  senderId: 'sender-id',
  receiverId: 'receiver-id',
  status: 'PENDING',
  createdAt: new Date().toISOString(),
  sender: mockUser({ id: 'sender-id' }),
  receiver: mockUser({ id: 'receiver-id' }),
  ...overrides,
})

export const mockGroup = (overrides = {}) => ({
  id: 'test-group-id',
  name: 'Test Group',
  username: 'testgroup',
  description: 'Test group description',
  visibility: 'PUBLIC',
  type: 'GENERAL',
  moderationPolicy: 'NO_MODERATION',
  createdAt: new Date().toISOString(),
  members: [],
  _count: {
    members: 1,
    posts: 0,
  },
  ...overrides,
})

// Helper to create a File object for upload testing
export const createMockFile = (
  name = 'test.jpg',
  size = 1024,
  type = 'image/jpeg'
) => {
  const file = new File(['test'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

// Helper to wait for loading to finish
export const waitForLoadingToFinish = async () => {
  const { waitFor } = await import('@testing-library/react')
  await waitFor(() => {
    expect(document.querySelector('[data-testid="loading"]')).not.toBeInTheDocument()
  }, { timeout: 3000 })
}

// Helper to set up authenticated user in localStorage
export const setupAuthenticatedUser = (token = 'mock-token', user = mockUser()) => {
  localStorage.setItem('token', token)
  localStorage.setItem('user', JSON.stringify(user))
  return { token, user }
}

// Helper to clear authentication
export const clearAuth = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

// Re-export everything from RTL
export * from '@testing-library/react'







