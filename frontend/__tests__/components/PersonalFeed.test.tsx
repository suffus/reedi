import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PersonalFeed } from '../../components/dashboard/personal-feed'

// Mock the API hooks
jest.mock('../../lib/api-hooks', () => ({
  useAuth: jest.fn(),
  usePostsFeed: jest.fn(),
  useCreatePost: jest.fn(),
  usePostReaction: jest.fn(),
  useComments: jest.fn(),
  useCreateComment: jest.fn(),
  useReorderPostImages: jest.fn(),
}))

// Mock the API utility
jest.mock('../../lib/api', () => ({
  getImageUrl: jest.fn((url) => url),
}))

// Mock the modal components
jest.mock('../../components/dashboard/image-selector-modal', () => ({
  ImageSelectorModal: ({ isOpen, onClose, onImagesSelected }: any) => 
    isOpen ? (
      <div data-testid="image-selector-modal">
        <button onClick={() => onImagesSelected([{ id: '1', url: '/test.jpg' }])}>
          Select Image
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
const mockUsePostsFeed = require('../../lib/api-hooks').usePostsFeed
const mockUseCreatePost = require('../../lib/api-hooks').useCreatePost
const mockUsePostReaction = require('../../lib/api-hooks').usePostReaction
const mockUseCreateComment = require('../../lib/api-hooks').useCreateComment

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
    images: [],
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

    mockUsePostsFeed.mockReturnValue({
      data: { data: { posts: [mockPost] } },
      isLoading: false,
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
  })

  it('renders the create post form', () => {
    render(<PersonalFeed />)
    
    expect(screen.getByPlaceholderText("What's on your mind?")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /post/i })).toBeInTheDocument()
  })

  it('renders posts from the feed', () => {
    render(<PersonalFeed />)
    
    expect(screen.getByText('Test post content')).toBeInTheDocument()
    expect(screen.getByText('Test User')).toBeInTheDocument()
  })

  it('shows loading state when posts are loading', () => {
    mockUsePostsFeed.mockReturnValue({
      data: null,
      isLoading: true,
    })

    render(<PersonalFeed />)
    
    // Should show loading skeleton (elements with animate-pulse class)
    const loadingElements = document.querySelectorAll('.animate-pulse')
    expect(loadingElements.length).toBeGreaterThan(0)
  })

  it('allows creating a new post', async () => {
    const user = userEvent.setup()
    const mockMutateAsync = jest.fn()
    mockUseCreatePost.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    })

    render(<PersonalFeed />)
    
    const textarea = screen.getByPlaceholderText("What's on your mind?")
    const postButton = screen.getByRole('button', { name: /post/i })
    
    await user.type(textarea, 'New post content')
    await user.click(postButton)
    
    expect(mockMutateAsync).toHaveBeenCalledWith({
      content: 'New post content',
      imageIds: [],
    })
  })

  it('shows image selector modal when image button is clicked', async () => {
    const user = userEvent.setup()
    render(<PersonalFeed />)
    
    const imageButton = screen.getByLabelText('Add images')
    await user.click(imageButton)
    
    expect(screen.getByTestId('image-selector-modal')).toBeInTheDocument()
  })

  it('displays paused posts with overlay', () => {
    const pausedPost = {
      ...mockPost,
      publicationStatus: 'PAUSED' as const,
    }
    
    mockUsePostsFeed.mockReturnValue({
      data: { data: { posts: [pausedPost] } },
      isLoading: false,
    })

    render(<PersonalFeed />)
    
    expect(screen.getByText('Paused')).toBeInTheDocument()
    // Check for paused post styling
    const postElement = screen.getByText('Test post content').closest('div')
    expect(postElement).toHaveClass('bg-gray-50')
  })

  it('handles post reactions', async () => {
    const user = userEvent.setup()
    const mockMutateAsync = jest.fn()
    mockUsePostReaction.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    })

    render(<PersonalFeed />)
    
    const likeButton = screen.getByRole('button', { name: /0/i }) // Reaction count
    await user.click(likeButton)
    
    expect(mockMutateAsync).toHaveBeenCalledWith({
      postId: 'post1',
      type: 'LIKE',
    })
  })

  it('toggles comments section', async () => {
    const user = userEvent.setup()
    render(<PersonalFeed />)
    
    const commentsButton = screen.getByRole('button', { name: /0/i }) // Comment count
    await user.click(commentsButton)
    
    expect(screen.getByPlaceholderText('Write a comment...')).toBeInTheDocument()
  })

  it('allows adding comments', async () => {
    const user = userEvent.setup()
    const mockMutateAsync = jest.fn()
    mockUseCreateComment.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    })

    render(<PersonalFeed />)
    
    // Open comments
    const commentsButton = screen.getByRole('button', { name: /0/i })
    await user.click(commentsButton)
    
    // Add comment
    const commentInput = screen.getByPlaceholderText('Write a comment...')
    const sendButton = screen.getByRole('button', { name: /send/i })
    
    await user.type(commentInput, 'Test comment')
    await user.click(sendButton)
    
    expect(mockMutateAsync).toHaveBeenCalledWith({
      content: 'Test comment',
      postId: 'post1',
    })
  })

  it('displays single image posts correctly', () => {
    const postWithImage = {
      ...mockPost,
      images: [{
        id: 'img1',
        url: '/test-image.jpg',
        thumbnail: '/test-thumbnail.jpg',
        altText: 'Test image',
        caption: 'Test caption',
        width: 800,
        height: 600,
      }],
    }
    
    mockUsePostsFeed.mockReturnValue({
      data: { data: { posts: [postWithImage] } },
      isLoading: false,
    })

    render(<PersonalFeed />)
    
    const image = screen.getByAltText('Test image')
    expect(image).toBeInTheDocument()
    expect(image).toHaveClass('object-contain')
  })

  it('displays multiple image posts in grid layout', () => {
    const postWithImages = {
      ...mockPost,
      images: [
        {
          id: 'img1',
          url: '/test-image1.jpg',
          thumbnail: '/test-thumbnail1.jpg',
          altText: 'Test image 1',
          width: 800,
          height: 600,
        },
        {
          id: 'img2',
          url: '/test-image2.jpg',
          thumbnail: '/test-thumbnail2.jpg',
          altText: 'Test image 2',
          width: 800,
          height: 600,
        },
      ],
    }
    
    mockUsePostsFeed.mockReturnValue({
      data: { data: { posts: [postWithImages] } },
      isLoading: false,
    })

    render(<PersonalFeed />)
    
    expect(screen.getByAltText('Test image 1')).toBeInTheDocument()
    expect(screen.getByAltText('Test image 2')).toBeInTheDocument()
  })

  it('shows empty state when no posts exist', () => {
    mockUsePostsFeed.mockReturnValue({
      data: { data: { posts: [] } },
      isLoading: false,
    })

    render(<PersonalFeed />)
    
    expect(screen.getByText('No posts yet')).toBeInTheDocument()
    expect(screen.getByText('Be the first to share something with your family and friends!')).toBeInTheDocument()
  })
}) 