import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PostMenu } from '../../components/dashboard/post-menu'

// Mock the API hooks
jest.mock('../../lib/api-hooks', () => ({
  useUpdatePostStatus: jest.fn(),
  useUpdatePostVisibility: jest.fn(),
}))

const mockUseUpdatePostStatus = require('../../lib/api-hooks').useUpdatePostStatus
const mockUseUpdatePostVisibility = require('../../lib/api-hooks').useUpdatePostVisibility

describe('PostMenu', () => {
  const mockPost = {
    id: 'post1',
    content: 'Test post content',
    publicationStatus: 'PUBLIC' as const,
    visibility: 'PUBLIC' as const,
    authorId: 'user1',
    images: [],
    createdAt: '2023-01-01T00:00:00Z',
    author: {
      id: 'user1',
      name: 'Test User',
      username: 'testuser',
      avatar: null,
    },
    reactions: [],
    comments: [],
    _count: {
      reactions: 0,
      comments: 0,
    },
  }

  const defaultProps = {
    post: mockPost,
    currentUserId: 'user1',
    onClose: jest.fn(),
  }

  beforeEach(() => {
    mockUseUpdatePostStatus.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    })
    mockUseUpdatePostVisibility.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    })
  })

  it('renders menu button', () => {
    render(<PostMenu {...defaultProps} />)
    
    expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument()
  })

  it('opens menu when button is clicked', async () => {
    const user = userEvent.setup()
    render(<PostMenu {...defaultProps} />)
    
    const menuButton = screen.getByRole('button', { name: /menu/i })
    await user.click(menuButton)
    
    expect(screen.getByText('Pause')).toBeInTheDocument()
    expect(screen.getByText('Control Visibility')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('shows pause option for public posts', async () => {
    const user = userEvent.setup()
    render(<PostMenu {...defaultProps} />)
    
    const menuButton = screen.getByRole('button', { name: /menu/i })
    await user.click(menuButton)
    
    expect(screen.getByText('Pause')).toBeInTheDocument()
  })

  it('shows unpause option for paused posts', async () => {
    const user = userEvent.setup()
    const pausedPost = { ...mockPost, publicationStatus: 'PAUSED' as const }
    
    render(<PostMenu {...defaultProps} post={pausedPost} />)
    
    const menuButton = screen.getByRole('button', { name: /menu/i })
    await user.click(menuButton)
    
    expect(screen.getByText('Unpause')).toBeInTheDocument()
  })

  it('handles pausing a post', async () => {
    const user = userEvent.setup()
    const mockMutateAsync = jest.fn()
    mockUseUpdatePostStatus.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    })
    
    render(<PostMenu {...defaultProps} />)
    
    const menuButton = screen.getByRole('button', { name: /menu/i })
    await user.click(menuButton)
    
    const pauseButton = screen.getByText('Pause')
    await user.click(pauseButton)
    
    expect(mockMutateAsync).toHaveBeenCalledWith({
      postId: 'post1',
      publicationStatus: 'PAUSED',
    })
  })

  it('handles unpausing a post', async () => {
    const user = userEvent.setup()
    const mockMutateAsync = jest.fn()
    mockUseUpdatePostStatus.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    })
    
    const pausedPost = { ...mockPost, publicationStatus: 'PAUSED' as const }
    render(<PostMenu {...defaultProps} post={pausedPost} />)
    
    const menuButton = screen.getByRole('button', { name: /menu/i })
    await user.click(menuButton)
    
    const unpauseButton = screen.getByText('Unpause')
    await user.click(unpauseButton)
    
    expect(mockMutateAsync).toHaveBeenCalledWith({
      postId: 'post1',
      publicationStatus: 'PUBLIC',
    })
  })

  it('shows control visibility option', async () => {
    const user = userEvent.setup()
    render(<PostMenu {...defaultProps} />)
    
    const menuButton = screen.getByRole('button', { name: /menu/i })
    await user.click(menuButton)
    
    const controlVisibilityButton = screen.getByText('Control Visibility')
    await user.click(controlVisibilityButton)
    
    expect(screen.getByText('Control Post Visibility')).toBeInTheDocument()
    expect(screen.getByText('Choose who can see this post:')).toBeInTheDocument()
  })

  it('closes control visibility modal', async () => {
    const user = userEvent.setup()
    render(<PostMenu {...defaultProps} />)
    
    const menuButton = screen.getByRole('button', { name: /menu/i })
    await user.click(menuButton)
    
    const controlVisibilityButton = screen.getByText('Control Visibility')
    await user.click(controlVisibilityButton)
    
    const cancelButton = screen.getByText('Cancel')
    await user.click(cancelButton)
    
    expect(screen.queryByText('Control Post Visibility')).not.toBeInTheDocument()
  })

  it('handles visibility change to friends only', async () => {
    const user = userEvent.setup()
    const mockMutateAsync = jest.fn()
    mockUseUpdatePostVisibility.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    })
    
    render(<PostMenu {...defaultProps} />)
    
    const menuButton = screen.getByRole('button', { name: /menu/i })
    await user.click(menuButton)
    
    const controlVisibilityButton = screen.getByText('Control Visibility')
    await user.click(controlVisibilityButton)
    
    const friendsOnlyButton = screen.getByText('Friends Only')
    await user.click(friendsOnlyButton)
    
    expect(mockMutateAsync).toHaveBeenCalledWith({
      postId: 'post1',
      visibility: 'FRIENDS_ONLY',
    })
  })

  it('shows delete confirmation modal', async () => {
    const user = userEvent.setup()
    render(<PostMenu {...defaultProps} />)
    
    const menuButton = screen.getByRole('button', { name: /menu/i })
    await user.click(menuButton)
    
    const deleteButton = screen.getByText('Delete')
    await user.click(deleteButton)
    
    expect(screen.getByText('Delete Post')).toBeInTheDocument()
    expect(screen.getByText('Are you sure you want to delete this post?')).toBeInTheDocument()
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument()
  })

  it('handles post deletion', async () => {
    const user = userEvent.setup()
    const mockMutateAsync = jest.fn()
    mockUseUpdatePostStatus.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    })
    
    render(<PostMenu {...defaultProps} />)
    
    const menuButton = screen.getByRole('button', { name: /menu/i })
    await user.click(menuButton)
    
    const deleteButton = screen.getByText('Delete')
    await user.click(deleteButton)
    
    const confirmDeleteButton = screen.getByText('Delete Post')
    await user.click(confirmDeleteButton)
    
    expect(mockMutateAsync).toHaveBeenCalledWith({
      postId: 'post1',
      publicationStatus: 'DELETED',
    })
  })

  it('cancels post deletion', async () => {
    const user = userEvent.setup()
    render(<PostMenu {...defaultProps} />)
    
    const menuButton = screen.getByRole('button', { name: /menu/i })
    await user.click(menuButton)
    
    const deleteButton = screen.getByText('Delete')
    await user.click(deleteButton)
    
    const cancelButton = screen.getByText('Cancel')
    await user.click(cancelButton)
    
    expect(screen.queryByText('Delete Post')).not.toBeInTheDocument()
  })

  it('shows loading state during status update', async () => {
    const user = userEvent.setup()
    mockUseUpdatePostStatus.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: true,
    })
    
    render(<PostMenu {...defaultProps} />)
    
    const menuButton = screen.getByRole('button', { name: /menu/i })
    await user.click(menuButton)
    
    const pauseButton = screen.getByText('Pause')
    await user.click(pauseButton)
    
    expect(screen.getByText('Updating...')).toBeInTheDocument()
  })

  it('handles error during status update', async () => {
    const user = userEvent.setup()
    const mockMutateAsync = jest.fn().mockRejectedValue(new Error('Update failed'))
    mockUseUpdatePostStatus.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    })
    
    render(<PostMenu {...defaultProps} />)
    
    const menuButton = screen.getByRole('button', { name: /menu/i })
    await user.click(menuButton)
    
    const pauseButton = screen.getByText('Pause')
    await user.click(pauseButton)
    
    await waitFor(() => {
      expect(screen.getByText('Failed to update post status')).toBeInTheDocument()
    })
  })

  it('closes error modal', async () => {
    const user = userEvent.setup()
    const mockMutateAsync = jest.fn().mockRejectedValue(new Error('Update failed'))
    mockUseUpdatePostStatus.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    })
    
    render(<PostMenu {...defaultProps} />)
    
    const menuButton = screen.getByRole('button', { name: /menu/i })
    await user.click(menuButton)
    
    const pauseButton = screen.getByText('Pause')
    await user.click(pauseButton)
    
    await waitFor(() => {
      const closeButton = screen.getByText('Close')
      user.click(closeButton)
    })
    
    expect(screen.queryByText('Failed to update post status')).not.toBeInTheDocument()
  })

  it('closes menu when clicking outside', async () => {
    const user = userEvent.setup()
    render(<PostMenu {...defaultProps} />)
    
    const menuButton = screen.getByRole('button', { name: /menu/i })
    await user.click(menuButton)
    
    // Click outside the menu
    fireEvent.click(document.body)
    
    expect(screen.queryByText('Pause')).not.toBeInTheDocument()
  })

  it('handles controlled visibility status', async () => {
    const user = userEvent.setup()
    const controlledPost = { ...mockPost, publicationStatus: 'CONTROLLED' as const }
    
    render(<PostMenu {...defaultProps} post={controlledPost} />)
    
    const menuButton = screen.getByRole('button', { name: /menu/i })
    await user.click(menuButton)
    
    expect(screen.getByText('Make Public')).toBeInTheDocument()
  })

  it('handles making controlled post public', async () => {
    const user = userEvent.setup()
    const mockMutateAsync = jest.fn()
    mockUseUpdatePostStatus.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    })
    
    const controlledPost = { ...mockPost, publicationStatus: 'CONTROLLED' as const }
    render(<PostMenu {...defaultProps} post={controlledPost} />)
    
    const menuButton = screen.getByRole('button', { name: /menu/i })
    await user.click(menuButton)
    
    const makePublicButton = screen.getByText('Make Public')
    await user.click(makePublicButton)
    
    expect(mockMutateAsync).toHaveBeenCalledWith({
      postId: 'post1',
      publicationStatus: 'PUBLIC',
    })
  })

  it('handles deleted post status', async () => {
    const user = userEvent.setup()
    const deletedPost = { ...mockPost, publicationStatus: 'DELETED' as const }
    
    render(<PostMenu {...defaultProps} post={deletedPost} />)
    
    const menuButton = screen.getByRole('button', { name: /menu/i })
    await user.click(menuButton)
    
    // Should not show delete option for already deleted posts
    expect(screen.queryByText('Delete')).not.toBeInTheDocument()
  })

  it('calls onClose callback after successful operations', async () => {
    const user = userEvent.setup()
    const mockOnClose = jest.fn()
    const mockMutateAsync = jest.fn().mockResolvedValue({ success: true })
    mockUseUpdatePostStatus.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    })
    
    render(<PostMenu {...defaultProps} onClose={mockOnClose} />)
    
    const menuButton = screen.getByRole('button', { name: /menu/i })
    await user.click(menuButton)
    
    const pauseButton = screen.getByText('Pause')
    await user.click(pauseButton)
    
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  it('disables menu during pending operations', async () => {
    const user = userEvent.setup()
    mockUseUpdatePostStatus.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: true,
    })
    
    render(<PostMenu {...defaultProps} />)
    
    const menuButton = screen.getByRole('button', { name: /menu/i })
    expect(menuButton).toBeDisabled()
  })

  it('shows appropriate menu items for different post statuses', async () => {
    const user = userEvent.setup()
    
    // Test PUBLIC status
    render(<PostMenu {...defaultProps} />)
    const menuButton = screen.getByRole('button', { name: /menu/i })
    await user.click(menuButton)
    expect(screen.getByText('Pause')).toBeInTheDocument()
    
    // Test PAUSED status
    const pausedPost = { ...mockPost, publicationStatus: 'PAUSED' as const }
    render(<PostMenu {...defaultProps} post={pausedPost} />)
    const pausedMenuButton = screen.getByRole('button', { name: /menu/i })
    await user.click(pausedMenuButton)
    expect(screen.getByText('Unpause')).toBeInTheDocument()
    
    // Test CONTROLLED status
    const controlledPost = { ...mockPost, publicationStatus: 'CONTROLLED' as const }
    render(<PostMenu {...defaultProps} post={controlledPost} />)
    const controlledMenuButton = screen.getByRole('button', { name: /menu/i })
    await user.click(controlledMenuButton)
    expect(screen.getByText('Make Public')).toBeInTheDocument()
  })
}) 