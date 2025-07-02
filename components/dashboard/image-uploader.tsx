'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, X, Image as ImageIcon, Tag, FileText } from 'lucide-react'

interface ImageUploaderProps {
  userId: string
  onClose: () => void
  onUploadComplete: () => void
}

interface UploadFile {
  file: File
  preview: string
  title: string
  description: string
  tags: string[]
}

export function ImageUploader({ userId, onClose, onUploadComplete }: ImageUploaderProps) {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    try {
      const token = localStorage.getItem('token')
      
      for (const uploadFile of uploadFiles) {
        const formData = new FormData()
        formData.append('image', uploadFile.file)
        formData.append('title', uploadFile.title)
        formData.append('description', uploadFile.description)
        formData.append('tags', JSON.stringify(uploadFile.tags))
        formData.append('userId', userId)

        const response = await fetch('/api/images/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        })

        if (!response.ok) {
          throw new Error(`Failed to upload ${uploadFile.file.name}`)
        }
      }

      onUploadComplete()
    } catch (error) {
      console.error('Upload failed:', error)
      alert('Failed to upload images. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

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
            <h2 className="text-xl font-semibold text-gray-900">Upload Images</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            {/* Upload Area */}
            {uploadFiles.length === 0 && (
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
            {uploadFiles.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">
                    {uploadFiles.length} {uploadFiles.length === 1 ? 'image' : 'images'} selected
                  </h3>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-secondary"
                  >
                    Add More
                  </button>
                </div>

                <div className="space-y-4">
                  {uploadFiles.map((uploadFile, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-gray-50 rounded-lg p-4"
                    >
                      <div className="flex space-x-4">
                        {/* Image Preview */}
                        <div className="flex-shrink-0">
                          <img
                            src={uploadFile.preview}
                            alt={uploadFile.title}
                            className="w-20 h-20 object-cover rounded-lg"
                          />
                        </div>

                        {/* File Details */}
                        <div className="flex-1 space-y-3">
                          {/* Title */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              <FileText className="h-4 w-4 inline mr-1" />
                              Title
                            </label>
                            <input
                              type="text"
                              value={uploadFile.title}
                              onChange={(e) => updateFile(index, { title: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              placeholder="Enter image title"
                            />
                          </div>

                          {/* Description */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Description
                            </label>
                            <textarea
                              value={uploadFile.description}
                              onChange={(e) => updateFile(index, { description: e.target.value })}
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                              placeholder="Enter image description (optional)"
                            />
                          </div>

                          {/* Tags */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              <Tag className="h-4 w-4 inline mr-1" />
                              Tags
                            </label>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {uploadFile.tags.map((tag, tagIndex) => (
                                <span
                                  key={tagIndex}
                                  className="px-2 py-1 bg-primary-100 text-primary-700 text-sm rounded-full flex items-center space-x-1"
                                >
                                  <span>{tag}</span>
                                  <button
                                    type="button"
                                    onClick={() => removeTag(index, tag)}
                                    className="hover:text-primary-900"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                            <input
                              type="text"
                              placeholder="Add a tag and press Enter"
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  addTag(index, e.currentTarget.value)
                                  e.currentTarget.value = ''
                                }
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                          </div>
                        </div>

                        {/* Remove Button */}
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="flex-shrink-0 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-200"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>

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
          </div>

          {/* Footer */}
          {uploadFiles.length > 0 && (
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
                disabled={isUploading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={isUploading}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Upload className="h-4 w-4" />
                <span>{isUploading ? 'Uploading...' : `Upload ${uploadFiles.length} ${uploadFiles.length === 1 ? 'Image' : 'Images'}`}</span>
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
} 