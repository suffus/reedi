'use client'

import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, X, Image as ImageIcon, Tag, FileText, CheckCircle, AlertCircle, Loader2, Grid3X3, List, AlertTriangle } from 'lucide-react'
import { useUploadImage } from '../../lib/api-hooks'
import { TagInput } from '../tag-input'

interface ImageUploaderProps {
  userId: string
  onClose: () => void
  onUploadComplete?: () => void
  inline?: boolean // When true, renders without modal wrapper
}

interface UploadFile {
  file: File
  preview: string
  title: string
  description: string
  tags: string[]
}

interface UploadProgress {
  [key: number]: {
    status: 'pending' | 'uploading' | 'success' | 'error'
    progress?: number
    error?: string
  }
}

type ViewMode = 'table' | 'grid'

export function ImageUploader({ userId, onClose, onUploadComplete, inline = false }: ImageUploaderProps) {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({})
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [sharedTitle, setSharedTitle] = useState('')
  const [sharedDescription, setSharedDescription] = useState('')
  const [sharedTags, setSharedTags] = useState<string[]>([])
  const [imageVisibility, setImageVisibility] = useState<'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE'>('PUBLIC')
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false)
  const [pendingUploadAction, setPendingUploadAction] = useState<(() => void) | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const addMoreFileInputRef = useRef<HTMLInputElement>(null)

  const uploadImageMutation = useUploadImage()

  // Auto-select view mode based on image count
  const autoViewMode: ViewMode = uploadFiles.length <= 3 ? 'table' : 'grid'
  const effectiveViewMode = uploadFiles.length > 0 ? viewMode : autoViewMode

  // Update view mode when image count changes
  React.useEffect(() => {
    if (uploadFiles.length > 0) {
      setViewMode(autoViewMode)
    }
  }, [uploadFiles.length, autoViewMode])

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    handleFiles(files)
    // Reset the input so the same file can be selected again
    e.target.value = ''
  }

  const handleAddMore = () => {
    // Reset the file input and trigger click
    if (addMoreFileInputRef.current) {
      addMoreFileInputRef.current.value = ''
      addMoreFileInputRef.current.click()
    }
  }

  const handleFiles = (files: File[]) => {
    const imageFiles = files.filter(file => file.type.startsWith('image/'))
    
    // Sort files by filename to ensure proper order (e.g., DSC_5689.JPG before DSC_5690.JPG)
    const sortedFiles = imageFiles.sort((a, b) => {
      // Extract filename without extension for better sorting
      const nameA = a.name.replace(/\.[^/.]+$/, '').toLowerCase()
      const nameB = b.name.replace(/\.[^/.]+$/, '').toLowerCase()
      
      // Natural sort for better handling of numbers in filenames
      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' })
    })
    
    // Process files in sorted order
    sortedFiles.forEach(file => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const newFile: UploadFile = {
          file,
          preview: e.target?.result as string,
          title: file.name.replace(/\.[^/.]+$/, ''),
          description: '',
          tags: []
        }
        setUploadFiles(prev => [...prev, newFile])
      }
      reader.readAsDataURL(file)
    })
  }

  const removeFile = (index: number) => {
    setUploadFiles(prev => prev.filter((_, i) => i !== index))
    // Clear progress for removed file
    setUploadProgress(prev => {
      const newProgress = { ...prev }
      delete newProgress[index]
      return newProgress
    })
  }

  const updateFile = (index: number, updates: Partial<UploadFile>) => {
    setUploadFiles(prev => prev.map((file, i) => 
      i === index ? { ...file, ...updates } : file
    ))
  }

  const updateTags = (index: number, tags: string[]) => {
    updateFile(index, { tags })
  }

  // Sort upload files by filename to maintain proper order
  const sortUploadFiles = () => {
    setUploadFiles(prev => {
      const sorted = [...prev].sort((a, b) => {
        const nameA = a.file.name.replace(/\.[^/.]+$/, '').toLowerCase()
        const nameB = b.file.name.replace(/\.[^/.]+$/, '').toLowerCase()
        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' })
      })
      return sorted
    })
  }

  // Auto-sort files when they're added
  React.useEffect(() => {
    if (uploadFiles.length > 1) {
      sortUploadFiles()
    }
  }, [uploadFiles.length])

  const applySharedMetadata = () => {
    setUploadFiles(prev => prev.map(file => ({
      ...file,
      title: sharedTitle || file.title,
      description: sharedDescription || file.description,
      tags: Array.from(new Set([...file.tags, ...sharedTags]))
    })))
  }

  // Check if there's unsaved shared metadata
  const hasUnsavedSharedMetadata = () => {
    return sharedTitle.trim() !== '' || sharedDescription.trim() !== '' || sharedTags.length > 0
  }

  // Handle upload with potential warning
  const handleUploadWithWarning = () => {
    if (hasUnsavedSharedMetadata()) {
      setShowUnsavedWarning(true)
      setPendingUploadAction(() => handleUpload)
    } else {
      handleUpload()
    }
  }

  // Apply metadata and continue with upload
  const handleApplyAndUpload = () => {
    // Apply metadata directly to the current files
    const updatedFiles = uploadFiles.map(file => ({
      ...file,
      title: sharedTitle || file.title,
      description: sharedDescription || file.description,
      tags: Array.from(new Set([...file.tags, ...sharedTags]))
    }))
    
    // Update the state immediately
    setUploadFiles(updatedFiles)
    setShowUnsavedWarning(false)
    setPendingUploadAction(null)
    
    // Use the updated files for upload
    handleUploadWithFiles(updatedFiles)
  }

  // Continue with upload without applying metadata
  const handleUploadWithoutApplying = () => {
    setShowUnsavedWarning(false)
    setPendingUploadAction(null)
    handleUpload()
  }

  const handleUpload = async () => {
    await handleUploadWithFiles(uploadFiles)
  }

  const handleUploadWithFiles = async (files: UploadFile[]) => {
    if (files.length === 0) return

    setIsUploading(true)
    
    // Initialize progress for all files
    const initialProgress: UploadProgress = {}
    files.forEach((_, index) => {
      initialProgress[index] = { status: 'pending' }
    })
    setUploadProgress(initialProgress)

    const results = []
    let hasErrors = false

    try {
      for (let i = 0; i < files.length; i++) {
        const uploadFile = files[i]
        
        // Update status to uploading
        setUploadProgress(prev => ({
          ...prev,
          [i]: { status: 'uploading', progress: 0 }
        }))

        try {
          const formData = new FormData()
          formData.append('image', uploadFile.file)
          formData.append('title', uploadFile.title)
          formData.append('description', uploadFile.description)
          formData.append('tags', JSON.stringify(uploadFile.tags))
          formData.append('userId', userId)
          formData.append('visibility', imageVisibility)

          // Simulate progress updates (since we can't get real progress from the mutation)
          const progressInterval = setInterval(() => {
            setUploadProgress(prev => ({
              ...prev,
              [i]: { 
                ...prev[i], 
                progress: Math.min((prev[i]?.progress || 0) + Math.random() * 20, 90)
              }
            }))
          }, 200)

          const result = await uploadImageMutation.mutateAsync(formData)
          
          console.log('Upload result:', result)
          
          clearInterval(progressInterval)
          
          // Mark as success
          setUploadProgress(prev => ({
            ...prev,
            [i]: { status: 'success', progress: 100 }
          }))
          
          results.push(result)
        } catch (error) {
          hasErrors = true
          console.error(`Upload failed for file ${i}:`, error)
          
          // Mark as error
          setUploadProgress(prev => ({
            ...prev,
            [i]: { 
              status: 'error', 
              error: error instanceof Error ? error.message : 'Upload failed'
            }
          }))
        }
      }

      // Wait a moment to show completion status and ensure DB transaction is committed
      await new Promise(resolve => setTimeout(resolve, 2000))

      if (!hasErrors) {
        // All uploads successful
        onUploadComplete?.()
        onClose()
      } else {
        // Some uploads failed - let user decide what to do
        const successCount = Object.values(uploadProgress).filter(p => p.status === 'success').length
        const errorCount = Object.values(uploadProgress).filter(p => p.status === 'error').length
        
        if (successCount > 0) {
          // Some succeeded - refresh gallery and close
          onUploadComplete?.()
          onClose()
        }
        // If all failed, dialog stays open so user can retry
      }
    } catch (error) {
      console.error('Upload process failed:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const canClose = !isUploading && uploadFiles.length === 0
  const canUpload = uploadFiles.length > 0 && !isUploading
  const hasUploads = uploadFiles.length > 0
  const hasErrors = Object.values(uploadProgress).some(p => p.status === 'error')
  const allSuccessful = hasUploads && Object.values(uploadProgress).every(p => p.status === 'success')

  const content = (
    <>
      {/* Header - only show if not inline */}
      {!inline && (
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {isUploading ? 'Uploading Images...' : 'Upload Images'}
          </h2>
          <button
            onClick={onClose}
            disabled={isUploading}
            className={`p-2 rounded-full transition-colors duration-200 ${
              isUploading 
                ? 'text-gray-400 cursor-not-allowed' 
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className={`${inline ? '' : 'p-6'} overflow-y-auto ${inline ? '' : 'max-h-[calc(90vh-140px)]'}`}>
            {/* Upload Progress */}
            {isUploading && (
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Upload Progress
                </h3>
                <div className="space-y-3">
                  {uploadFiles.map((file, index) => {
                    const progress = uploadProgress[index]
                    return (
                      <div key={index} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {file.title}
                          </span>
                          <div className="flex items-center space-x-2">
                            {progress?.status === 'pending' && (
                              <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
                            )}
                            {progress?.status === 'uploading' && (
                              <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                            )}
                            {progress?.status === 'success' && (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                            {progress?.status === 'error' && (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                        </div>
                        
                        {progress?.status === 'uploading' && (
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${progress.progress || 0}%` }}
                            />
                          </div>
                        )}
                        
                        {progress?.status === 'success' && (
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-green-500 h-2 rounded-full" style={{ width: '100%' }} />
                          </div>
                        )}
                        
                        {progress?.status === 'error' && (
                          <div className="text-sm text-red-600">
                            {progress.error}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Upload Area */}
            {!isUploading && uploadFiles.length === 0 && (
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200 ${
                  dragActive
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Drop images here or click to browse
                </h3>
                <p className="text-gray-600 mb-4">
                  Upload JPG, PNG, or GIF files up to 10MB each
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-primary"
                >
                  Choose Files
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            )}

            {/* Hidden file input for "Add More" functionality - always available */}
            <input
              ref={addMoreFileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Uploaded Files */}
            {!isUploading && uploadFiles.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        {uploadFiles.length} {uploadFiles.length === 1 ? 'image' : 'images'} selected
                      </h3>
                      {uploadFiles.length > 1 && (
                        <p className="text-xs text-gray-500 mt-1">
                          Files will be uploaded in filename order (e.g., DSC_5689.JPG before DSC_5690.JPG)
                        </p>
                      )}
                    </div>
                    {uploadFiles.length > 1 && (
                      <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
                        <button
                          type="button"
                          onClick={() => setViewMode('table')}
                          className={`p-2 rounded-md transition-colors duration-200 ${
                            effectiveViewMode === 'table'
                              ? 'bg-white text-primary-600 shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          <List className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode('grid')}
                          className={`p-2 rounded-md transition-colors duration-200 ${
                            effectiveViewMode === 'grid'
                              ? 'bg-white text-primary-600 shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          <Grid3X3 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMore}
                    className="text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Add More
                  </button>
                </div>

                {/* Shared Metadata Section (Grid Mode) */}
                {effectiveViewMode === 'grid' && uploadFiles.length > 1 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-blue-900 mb-3">
                      Shared Metadata (applies to all images)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="md:col-span-1 lg:col-span-1">
                        <label className="block text-sm font-medium text-blue-800 mb-1">
                          Title
                        </label>
                        <input
                          type="text"
                          value={sharedTitle}
                          onChange={(e) => setSharedTitle(e.target.value)}
                          placeholder="Shared title for all images..."
                          className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      
                      <div className="md:col-span-1 lg:col-span-1">
                        <label className="block text-sm font-medium text-blue-800 mb-1">
                          Description
                        </label>
                        <textarea
                          value={sharedDescription}
                          onChange={(e) => setSharedDescription(e.target.value)}
                          placeholder="Shared description for all images..."
                          rows={2}
                          className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      
                      <div className="md:col-span-1 lg:col-span-1">
                        <label className="block text-sm font-medium text-blue-800 mb-1">
                          Tags
                        </label>
                        <TagInput
                          tags={sharedTags}
                          onTagsChange={setSharedTags}
                          placeholder="Add tags..."
                          className="w-full"
                        />
                      </div>
                      
                      <div className="md:col-span-1 lg:col-span-1">
                        <label className="block text-sm font-medium text-blue-800 mb-1">
                          Visibility
                        </label>
                        <div className="flex space-x-1">
                          <button
                            type="button"
                            onClick={() => setImageVisibility('PUBLIC')}
                            className={`px-2 py-1 text-xs rounded-none transition-colors ${
                              imageVisibility === 'PUBLIC'
                                ? 'bg-blue-600 text-white'
                                : 'bg-blue-200 text-blue-700 hover:bg-blue-300'
                            }`}
                          >
                            Public
                          </button>
                          <button
                            type="button"
                            onClick={() => setImageVisibility('FRIENDS_ONLY')}
                            className={`px-2 py-1 text-xs rounded-none transition-colors ${
                              imageVisibility === 'FRIENDS_ONLY'
                                ? 'bg-blue-600 text-white'
                                : 'bg-blue-200 text-blue-700 hover:bg-blue-300'
                            }`}
                          >
                            Friends
                          </button>
                          <button
                            type="button"
                            onClick={() => setImageVisibility('PRIVATE')}
                            className={`px-2 py-1 text-xs rounded-none transition-colors ${
                              imageVisibility === 'PRIVATE'
                                ? 'bg-blue-600 text-white'
                                : 'bg-blue-200 text-blue-700 hover:bg-blue-300'
                            }`}
                          >
                            Private
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={applySharedMetadata}
                        className="text-sm text-blue-700 hover:text-blue-800 font-medium"
                      >
                        Apply to all images
                      </button>
                    </div>
                  </div>
                )}

                {/* Files Display */}
                {effectiveViewMode === 'table' ? (
                  <div className="space-y-4">
                    {uploadFiles.map((file, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex space-x-4">
                          <div className="w-20 h-20 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                            <img
                              src={file.preview}
                              alt={file.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          
                          <div className="flex-1 space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Title
                              </label>
                              <input
                                type="text"
                                value={file.title}
                                onChange={(e) => updateFile(index, { title: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description
                              </label>
                              <textarea
                                value={file.description}
                                onChange={(e) => updateFile(index, { description: e.target.value })}
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Tags
                              </label>
                              <TagInput
                                tags={file.tags}
                                onTagsChange={(tags) => updateTags(index, tags)}
                                placeholder="Enter tags..."
                                className="w-full"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Visibility
                              </label>
                              <div className="flex space-x-1">
                                <button
                                  type="button"
                                  onClick={() => setImageVisibility('PUBLIC')}
                                  className={`px-2 py-1 text-xs rounded-none transition-colors ${
                                    imageVisibility === 'PUBLIC'
                                      ? 'bg-primary-600 text-white'
                                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                  }`}
                                >
                                  Public
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setImageVisibility('FRIENDS_ONLY')}
                                  className={`px-2 py-1 text-xs rounded-none transition-colors ${
                                    imageVisibility === 'FRIENDS_ONLY'
                                      ? 'bg-primary-600 text-white'
                                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                  }`}
                                >
                                  Friends
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setImageVisibility('PRIVATE')}
                                  className={`px-2 py-1 text-xs rounded-none transition-colors ${
                                    imageVisibility === 'PRIVATE'
                                      ? 'bg-primary-600 text-white'
                                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                  }`}
                                >
                                  Private
                                </button>
                              </div>
                            </div>
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-200"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {uploadFiles.map((file, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-3 relative">
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="absolute top-2 right-2 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors duration-200 z-10"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        
                        <div className="aspect-square bg-gray-200 rounded-lg overflow-hidden mb-3">
                          <img
                            src={file.preview}
                            alt={file.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Title
                            </label>
                            <input
                              type="text"
                              value={file.title}
                              onChange={(e) => updateFile(index, { title: e.target.value })}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-primary-500 focus:border-transparent"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Description
                            </label>
                            <textarea
                              value={file.description}
                              onChange={(e) => updateFile(index, { description: e.target.value })}
                              rows={2}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-primary-500 focus:border-transparent"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Tags
                            </label>
                            <TagInput
                              tags={file.tags}
                              onTagsChange={(tags) => updateTags(index, tags)}
                              placeholder="Enter tags..."
                              className="w-full"
                            />
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Visibility
                            </label>
                              <div className="flex space-x-1">
                                <button
                                  type="button"
                                  onClick={() => setImageVisibility('PUBLIC')}
                                  className={`px-1 py-0.5 text-xs rounded-none transition-colors ${
                                    imageVisibility === 'PUBLIC'
                                      ? 'bg-primary-600 text-white'
                                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                  }`}
                                >
                                  Public
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setImageVisibility('FRIENDS_ONLY')}
                                  className={`px-1 py-0.5 text-xs rounded-none transition-colors ${
                                    imageVisibility === 'FRIENDS_ONLY'
                                      ? 'bg-primary-600 text-white'
                                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                  }`}
                                >
                                  Friends
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setImageVisibility('PRIVATE')}
                                  className={`px-1 py-0.5 text-xs rounded-none transition-colors ${
                                    imageVisibility === 'PRIVATE'
                                      ? 'bg-primary-600 text-white'
                                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                  }`}
                                >
                                  Private
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {hasUploads && (
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                disabled={isUploading}
                className={`px-4 py-2 font-medium transition-colors duration-200 ${
                  isUploading 
                    ? 'text-gray-400 cursor-not-allowed' 
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                {isUploading ? 'Uploading...' : 'Cancel'}
              </button>
              {!isUploading && (
                <button
                  type="button"
                  onClick={handleUploadWithWarning}
                  disabled={!canUpload}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {allSuccessful ? 'Upload Complete' : `Upload ${uploadFiles.length} ${uploadFiles.length === 1 ? 'Image' : 'Images'}`}
                </button>
              )}
            </div>
          )}
        </>
      )

      // Return with or without modal wrapper
      if (inline) {
        return content
      }

      return (
        <>
          <AnimatePresence>
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden"
              >
                {content}
              </motion.div>
            </div>
          </AnimatePresence>

          {/* Unsaved Metadata Warning Dialog */}
          <AnimatePresence>
            {showUnsavedWarning && (
              <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white rounded-lg max-w-md w-full p-6"
                >
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-lg font-medium text-gray-900">
                        Unsaved Metadata
                      </h3>
                    </div>
                  </div>
                  
                  <div className="mb-6">
                    <p className="text-sm text-gray-600">
                      You have entered shared metadata (title, description, or tags) that hasn't been applied to all images yet.
                    </p>
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-2">Unsaved metadata:</p>
                      {sharedTitle && (
                        <p className="text-xs text-gray-700"><strong>Title:</strong> {sharedTitle}</p>
                      )}
                      {sharedDescription && (
                        <p className="text-xs text-gray-700"><strong>Description:</strong> {sharedDescription}</p>
                      )}
                      {sharedTags.length > 0 && (
                        <p className="text-xs text-gray-700"><strong>Tags:</strong> {sharedTags.join(', ')}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={handleApplyAndUpload}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Apply & Upload
                    </button>
                    <button
                      type="button"
                      onClick={handleUploadWithoutApplying}
                      className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                    >
                      Upload Without Applying
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowUnsavedWarning(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>
      )
    } 