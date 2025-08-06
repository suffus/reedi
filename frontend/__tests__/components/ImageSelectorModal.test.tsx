import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImageSelectorModal } from '../../components/dashboard/image-selector-modal'

// Mock the API hooks
jest.mock('../../lib/api-hooks', () => ({
  useUserImages: jest.fn(),
}))

// Mock the API utility
jest.mock('../../lib/api', () => ({
  getImageUrl: jest.fn((url) => url),
}))

// Mock the ImageUploader component
jest.mock('../../components/dashboard/image-uploader', () => ({
  ImageUploader: ({ userId, onClose, onUploadComplete, inline }: any) => (
    <div data-testid="image-uploader">
      <button onClick={() => onUploadComplete()}>Upload Complete</button>
      <button onClick={onClose}>Close Uploader</button>
    </div>
  ),
}))

const mockUseUserImages = require('../../lib/api-hooks').useUserImages

describe('ImageSelectorModal', () => {
  const mockOnClose = jest.fn()
  const mockOnImagesSelected = jest.fn()
  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onImagesSelected: mockOnImagesSelected,
    userId: 'user1',
  }

  const mockImages = [
    {
      id: 'img1',
      url: '/test1.jpg',
      thumbnail: '/thumb1.jpg',
      altText: 'Test Image 1',
      caption: 'Test Caption 1',
      tags: ['nature', 'landscape'],
      createdAt: '2023-01-01T00:00:00Z',
    },
    {
      id: 'img2',
      url: '/test2.jpg',
      thumbnail: '/thumb2.jpg',
      altText: 'Test Image 2',
      caption: 'Test Caption 2',
      tags: ['portrait', 'people'],
      createdAt: '2023-01-02T00:00:00Z',
    },
  ]

  beforeEach(() => {
    mockUseUserImages.mockReturnValue({
      data: { data: { images: mockImages } },
      isLoading: false,
      loadMore: jest.fn(),
      hasMore: false,
      isLoadingMore: false,
    })
    mockOnClose.mockClear()
    mockOnImagesSelected.mockClear()
  })

  it('renders modal when isOpen is true', () => {
    render(<ImageSelectorModal {...defaultProps} />)
    
    expect(screen.getByText('Add Images to Post')).toBeInTheDocument()
    expect(screen.getByText('Upload New')).toBeInTheDocument()
    expect(screen.getByText('Select from Gallery')).toBeInTheDocument()
  })

  it('does not render when isOpen is false', () => {
    render(<ImageSelectorModal {...defaultProps} isOpen={false} />)
    
    expect(screen.queryByText('Add Images to Post')).not.toBeInTheDocument()
  })

  it('closes modal when close button is clicked', async () => {
    const user = userEvent.setup()
    render(<ImageSelectorModal {...defaultProps} />)
    
    const closeButton = screen.getAllByRole('button')[0] // The close button is the first button
    await user.click(closeButton)
    
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('switches to upload tab when Upload New is clicked', async () => {
    const user = userEvent.setup()
    render(<ImageSelectorModal {...defaultProps} />)
    
    const uploadTab = screen.getByText('Upload New')
    await user.click(uploadTab)
    
    expect(screen.getByTestId('image-uploader')).toBeInTheDocument()
  })

  it('switches to gallery tab when Select from Gallery is clicked', async () => {
    const user = userEvent.setup()
    render(<ImageSelectorModal {...defaultProps} />)
    
    const galleryTab = screen.getByText('Select from Gallery')
    await user.click(galleryTab)
    
    expect(screen.getByPlaceholderText('Search images...')).toBeInTheDocument()
  })

  it('shows gallery images in grid view by default', () => {
    render(<ImageSelectorModal {...defaultProps} />)
    
    // Switch to gallery tab
    const galleryTab = screen.getByText('Select from Gallery')
    fireEvent.click(galleryTab)
    
    expect(screen.getByAltText('Test Image 1')).toBeInTheDocument()
    expect(screen.getByAltText('Test Image 2')).toBeInTheDocument()
  })

  it('allows searching images', async () => {
    const user = userEvent.setup()
    render(<ImageSelectorModal {...defaultProps} />)
    
    // Switch to gallery tab
    const galleryTab = screen.getByText('Select from Gallery')
    await user.click(galleryTab)
    
    const searchInput = screen.getByPlaceholderText('Search images...')
    await user.type(searchInput, 'Test Image 1')
    
    // Should show only the matching image
    expect(screen.getByAltText('Test Image 1')).toBeInTheDocument()
    expect(screen.queryByAltText('Test Image 2')).not.toBeInTheDocument()
  })

  it('allows filtering by tags', async () => {
    const user = userEvent.setup()
    render(<ImageSelectorModal {...defaultProps} />)
    
    // Switch to gallery tab
    const galleryTab = screen.getByText('Select from Gallery')
    await user.click(galleryTab)
    
    const tagInput = screen.getByPlaceholderText('Tag...')
    await user.type(tagInput, 'nature')
    
    // Should show only images with 'nature' tag
    expect(screen.getByAltText('Test Image 1')).toBeInTheDocument()
    expect(screen.queryByAltText('Test Image 2')).not.toBeInTheDocument()
  })

  it('allows selecting images', async () => {
    const user = userEvent.setup()
    render(<ImageSelectorModal {...defaultProps} />)
    
    // Switch to gallery tab
    const galleryTab = screen.getByText('Select from Gallery')
    await user.click(galleryTab)
    
    const image = screen.getByAltText('Test Image 1')
    await user.click(image)
    
    expect(screen.getByText('1 image selected')).toBeInTheDocument()
  })

  it('allows selecting multiple images', async () => {
    const user = userEvent.setup()
    render(<ImageSelectorModal {...defaultProps} />)
    
    // Switch to gallery tab
    const galleryTab = screen.getByText('Select from Gallery')
    await user.click(galleryTab)
    
    const image1 = screen.getByAltText('Test Image 1')
    const image2 = screen.getByAltText('Test Image 2')
    
    await user.click(image1)
    await user.click(image2)
    
    expect(screen.getByText('2 images selected')).toBeInTheDocument()
  })

  it('allows deselecting images', async () => {
    const user = userEvent.setup()
    render(<ImageSelectorModal {...defaultProps} />)
    
    // Switch to gallery tab
    const galleryTab = screen.getByText('Select from Gallery')
    await user.click(galleryTab)
    
    const image = screen.getByAltText('Test Image 1')
    await user.click(image) // Select
    await user.click(image) // Deselect
    
    expect(screen.queryByText('1 image selected')).not.toBeInTheDocument()
  })

  it('shows selected images preview with drag and drop', async () => {
    const user = userEvent.setup()
    render(<ImageSelectorModal {...defaultProps} />)
    
    // Switch to gallery tab
    const galleryTab = screen.getByText('Select from Gallery')
    await user.click(galleryTab)
    
    const image = screen.getByAltText('Test Image 1')
    await user.click(image)
    
    expect(screen.getByText('1 image selected')).toBeInTheDocument()
    expect(screen.getByText('Drag to reorder')).toBeInTheDocument()
  })

  it('allows reordering selected images via drag and drop', async () => {
    const user = userEvent.setup()
    render(<ImageSelectorModal {...defaultProps} />)
    
    // Switch to gallery tab
    const galleryTab = screen.getByText('Select from Gallery')
    await user.click(galleryTab)
    
    // Select two images
    const image1 = screen.getByAltText('Test Image 1')
    const image2 = screen.getByAltText('Test Image 2')
    await user.click(image1)
    await user.click(image2)
    
    // Mock dataTransfer for drag and drop
    const mockDataTransfer = {
      setData: jest.fn(),
      getData: jest.fn(() => '0'),
      effectAllowed: '',
      dropEffect: '',
    }
    
    // Drag and drop to reorder
    const selectedImage1 = screen.getByText('1').closest('div')
    const selectedImage2 = screen.getByText('2').closest('div')
    
    fireEvent.dragStart(selectedImage1!, { dataTransfer: mockDataTransfer })
    fireEvent.dragOver(selectedImage2!, { dataTransfer: mockDataTransfer })
    fireEvent.drop(selectedImage2!, { dataTransfer: mockDataTransfer })
    
    // Should still have 2 images selected
    expect(screen.getByText('2 images selected')).toBeInTheDocument()
  })

  it('allows removing selected images', async () => {
    const user = userEvent.setup()
    render(<ImageSelectorModal {...defaultProps} />)
    
    // Switch to gallery tab
    const galleryTab = screen.getByText('Select from Gallery')
    await user.click(galleryTab)
    
    const image = screen.getByAltText('Test Image 1')
    await user.click(image)
    
    const removeButton = screen.getByRole('button', { name: /×/i })
    await user.click(removeButton)
    
    expect(screen.queryByText('1 image selected')).not.toBeInTheDocument()
  })

  it('switches between grid and list view modes', async () => {
    const user = userEvent.setup()
    render(<ImageSelectorModal {...defaultProps} />)
    
    // Switch to gallery tab
    const galleryTab = screen.getByText('Select from Gallery')
    await user.click(galleryTab)
    
    const listButton = screen.getAllByRole('button')[4] // The list view button
    await user.click(listButton)
    
    // Should show images in list view
    expect(screen.getByAltText('Test Image 1')).toBeInTheDocument()
    expect(screen.getByAltText('Test Image 2')).toBeInTheDocument()
  })

  it('shows loading state when gallery is loading', () => {
    mockUseUserImages.mockReturnValue({
      data: null,
      isLoading: true,
      loadMore: jest.fn(),
      hasMore: false,
      isLoadingMore: false,
    })

    render(<ImageSelectorModal {...defaultProps} />)
    
    // Switch to gallery tab
    const galleryTab = screen.getByText('Select from Gallery')
    fireEvent.click(galleryTab)
    
    // Should show loading skeleton (elements with animate-pulse class)
    const loadingElements = document.querySelectorAll('.animate-pulse')
    expect(loadingElements.length).toBeGreaterThan(0)
  })

  it('shows empty state when no images exist', () => {
    mockUseUserImages.mockReturnValue({
      data: { data: { images: [] } },
      isLoading: false,
      loadMore: jest.fn(),
      hasMore: false,
      isLoadingMore: false,
    })

    render(<ImageSelectorModal {...defaultProps} />)
    
    // Switch to gallery tab
    const galleryTab = screen.getByText('Select from Gallery')
    fireEvent.click(galleryTab)
    
    expect(screen.getByText('No images in gallery')).toBeInTheDocument()
    expect(screen.getByText('Upload some images to get started')).toBeInTheDocument()
  })

  it('shows no results when search has no matches', async () => {
    const user = userEvent.setup()
    render(<ImageSelectorModal {...defaultProps} />)
    
    // Switch to gallery tab
    const galleryTab = screen.getByText('Select from Gallery')
    await user.click(galleryTab)
    
    const searchInput = screen.getByPlaceholderText('Search images...')
    await user.type(searchInput, 'nonexistent')
    
    expect(screen.getByText('No images found')).toBeInTheDocument()
    expect(screen.getByText('Try adjusting your search terms')).toBeInTheDocument()
  })

  it('confirms image selection and closes modal', async () => {
    const user = userEvent.setup()
    render(<ImageSelectorModal {...defaultProps} />)
    
    // Switch to gallery tab
    const galleryTab = screen.getByText('Select from Gallery')
    await user.click(galleryTab)
    
    const image = screen.getByAltText('Test Image 1')
    await user.click(image)
    
    const confirmButton = screen.getByText('Add 1 Image to Post')
    await user.click(confirmButton)
    
    expect(mockOnImagesSelected).toHaveBeenCalledWith([mockImages[0]])
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('handles upload completion by switching to gallery tab', async () => {
    const user = userEvent.setup()
    render(<ImageSelectorModal {...defaultProps} />)
    
    // Switch to upload tab
    const uploadTab = screen.getByText('Upload New')
    await user.click(uploadTab)
    
    const uploadCompleteButton = screen.getByText('Upload Complete')
    await user.click(uploadCompleteButton)
    
    // Should switch back to gallery tab
    expect(screen.getByPlaceholderText('Search images...')).toBeInTheDocument()
  })

  it('defaults to upload tab when user has no images', () => {
    mockUseUserImages.mockReturnValue({
      data: { data: { images: [] } },
      isLoading: false,
      loadMore: jest.fn(),
      hasMore: false,
      isLoadingMore: false,
    })

    render(<ImageSelectorModal {...defaultProps} />)
    
    expect(screen.getByTestId('image-uploader')).toBeInTheDocument()
  })

  it('defaults to gallery tab when user has images', () => {
    render(<ImageSelectorModal {...defaultProps} />)
    
    expect(screen.getByPlaceholderText('Search images...')).toBeInTheDocument()
  })

  it('supports infinite scroll for large galleries', () => {
    const mockLoadMore = jest.fn()
    mockUseUserImages.mockReturnValue({
      data: { data: { images: mockImages } },
      isLoading: false,
      loadMore: mockLoadMore,
      hasMore: true,
      isLoadingMore: false,
    })

    render(<ImageSelectorModal {...defaultProps} />)
    
    // Switch to gallery tab
    const galleryTab = screen.getByText('Select from Gallery')
    fireEvent.click(galleryTab)
    
    // Should show images in grid view
    expect(screen.getByAltText('Test Image 1')).toBeInTheDocument()
    expect(screen.getByAltText('Test Image 2')).toBeInTheDocument()
  })

  it('shows loading more state during infinite scroll', () => {
    const mockLoadMore = jest.fn()
    mockUseUserImages.mockReturnValue({
      data: { data: { images: mockImages } },
      isLoading: false,
      loadMore: mockLoadMore,
      hasMore: true,
      isLoadingMore: true,
    })

    render(<ImageSelectorModal {...defaultProps} />)
    
    // Switch to gallery tab
    const galleryTab = screen.getByText('Select from Gallery')
    fireEvent.click(galleryTab)
    
    // Should show loading spinner (the spinning div)
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })
}) 