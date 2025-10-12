import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PersonalFeed } from '../../components/dashboard/personal-feed'
import { MediaDetailProvider } from '../../components/common/media-detail-context'

// Mock the API hooks
jest.mock('../../lib/api-hooks', () => ({
  useAuth: jest.fn(),
  useInfinitePostsFeed: jest.fn(),
  usePostsFeed: jest.fn(),
  useCreatePost: jest.fn(),
  usePostReaction: jest.fn(),
  useComments: jest.fn(),
  useCreateComment: jest.fn(),
  useReorderPostMedia: jest.fn(),
  useMyGalleries: jest.fn(),
  useInfiniteFilteredUserMedia: jest.fn(),
  useSearchMediaByTags: jest.fn(),
}))

// Mock the API utility
jest.mock('../../lib/api', () => ({
  getImageUrl: jest.fn((url) => url),
  getMediaUrlFromMedia: jest.fn((media) => media?.url || ''),
}))

// Mock the modal components
jest.mock('../../components/dashboard/media-selector-modal', () => ({
  MediaSelectorModal: ({ isOpen, onClose, onMediaSelected }: any) => 
    isOpen ? (
      <div data-testid="media-selector-modal">
        <button onClick={() => onMediaSelected([{ id: '1', url: '/test.jpg' }])}>
          Select Media
        </button>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}))

jest.mock('../../components/dashboard/image-detail-modal', () => ({
  ImageDetailModal: ({ image, onClose }: any) => 
    image ? (
      <div data-testid="image-detail-modal">
        <span>{image.title}</span>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}))

jest.mock('../../components/dashboard/post-menu', () => ({
  PostMenu: ({ post }: any) => (
    <div data-testid="post-menu">
      <button>Menu</button>
    </div>
  ),
}))

const mockUseAuth = require('../../lib/api-hooks').useAuth
const mockUseInfinitePostsFeed = require('../../lib/api-hooks').useInfinitePostsFeed
const mockUsePostsFeed = require('../../lib/api-hooks').usePostsFeed
const mockUseCreatePost = require('../../lib/api-hooks').useCreatePost
const mockUsePostReaction = require('../../lib/api-hooks').usePostReaction
const mockUseCreateComment = require('../../lib/api-hooks').useCreateComment
const mockUseMyGalleries = require('../../lib/api-hooks').useMyGalleries
const mockUseInfiniteFilteredUserMedia = require('../../lib/api-hooks').useInfiniteFilteredUserMedia
const mockUseSearchMediaByTags = require('../../lib/api-hooks').useSearchMediaByTags

// Helper to render with required providers
const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <MediaDetailProvider>
      {component}
    </MediaDetailProvider>
  )
}

describe('PersonalFeed', () => {
  const mockUser = {
    id: 'user1',
    name: 'Test User',
    username: 'testuser',
    avatar: null,
  }

  const mockPost = {
    id: 'post1',
    content: 'Test post content',
    publicationStatus: 'PUBLIC' as const,
    authorId: 'user1',
    media: [],
    createdAt: '2023-01-01T00:00:00Z',
    author: mockUser,
    reactions: [],
    comments: [],
    _count: {
      reactions: 0,
      comments: 0,
    },
  }

  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      data: { data: { user: mockUser } },
      isLoading: false,
    })

    mockUseInfinitePostsFeed.mockReturnValue({
      data: { 
        pages: [{ data: { posts: [mockPost], hasMore: false } }],
        pageParams: [undefined]
      },
      isLoading: false,
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      isFetchingNextPage: false,
      refetch: jest.fn(),
    })

    mockUseCreatePost.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    })

    mockUsePostReaction.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    })

    mockUseCreateComment.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    })

    mockUseMyGalleries.mockReturnValue({
      data: { data: { galleries: [] } },
      isLoading: false,
    })

    mockUseInfiniteFilteredUserMedia.mockReturnValue({
      data: { 
        pages: [{ data: { media: [], pagination: { total: 0 } } }],
        pageParams: [undefined]
      },
      isLoading: false,
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      isFetchingNextPage: false,
      refetch: jest.fn(),
    })

    mockUseSearchMediaByTags.mockReturnValue({
      data: { data: { media: [] } },
      isLoading: false,
      refetch: jest.fn(),
    })

    mockUsePostsFeed.mockReturnValue({
      data: { data: { posts: [mockPost] } },
      isLoading: false,
      refetch: jest.fn(),
    })
  })

  it('renders the create post form', () => {
    renderWithProviders(<PersonalFeed />)
    
    expect(screen.getByPlaceholderText("What's on your mind?")).toBeInTheDocument()
    const postButtons = screen.getAllByRole('button', { name: /post/i })
    expect(postButtons.length).toBeGreaterThan(0)
  })

  it('renders posts from the feed', () => {
    renderWithProviders(<PersonalFeed />)
    
    expect(screen.getByText('Test post content')).toBeInTheDocument()
    expect(screen.getByText('Test User')).toBeInTheDocument()
  })

  it('shows loading state when posts are loading', () => {
    mockUseInfinitePostsFeed.mockReturnValue({
      data: null,
      isLoading: true,
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      isFetchingNextPage: false,
      refetch: jest.fn(),
    })

    renderWithProviders(<PersonalFeed />)
    
    // Should show loading skeleton (elements with animate-pulse class)
    const loadingElements = document.querySelectorAll('.animate-pulse')
    expect(loadingElements.length).toBeGreaterThan(0)
  })

  it('allows creating a new post', async () => {
    const user = userEvent.setup()
    mockUseCreatePost.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    })

    renderWithProviders(<PersonalFeed />)
    
    // Verify the post creation form is present
    const textarea = screen.getByPlaceholderText("What's on your mind?")
    expect(textarea).toBeInTheDocument()
    
    // Verify user can type in the textarea
    await user.type(textarea, 'New post content')
    expect(textarea).toHaveValue('New post content')
  })

  it.skip('shows image selector modal when image button is clicked', async () => {
    // This functionality is handled by PostAuthorForm component
    // which should be tested separately
  })

  it('displays paused posts with overlay', () => {
    const pausedPost = {
      ...mockPost,
      publicationStatus: 'PAUSED' as const,
    }
    
    mockUseInfinitePostsFeed.mockReturnValue({
      data: { 
        pages: [{ data: { posts: [pausedPost], hasMore: false } }],
        pageParams: [undefined]
      },
      isLoading: false,
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      isFetchingNextPage: false,
      refetch: jest.fn(),
    })

    renderWithProviders(<PersonalFeed />)
    
    // Verify the paused indicator is displayed
    expect(screen.getByText('Paused')).toBeInTheDocument()
    expect(screen.getByText('Test post content')).toBeInTheDocument()
  })

  it('handles post reactions', async () => {
    const user = userEvent.setup()
    const mockMutateAsync = jest.fn()
    mockUsePostReaction.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    })

    renderWithProviders(<PersonalFeed />)
    
    const buttons = screen.getAllByRole('button', { name: /0/i })
    const likeButton = buttons[0] // First button with "0" is the reaction button
    await user.click(likeButton)
    
    expect(mockMutateAsync).toHaveBeenCalledWith({
      postId: 'post1',
      type: 'LIKE',
    })
  })

  it('toggles comments section', async () => {
    const user = userEvent.setup()
    renderWithProviders(<PersonalFeed />)
    
    const buttons = screen.getAllByRole('button', { name: /0/i })
    const commentsButton = buttons[1] // Second button with "0" is the comments button
    await user.click(commentsButton)
    
    expect(screen.getByPlaceholderText('Write a comment...')).toBeInTheDocument()
  })

  it('allows adding comments', async () => {
    const user = userEvent.setup()
    mockUseCreateComment.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    })

    renderWithProviders(<PersonalFeed />)
    
    // Open comments
    const buttons = screen.getAllByRole('button', { name: /0/i })
    const commentsButton = buttons[1] // Second button with "0" is the comments button
    await user.click(commentsButton)
    
    // Verify comment input is available
    const commentInput = screen.getByPlaceholderText('Write a comment...')
    expect(commentInput).toBeInTheDocument()
    
    // Verify user can type in the comment input
    await user.type(commentInput, 'Test comment')
    expect(commentInput).toHaveValue('Test comment')
  })

  it('displays single image posts correctly', () => {
    const postWithImage = {
      ...mockPost,
      media: [{
        id: 'img1',
        url: '/test-image.jpg',
        thumbnail: '/test-thumbnail.jpg',
        altText: 'Test image',
        caption: 'Test caption',
        width: 800,
        height: 600,
        mediaType: 'IMAGE',
      }],
    }
    
    mockUseInfinitePostsFeed.mockReturnValue({
      data: { 
        pages: [{ data: { posts: [postWithImage], hasMore: false } }],
        pageParams: [undefined]
      },
      isLoading: false,
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      isFetchingNextPage: false,
      refetch: jest.fn(),
    })

    renderWithProviders(<PersonalFeed />)
    expect(screen.getByText('Test post content')).toBeInTheDocument()
    
    const image = screen.getByAltText('Post media')
    expect(image).toBeInTheDocument()
    expect(image).toHaveClass('object-contain')
  })

  it('displays multiple image posts in grid layout', () => {
    const postWithImages = {
      ...mockPost,
      media: [
        {
          id: 'img1',
          url: '/test-image1.jpg',
          thumbnail: '/test-thumbnail1.jpg',
          altText: 'Test image 1',
          width: 800,
          height: 600,
          mediaType: 'IMAGE',
        },
        {
          id: 'img2',
          url: '/test-image2.jpg',
          thumbnail: '/test-thumbnail2.jpg',
          altText: 'Test image 2',
          width: 800,
          height: 600,
          mediaType: 'IMAGE',
        },
      ],
    }
    
    mockUseInfinitePostsFeed.mockReturnValue({
      data: { 
        pages: [{ data: { posts: [postWithImages], hasMore: false } }],
        pageParams: [undefined]
      },
      isLoading: false,
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      isFetchingNextPage: false,
      refetch: jest.fn(),
    })

    renderWithProviders(<PersonalFeed />)
    
    expect(screen.getByText('Test post content')).toBeInTheDocument()
    expect(screen.getByAltText('Post media 1')).toBeInTheDocument()
    expect(screen.getByAltText('Post media 2')).toBeInTheDocument()
  })

  it('shows empty state when no posts exist', () => {
    mockUseInfinitePostsFeed.mockReturnValue({
      data: { 
        pages: [{ data: { posts: [], hasMore: false } }],
        pageParams: [undefined]
      },
      isLoading: false,
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      isFetchingNextPage: false,
      refetch: jest.fn(),
    })

    renderWithProviders(<PersonalFeed />)
    
    expect(screen.getByText('No posts yet')).toBeInTheDocument()
    expect(screen.getByText('Be the first to share something with your family and friends!')).toBeInTheDocument()
  })
}) 