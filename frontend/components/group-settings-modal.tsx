'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Save, Upload, Trash2, Eye, Users, Lock, Settings, AlertTriangle } from 'lucide-react'
import { useToast } from './common/toast'
import { API_BASE_URL, getAuthHeaders } from '@/lib/api'
import { Group, GroupVisibility, GroupType, GroupModerationPolicy } from '@/lib/types'

interface GroupSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  group: Group
  onGroupUpdated: (updatedGroup: Group) => void
}

export function GroupSettingsModal({ isOpen, onClose, group, onGroupUpdated }: GroupSettingsModalProps) {
  const { showToast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: group.name,
    description: group.description || '',
    rules: group.rules || '',
    visibility: group.visibility,
    type: group.type,
    moderationPolicy: group.moderationPolicy
  })
  
  // File state
  const [avatar, setAvatar] = useState<File | null>(null)
  const [coverPhoto, setCoverPhoto] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string>('')
  const [coverPreview, setCoverPreview] = useState<string>('')
  
  // Form validation state
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  // File input refs
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const coverPhotoInputRef = useRef<HTMLInputElement>(null)

  // Initialize form data when group changes
  useEffect(() => {
    if (group) {
      setFormData({
        name: group.name,
        description: group.description || '',
        rules: group.rules || '',
        visibility: group.visibility,
        type: group.type,
        moderationPolicy: group.moderationPolicy
      })
      
      // Set previews for existing images
      if (group.avatar) {
        setAvatarPreview(`${API_BASE_URL}/media/serve/${group.avatar}`)
      }
      if (group.coverPhoto) {
        setCoverPreview(`${API_BASE_URL}/media/serve/${group.coverPhoto}`)
      }
    }
  }, [group])

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setAvatar(null)
      setCoverPhoto(null)
      setErrors({})
    }
  }, [isOpen])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleFileChange = (field: 'avatar' | 'coverPhoto', file: File | null) => {
    if (field === 'avatar') {
      setAvatar(file)
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => setAvatarPreview(e.target?.result as string)
        reader.readAsDataURL(file)
      } else {
        setAvatarPreview('')
      }
    } else {
      setCoverPhoto(file)
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => setCoverPreview(e.target?.result as string)
        reader.readAsDataURL(file)
      } else {
        setCoverPreview('')
      }
    }
  }

  const removeImage = (field: 'avatar' | 'coverPhoto') => {
    if (field === 'avatar') {
      setAvatar(null)
      setAvatarPreview('')
    } else {
      setCoverPhoto(null)
      setCoverPreview('')
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'Group name is required'
    } else if (formData.name.length > 100) {
      newErrors.name = 'Group name must be 100 characters or less'
    }
    
    if (formData.description && formData.description.length > 500) {
      newErrors.description = 'Description must be 500 characters or less'
    }
    
    if (formData.rules && formData.rules.length > 2000) {
      newErrors.rules = 'Rules must be 2000 characters or less'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const canMakeMorePrivate = (currentVisibility: GroupVisibility, newVisibility: GroupVisibility): boolean => {
    const visibilityLevels = {
      'PUBLIC': 3,
      'PRIVATE_VISIBLE': 2,
      'PRIVATE_HIDDEN': 1
    }
    
    return visibilityLevels[newVisibility] <= visibilityLevels[currentVisibility]
  }

  const handleSubmit = async () => {
    if (!validateForm()) {
      return
    }

    // Check visibility restrictions
    if (!canMakeMorePrivate(group.visibility, formData.visibility)) {
      showToast({
        type: 'error',
        message: 'You cannot make a group more public than it currently is'
      })
      return
    }

    setIsLoading(true)
    
    try {
      // Create form data for file uploads
      const submitData = new FormData()
      submitData.append('name', formData.name.trim())
      submitData.append('description', formData.description.trim())
      submitData.append('rules', formData.rules.trim())
      submitData.append('visibility', formData.visibility)
      submitData.append('type', formData.type)
      submitData.append('moderationPolicy', formData.moderationPolicy)
      
      if (avatar) {
        submitData.append('avatar', avatar)
      }
      if (coverPhoto) {
        submitData.append('coverPhoto', coverPhoto)
      }

      const token = localStorage.getItem('token')
      if (!token) {
        showToast({
          type: 'error',
          message: 'Authentication token not found. Please log in again.'
        })
        return
      }
      
      const { 'Content-Type': _, ...authHeaders } = getAuthHeaders(token)
      
      const response = await fetch(`${API_BASE_URL}/groups/${group.username}`, {
        method: 'PUT',
        headers: authHeaders,
        body: submitData
      })
      
      const data = await response.json()

      if (data.success) {
        showToast({
          type: 'success',
          message: 'Group settings updated successfully'
        })
        
        // Call the callback with updated group data
        const updatedGroup = {
          ...group,
          ...formData,
          avatar: avatar ? 'temp-avatar-id' : group.avatar, // Will be updated by parent component
          coverPhoto: coverPhoto ? 'temp-cover-id' : group.coverPhoto
        }
        onGroupUpdated(updatedGroup)
        onClose()
      } else {
        showToast({
          type: 'error',
          message: data.error || 'Failed to update group settings'
        })
      }
    } catch (error: any) {
      console.error('Error updating group settings:', error)
      showToast({
        type: 'error',
        message: 'Failed to update group settings. Please try again.'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getVisibilityIcon = (visibility: GroupVisibility) => {
    switch (visibility) {
      case 'PUBLIC':
        return <Eye className="h-4 w-4" />
      case 'PRIVATE_VISIBLE':
        return <Users className="h-4 w-4" />
      case 'PRIVATE_HIDDEN':
        return <Lock className="h-4 w-4" />
    }
  }

  const getVisibilityDescription = (visibility: GroupVisibility) => {
    switch (visibility) {
      case 'PUBLIC':
        return 'Anyone can see and join this group'
      case 'PRIVATE_VISIBLE':
        return 'Group is visible but requires approval to join'
      case 'PRIVATE_HIDDEN':
        return 'Group is hidden and requires invitation to join'
    }
  }

  const getModerationPolicyDescription = (policy: GroupModerationPolicy) => {
    switch (policy) {
      case 'NO_MODERATION':
        return 'Posts are published immediately without review'
      case 'ADMIN_APPROVAL_REQUIRED':
        return 'All posts require admin approval before publication'
      case 'AI_FILTER':
        return 'Posts are automatically filtered by AI for inappropriate content'
      case 'SELECTIVE_MODERATION':
        return 'Some posts are flagged for manual review based on content'
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="group-settings-modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex min-h-screen items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            key="group-settings-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key={`group-settings-modal-${group.id}`}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <Settings className="h-6 w-6 text-gray-600" />
                <h2 className="text-xl font-semibold text-gray-900">Edit Group Settings</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column - Basic Settings */}
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
                    Basic Information
                  </h3>
                  
                  {/* Group Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Group Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.name ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter group name"
                    />
                    {errors.name && (
                      <p className="text-red-500 text-sm mt-1">{errors.name}</p>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      rows={3}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.description ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Describe your group..."
                    />
                    {errors.description && (
                      <p className="text-red-500 text-sm mt-1">{errors.description}</p>
                    )}
                    <p className="text-gray-500 text-sm mt-1">
                      {formData.description.length}/500 characters
                    </p>
                  </div>

                  {/* Group Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Group Type
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => handleInputChange('type', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="GENERAL">General</option>
                      <option value="SOCIAL_LEARNING">Social & Learning</option>
                      <option value="GAMING">Gaming</option>
                      <option value="JOBS">Jobs & Career</option>
                      <option value="BUY_SELL">Buy & Sell</option>
                      <option value="PARENTING">Parenting</option>
                      <option value="WORK">Work & Professional</option>
                    </select>
                  </div>

                  {/* Visibility */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Visibility
                    </label>
                    <div className="space-y-3">
                      {(['PUBLIC', 'PRIVATE_VISIBLE', 'PRIVATE_HIDDEN'] as GroupVisibility[]).map((visibility) => (
                        <label
                          key={visibility}
                          className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                            formData.visibility === visibility
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          } ${
                            !canMakeMorePrivate(group.visibility, visibility) && visibility !== group.visibility
                              ? 'opacity-50 cursor-not-allowed'
                              : ''
                          }`}
                        >
                          <input
                            type="radio"
                            name="visibility"
                            value={visibility}
                            checked={formData.visibility === visibility}
                            onChange={(e) => handleInputChange('visibility', e.target.value)}
                            disabled={!canMakeMorePrivate(group.visibility, visibility) && visibility !== group.visibility}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <div className="flex items-center space-x-2">
                            {getVisibilityIcon(visibility)}
                            <div>
                              <div className="font-medium text-gray-900">
                                {visibility === 'PUBLIC' ? 'Public' : 
                                 visibility === 'PRIVATE_VISIBLE' ? 'Private (Visible)' : 'Private (Hidden)'}
                              </div>
                              <div className="text-sm text-gray-600">
                                {getVisibilityDescription(visibility)}
                              </div>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                    {!canMakeMorePrivate(group.visibility, formData.visibility) && formData.visibility !== group.visibility && (
                      <div className="flex items-center space-x-2 mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <p className="text-sm text-yellow-800">
                          You cannot make this group more public than it currently is
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column - Advanced Settings & Images */}
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
                    Advanced Settings & Media
                  </h3>

                  {/* Moderation Policy */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Moderation Policy
                    </label>
                    <select
                      value={formData.moderationPolicy}
                      onChange={(e) => handleInputChange('moderationPolicy', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="NO_MODERATION">No Moderation</option>
                      <option value="ADMIN_APPROVAL_REQUIRED">Admin Approval Required</option>
                      <option value="AI_FILTER">AI Filter</option>
                      <option value="SELECTIVE_MODERATION">Selective Moderation</option>
                    </select>
                    <p className="text-gray-500 text-sm mt-1">
                      {getModerationPolicyDescription(formData.moderationPolicy)}
                    </p>
                  </div>

                  {/* Rules */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Group Rules
                    </label>
                    <textarea
                      value={formData.rules}
                      onChange={(e) => handleInputChange('rules', e.target.value)}
                      rows={4}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.rules ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Set rules for group members..."
                    />
                    {errors.rules && (
                      <p className="text-red-500 text-sm mt-1">{errors.rules}</p>
                    )}
                    <p className="text-gray-500 text-sm mt-1">
                      {formData.rules.length}/2000 characters
                    </p>
                  </div>

                  {/* Avatar Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Group Avatar
                    </label>
                    <div className="space-y-3">
                      {avatarPreview && (
                        <div className="relative inline-block">
                          <img
                            src={avatarPreview}
                            alt="Avatar preview"
                            className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage('avatar')}
                            className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileChange('avatar', e.target.files?.[0] || null)}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Upload className="h-4 w-4" />
                        <span>Upload Avatar</span>
                      </button>
                    </div>
                  </div>

                  {/* Cover Photo Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cover Photo
                    </label>
                    <div className="space-y-3">
                      {coverPreview && (
                        <div className="relative inline-block">
                          <img
                            src={coverPreview}
                            alt="Cover preview"
                            className="w-full h-32 object-cover rounded-lg border-2 border-gray-200"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage('coverPhoto')}
                            className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                      <input
                        ref={coverPhotoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileChange('coverPhoto', e.target.files?.[0] || null)}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => coverPhotoInputRef.current?.click()}
                        className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Upload className="h-4 w-4" />
                        <span>Upload Cover Photo</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
} 