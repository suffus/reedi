import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImageUploader } from '../../components/dashboard/image-uploader'

// Mock the API hooks
jest.mock('../../lib/api-hooks', () => ({
  useUploadImage: jest.fn(),
}))

// Mock the API utility
jest.mock('../../lib/api', () => ({
  getImageUrl: jest.fn((url) => url),
}))

const mockUseUploadImage = require('../../lib/api-hooks').useUploadImage

describe('ImageUploader', () => {
  const mockOnClose = jest.fn()
  const mockOnUploadComplete = jest.fn()
  const defaultProps = {
    userId: 'user1',
    onClose: mockOnClose,
    onUploadComplete: mockOnUploadComplete,
  }

  beforeEach(() => {
    mockUseUploadImage.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    })
    mockOnClose.mockClear()
    mockOnUploadComplete.mockClear()
  })

  it('renders upload area when no files are selected', () => {
    render(<ImageUploader {...defaultProps} />)
    
    expect(screen.getByText('Drop images here or click to browse')).toBeInTheDocument()
    expect(screen.getByText('Choose Files')).toBeInTheDocument()
    expect(screen.getByText('Upload JPG, PNG, or GIF files up to 10MB each')).toBeInTheDocument()
  })

  it('renders inline version without modal wrapper', () => {
    render(<ImageUploader {...defaultProps} inline={true} />)
    
    // Should not have modal overlay
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Drop images here or click to browse')).toBeInTheDocument()
  })

  it('opens file dialog when Choose Files is clicked', async () => {
    const user = userEvent.setup()
    render(<ImageUploader {...defaultProps} />)
    
    const chooseFilesButton = screen.getByText('Choose Files')
    await user.click(chooseFilesButton)
    
    // File input should be triggered
    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toBeInTheDocument()
  })

  it('handles file selection', async () => {
    const user = userEvent.setup()
    render(<ImageUploader {...defaultProps} />)
    
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    
    await user.upload(fileInput, file)
    
    // Should show file preview
    expect(screen.getByText('1 image selected')).toBeInTheDocument()
  })

  it('shows Add More button when files are selected', async () => {
    const user = userEvent.setup()
    render(<ImageUploader {...defaultProps} />)
    
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    const fileInput = screen.getByRole('button', { name: /choose files/i }).closest('div')?.querySelector('input[type="file"]') as HTMLInputElement
    
    await user.upload(fileInput, file)
    
    expect(screen.getByText('Add More')).toBeInTheDocument()
  })

  it('allows adding more files', async () => {
    const user = userEvent.setup()
    render(<ImageUploader {...defaultProps} />)
    
    // Add first file
    const file1 = new File(['test1'], 'test1.jpg', { type: 'image/jpeg' })
    const fileInput = screen.getByRole('button', { name: /choose files/i }).closest('div')?.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, file1)
    
    // Add more files
    const addMoreButton = screen.getByText('Add More')
    await user.click(addMoreButton)
    
    const file2 = new File(['test2'], 'test2.jpg', { type: 'image/jpeg' })
    const addMoreFileInput = screen.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(addMoreFileInput, file2)
    
    expect(screen.getByText('2 images selected')).toBeInTheDocument()
  })

  it('allows removing files', async () => {
    const user = userEvent.setup()
    render(<ImageUploader {...defaultProps} />)
    
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    const fileInput = screen.getByRole('button', { name: /choose files/i }).closest('div')?.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, file)
    
    const removeButton = screen.getByRole('button', { name: /×/i })
    await user.click(removeButton)
    
    // Should go back to upload area
    expect(screen.getByText('Drop images here or click to browse')).toBeInTheDocument()
  })

  it('allows editing file metadata', async () => {
    const user = userEvent.setup()
    render(<ImageUploader {...defaultProps} />)
    
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    const fileInput = screen.getByRole('button', { name: /choose files/i }).closest('div')?.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, file)
    
    const titleInput = screen.getByDisplayValue('test')
    await user.clear(titleInput)
    await user.type(titleInput, 'New Title')
    
    expect(titleInput).toHaveValue('New Title')
  })

  it('allows adding tags to files', async () => {
    const user = userEvent.setup()
    render(<ImageUploader {...defaultProps} />)
    
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    const fileInput = screen.getByRole('button', { name: /choose files/i }).closest('div')?.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, file)
    
    const tagInput = screen.getByPlaceholderText('Add a tag...')
    await user.type(tagInput, 'nature')
    await user.keyboard('{Enter}')
    
    expect(screen.getByText('nature')).toBeInTheDocument()
  })

  it('allows removing tags', async () => {
    const user = userEvent.setup()
    render(<ImageUploader {...defaultProps} />)
    
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    const fileInput = screen.getByRole('button', { name: /choose files/i }).closest('div')?.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, file)
    
    // Add tag
    const tagInput = screen.getByPlaceholderText('Add a tag...')
    await user.type(tagInput, 'nature')
    await user.keyboard('{Enter}')
    
    // Remove tag
    const removeTagButton = screen.getByRole('button', { name: /×/i })
    await user.click(removeTagButton)
    
    expect(screen.queryByText('nature')).not.toBeInTheDocument()
  })

  it('shows shared metadata section in grid mode with multiple files', async () => {
    const user = userEvent.setup()
    render(<ImageUploader {...defaultProps} />)
    
    // Add two files
    const file1 = new File(['test1'], 'test1.jpg', { type: 'image/jpeg' })
    const file2 = new File(['test2'], 'test2.jpg', { type: 'image/jpeg' })
    const fileInput = screen.getByRole('button', { name: /choose files/i }).closest('div')?.querySelector('input[type="file"]') as HTMLInputElement
    
    await user.upload(fileInput, file1)
    
    const addMoreButton = screen.getByText('Add More')
    await user.click(addMoreButton)
    
    const addMoreFileInput = screen.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(addMoreFileInput, file2)
    
    // Switch to grid mode
    const gridButton = screen.getByRole('button', { name: /grid/i })
    await user.click(gridButton)
    
    expect(screen.getByText('Shared Metadata (applies to all images)')).toBeInTheDocument()
  })

  it('allows applying shared metadata to all images', async () => {
    const user = userEvent.setup()
    render(<ImageUploader {...defaultProps} />)
    
    // Add two files
    const file1 = new File(['test1'], 'test1.jpg', { type: 'image/jpeg' })
    const file2 = new File(['test2'], 'test2.jpg', { type: 'image/jpeg' })
    const fileInput = screen.getByRole('button', { name: /choose files/i }).closest('div')?.querySelector('input[type="file"]') as HTMLInputElement
    
    await user.upload(fileInput, file1)
    
    const addMoreButton = screen.getByText('Add More')
    await user.click(addMoreButton)
    
    const addMoreFileInput = screen.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(addMoreFileInput, file2)
    
    // Switch to grid mode
    const gridButton = screen.getByRole('button', { name: /grid/i })
    await user.click(gridButton)
    
    // Add shared title
    const sharedTitleInput = screen.getByPlaceholderText('Shared title for all images...')
    await user.type(sharedTitleInput, 'Shared Title')
    
    // Apply to all images
    const applyButton = screen.getByText('Apply to all images')
    await user.click(applyButton)
    
    // Check that both files have the shared title
    const titleInputs = screen.getAllByDisplayValue('Shared Title')
    expect(titleInputs).toHaveLength(2)
  })

  it('shows upload progress during upload', async () => {
    const user = userEvent.setup()
    const mockMutateAsync = jest.fn().mockResolvedValue({ success: true })
    mockUseUploadImage.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    })
    
    render(<ImageUploader {...defaultProps} />)
    
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    const fileInput = screen.getByRole('button', { name: /choose files/i }).closest('div')?.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, file)
    
    const uploadButton = screen.getByText('Upload 1 Image')
    await user.click(uploadButton)
    
    expect(screen.getByText('Uploading Images...')).toBeInTheDocument()
  })

  it('handles upload completion', async () => {
    const user = userEvent.setup()
    const mockMutateAsync = jest.fn().mockResolvedValue({ success: true })
    mockUseUploadImage.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    })
    
    render(<ImageUploader {...defaultProps} />)
    
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    const fileInput = screen.getByRole('button', { name: /choose files/i }).closest('div')?.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, file)
    
    const uploadButton = screen.getByText('Upload 1 Image')
    await user.click(uploadButton)
    
    await waitFor(() => {
      expect(mockOnUploadComplete).toHaveBeenCalled()
    })
  })

  it('handles drag and drop', async () => {
    render(<ImageUploader {...defaultProps} />)
    
    const dropZone = screen.getByText('Drop images here or click to browse').closest('div')
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    
    fireEvent.dragEnter(dropZone!)
    fireEvent.dragOver(dropZone!)
    fireEvent.drop(dropZone!, {
      dataTransfer: {
        files: [file],
      },
    })
    
    expect(screen.getByText('1 image selected')).toBeInTheDocument()
  })

  it('filters non-image files', async () => {
    const user = userEvent.setup()
    render(<ImageUploader {...defaultProps} />)
    
    const textFile = new File(['test'], 'test.txt', { type: 'text/plain' })
    const fileInput = screen.getByRole('button', { name: /choose files/i }).closest('div')?.querySelector('input[type="file"]') as HTMLInputElement
    
    await user.upload(fileInput, textFile)
    
    // Should not show any files selected
    expect(screen.getByText('Drop images here or click to browse')).toBeInTheDocument()
  })

  it('disables upload button when no files are selected', () => {
    render(<ImageUploader {...defaultProps} />)
    
    const uploadButton = screen.queryByText(/upload/i)
    expect(uploadButton).not.toBeInTheDocument()
  })

  it('enables upload button when files are selected', async () => {
    const user = userEvent.setup()
    render(<ImageUploader {...defaultProps} />)
    
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    const fileInput = screen.getByRole('button', { name: /choose files/i }).closest('div')?.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, file)
    
    const uploadButton = screen.getByText('Upload 1 Image')
    expect(uploadButton).toBeEnabled()
  })

  it('shows correct upload button text for multiple files', async () => {
    const user = userEvent.setup()
    render(<ImageUploader {...defaultProps} />)
    
    // Add two files
    const file1 = new File(['test1'], 'test1.jpg', { type: 'image/jpeg' })
    const file2 = new File(['test2'], 'test2.jpg', { type: 'image/jpeg' })
    const fileInput = screen.getByRole('button', { name: /choose files/i }).closest('div')?.querySelector('input[type="file"]') as HTMLInputElement
    
    await user.upload(fileInput, file1)
    
    const addMoreButton = screen.getByText('Add More')
    await user.click(addMoreButton)
    
    const addMoreFileInput = screen.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(addMoreFileInput, file2)
    
    expect(screen.getByText('Upload 2 Images')).toBeInTheDocument()
  })
}) 