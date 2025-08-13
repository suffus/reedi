'use client'

import React, { useState } from 'react'
import { API_BASE_URL, getAuthHeaders } from '@/lib/api'
import { 
  X, 
  Users, 
  Globe, 
  Eye, 
  EyeOff, 
  Lock, 
  Shield,
  Upload,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { useToast } from '@/components/common/toast'

interface CreateGroupModalProps {
  isOpen: boolean
  onClose: () => void
  onGroupCreated: (group: any) => void
}

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  onGroupCreated
}) => {
  const { showToast } = useToast()
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    description: '',
    rules: '',
    visibility: 'PRIVATE_VISIBLE',
    type: 'GENERAL',
    moderationPolicy: 'NO_MODERATION'
  })
  
  const [avatar, setAvatar] = useState<File | null>(null)
  const [coverPhoto, setCoverPhoto] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string>('')
  const [coverPreview, setCoverPreview] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [isCheckingUsername, setIsCheckingUsername] = useState(false)

  const totalSteps = 3

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Check username availability when username field changes
    if (field === 'username' && value.length >= 3) {
      checkUsernameAvailability(value)
    }
  }

  const checkUsernameAvailability = async (username: string) => {
    if (username.length < 3) return
    
    setIsCheckingUsername(true)
    try {
      const response = await fetch(`${API_BASE_URL}/groups/${username}`, {
        headers: getAuthHeaders()
      })
      const data = await response.json()
      if (data.success) {
        setUsernameAvailable(false) // Username exists
      } else {
        setUsernameAvailable(true) // Username available
      }
    } catch (error: any) {
      setUsernameAvailable(null) // Error occurred
    } finally {
      setIsCheckingUsername(false)
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

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return formData.name.trim().length > 0 && 
               formData.username.trim().length >= 3 && 
               usernameAvailable === true
      case 2:
        return true // Optional fields
      case 3:
        return true // Optional fields
      default:
        return false
    }
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps))
    }
  }

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
  }

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) {
      showToast({
        type: 'error',
        message: 'Please complete all required fields'
      })
      return
    }

    setIsLoading(true)
    try {
      // Create form data for file uploads
      const submitData = new FormData()
      submitData.append('name', formData.name)
      submitData.append('username', formData.username)
      submitData.append('description', formData.description)
      submitData.append('rules', formData.rules)
      submitData.append('visibility', formData.visibility)
      submitData.append('type', formData.type)
      submitData.append('moderationPolicy', formData.moderationPolicy)
      
      if (avatar) {
        submitData.append('avatar', avatar)
      }
      if (coverPhoto) {
        submitData.append('coverPhoto', coverPhoto)
      }

      // For FormData, we need to exclude Content-Type header to let browser set it
      // But we need to include the Authorization header
      const token = localStorage.getItem('token')
      if (!token) {
        showToast({
          type: 'error',
          message: 'Authentication token not found. Please log in again.'
        })
        return
      }
      const { 'Content-Type': _, ...authHeaders } = getAuthHeaders(token)
      
      const response = await fetch(`${API_BASE_URL}/groups`, {
        method: 'POST',
        headers: authHeaders,
        body: submitData
      })
      const data = await response.json()

      if (data.success) {
        showToast({
          type: 'success',
          message: 'Group created successfully'
        })
        console.log('Group created successfully:', data.data.group)
        onGroupCreated(data.data.group)
        onClose()
        resetForm()
      } else {
        console.error('Group creation failed:', data)
        showToast({
          type: 'error',
          message: data.error || 'Failed to create group'
        })
      }
    } catch (error: any) {
      console.error('Error creating group:', error)
      showToast({
        type: 'error',
        message: 'Failed to create group'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      username: '',
      description: '',
      rules: '',
      visibility: 'PRIVATE_VISIBLE',
      type: 'GENERAL',
      moderationPolicy: 'NO_MODERATION'
    })
    setAvatar(null)
    setCoverPhoto(null)
    setAvatarPreview('')
    setCoverPreview('')
    setCurrentStep(1)
    setUsernameAvailable(null)
  }

  const getVisibilityInfo = () => {
    switch (formData.visibility) {
      case 'PUBLIC':
        return {
          icon: <Globe className="w-4 h-4" />,
          label: 'Public',
          description: 'Anyone can see the group, its members, and content. Anyone can join.',
          color: 'bg-green-100 text-green-800'
        }
      case 'PRIVATE_VISIBLE':
        return {
          icon: <Eye className="w-4 h-4" />,
          label: 'Private (Visible)',
          description: 'Anyone can find the group and see basic info, but only members can see content.',
          color: 'bg-yellow-100 text-yellow-800'
        }
      case 'PRIVATE_HIDDEN':
        return {
          icon: <EyeOff className="w-4 h-4" />,
          label: 'Private (Hidden)',
          description: 'Only members can see the group. It\'s not searchable and requires invitation.',
          color: 'bg-red-100 text-red-800'
        }
      default:
        return {
          icon: <Lock className="w-4 h-4" />,
          label: 'Unknown',
          description: '',
          color: 'bg-gray-100 text-gray-800'
        }
    }
  }

  const getTypeInfo = () => {
    switch (formData.type) {
      case 'GENERAL':
        return 'General community discussions'
      case 'SOCIAL_LEARNING':
        return 'Learning and educational content'
      case 'GAMING':
        return 'Gaming discussions and content'
      case 'JOBS':
        return 'Job opportunities and career discussions'
      case 'BUY_SELL':
        return 'Buying and selling items'
      case 'PARENTING':
        return 'Parenting advice and discussions'
      case 'WORK':
        return 'Work-related discussions'
      default:
        return ''
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold">Create New Group</h2>
            <p className="text-gray-600">Build a community around your interests</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Step {currentStep} of {totalSteps}</span>
            <span className="text-sm text-gray-500">
              {Math.round((currentStep / totalSteps) * 100)}% Complete
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Form Content */}
        <div className="p-6">
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">Group Name *</label>
                    <input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="Enter group name"
                      maxLength={100}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {formData.name.length}/100 characters
                    </p>
                  </div>
                  
                  <div>
                    <label htmlFor="username" className="block text-sm font-medium text-gray-700">Group Username *</label>
                    <div className="relative">
                      <input
                        id="username"
                        value={formData.username}
                        onChange={(e) => handleInputChange('username', e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                        placeholder="group-username"
                        maxLength={30}
                        className={usernameAvailable === false ? 'border-red-500' : usernameAvailable === true ? 'border-green-500' : ''}
                      />
                      {isCheckingUsername && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                        </div>
                      )}
                      {usernameAvailable === true && (
                        <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-500" />
                      )}
                      {usernameAvailable === false && (
                        <AlertCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-red-500" />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {formData.username.length}/30 characters • Only letters, numbers, and hyphens
                    </p>
                    {usernameAvailable === false && (
                      <p className="mt-1 text-xs text-red-500">Username already taken</p>
                    )}
                  </div>
                </div>
                
                <div className="mt-4">
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Describe what this group is about..."
                    maxLength={500}
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {formData.description.length}/500 characters
                  </p>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Privacy & Type</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Group Visibility *</label>
                    <select
                      value={formData.visibility}
                      onChange={(e) => handleInputChange('visibility', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    >
                      <option value="PUBLIC">Public</option>
                      <option value="PRIVATE_VISIBLE">Private (Visible)</option>
                      <option value="PRIVATE_HIDDEN">Private (Hidden)</option>
                    </select>
                    
                    <div className="mt-2 p-3 rounded-lg border">
                      <div className="flex items-center space-x-2 mb-2">
                        {getVisibilityInfo().icon}
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getVisibilityInfo().color}`}>
                          {getVisibilityInfo().label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{getVisibilityInfo().description}</p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Group Type *</label>
                    <select
                      value={formData.type}
                      onChange={(e) => handleInputChange('type', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    >
                      <option value="GENERAL">General</option>
                      <option value="SOCIAL_LEARNING">Social Learning</option>
                      <option value="GAMING">Gaming</option>
                      <option value="JOBS">Jobs</option>
                      <option value="BUY_SELL">Buy & Sell</option>
                      <option value="PARENTING">Parenting</option>
                      <option value="WORK">Work</option>
                    </select>
                    
                    <div className="mt-2 p-3 rounded-lg border">
                      <p className="text-sm text-gray-600">{getTypeInfo()}</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700">Moderation Policy *</label>
                  <select
                    value={formData.moderationPolicy}
                    onChange={(e) => handleInputChange('moderationPolicy', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  >
                    <option value="NO_MODERATION">No Moderation</option>
                    <option value="ADMIN_APPROVAL_REQUIRED">Admin Approval Required</option>
                    <option value="AI_FILTER">AI Filter</option>
                    <option value="SELECTIVE_MODERATION">Selective Moderation</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Customization & Rules</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Group Avatar</label>
                    <div className="mt-2">
                      <div className="flex items-center space-x-4">
                        <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                          {avatarPreview ? (
                            <img src={avatarPreview} alt="Avatar preview" className="w-full h-full object-cover rounded-full" />
                          ) : (
                            <span className="text-2xl text-gray-500">{formData.name.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div>
                          <button
                            onClick={() => document.getElementById('avatar-upload')?.click()}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Upload Avatar
                          </button>
                          <input
                            id="avatar-upload"
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileChange('avatar', e.target.files?.[0] || null)}
                            className="hidden"
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            Recommended: 200x200px, PNG or JPG
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Cover Photo</label>
                    <div className="mt-2">
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                        {coverPreview ? (
                          <div className="relative">
                            <img
                              src={coverPreview}
                              alt="Cover preview"
                              className="w-full h-32 object-cover rounded-lg"
                            />
                            <button
                              onClick={() => handleFileChange('coverPhoto', null)}
                              className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-200"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div>
                            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <button
                              onClick={() => document.getElementById('cover-upload')?.click()}
                              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              Upload Cover Photo
                            </button>
                            <input
                              id="cover-upload"
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleFileChange('coverPhoto', e.target.files?.[0] || null)}
                              className="hidden"
                            />
                            <p className="mt-1 text-xs text-gray-500">
                              Recommended: 1200x400px, PNG or JPG
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6">
                  <label htmlFor="rules" className="block text-sm font-medium text-gray-700">Group Rules</label>
                  <textarea
                    id="rules"
                    value={formData.rules}
                    onChange={(e) => handleInputChange('rules', e.target.value)}
                    placeholder="Set rules for your group members..."
                    maxLength={2000}
                    rows={6}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {formData.rules.length}/2000 characters
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-6 border-t">
            <div>
              {currentStep > 1 && (
                <button onClick={prevStep} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
                  Previous
                </button>
              )}
            </div>
            
            <div className="flex space-x-3">
              {currentStep < totalSteps ? (
                <button 
                  onClick={nextStep}
                  disabled={!validateStep(currentStep)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Next Step
                </button>
              ) : (
                <button 
                  onClick={handleSubmit}
                  disabled={!validateStep(currentStep) || isLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {isLoading ? 'Creating Group...' : 'Create Group'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreateGroupModal 