'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, X, Image as ImageIcon, Tag, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { useUploadImage } from '../../lib/api-hooks'

interface ImageUploaderProps {
  userId: string
  onClose: () => void
  onUploadComplete?: () => void
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

export function ImageUploader({ userId, onClose, onUploadComplete }: ImageUploaderProps) {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadImageMutation = useUploadImage()

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
  }

  const handleFiles = (files: File[]) => {
    const imageFiles = files.filter(file => file.type.startsWith('image/'))
    
    imageFiles.forEach(file => {
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

  const addTag = (index: number, tag: string) => {
    if (tag.trim() && !uploadFiles[index].tags.includes(tag.trim())) {
      updateFile(index, {
        tags: [...uploadFiles[index].tags, tag.trim()]
      })
    }
  }

  const removeTag = (index: number, tagToRemove: string) => {
    updateFile(index, {
      tags: uploadFiles[index].tags.filter(tag => tag !== tagToRemove)
    })
  }

  const handleUpload = async () => {
    if (uploadFiles.length === 0) return

    setIsUploading(true)
    
    // Initialize progress for all files
    const initialProgress: UploadProgress = {}
    uploadFiles.forEach((_, index) => {
      initialProgress[index] = { status: 'pending' }
    })
    setUploadProgress(initialProgress)

    const results = []
    let hasErrors = false

    try {
      for (let i = 0; i < uploadFiles.length; i++) {
        const uploadFile = uploadFiles[i]
        
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

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
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

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
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

            {/* Uploaded Files */}
            {!isUploading && uploadFiles.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">
                    {uploadFiles.length} {uploadFiles.length === 1 ? 'image' : 'images'} selected
                  </h3>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Add More
                  </button>
                </div>

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
                            <div className="flex flex-wrap gap-2 mb-2">
                              {file.tags.map((tag, tagIndex) => (
                                <span
                                  key={tagIndex}
                                  className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary-100 text-primary-800"
                                >
                                  {tag}
                                  <button
                                    type="button"
                                    onClick={() => removeTag(index, tag)}
                                    className="ml-1 hover:text-primary-600"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                            <div className="flex space-x-2">
                              <input
                                type="text"
                                placeholder="Add a tag..."
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    addTag(index, e.currentTarget.value)
                                    e.currentTarget.value = ''
                                  }
                                }}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  const input = e.currentTarget.previousElementSibling as HTMLInputElement
                                  addTag(index, input.value)
                                  input.value = ''
                                }}
                                className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition-colors duration-200"
                              >
                                Add
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
                  onClick={handleUpload}
                  disabled={!canUpload}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {allSuccessful ? 'Upload Complete' : `Upload ${uploadFiles.length} ${uploadFiles.length === 1 ? 'Image' : 'Images'}`}
                </button>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
} 