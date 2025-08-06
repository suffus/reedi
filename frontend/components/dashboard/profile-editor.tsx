'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Camera, Save, User, Mail, MapPin, Globe, Lock, Eye, EyeOff } from 'lucide-react'
import { useUpdateProfile, useUploadAvatar } from '../../lib/api-hooks'

interface UserData {
  id: string
  name: string
  email: string
  username: string | null
  avatar: string | null
  bio: string | null
  location: string | null
  website: string | null
  isPrivate: boolean
  isVerified: boolean
}

interface ProfileEditorProps {
  user: UserData
  onUpdate: (updatedUser: UserData) => void
}

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email'),
  username: z.string().min(3, 'Username must be at least 3 characters').optional(),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  location: z.string().max(100, 'Location must be less than 100 characters').optional(),
  website: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  isPrivate: z.boolean(),
})

type ProfileForm = z.infer<typeof profileSchema>

export function ProfileEditor({ user, onUpdate }: ProfileEditorProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatar)

  const updateProfileMutation = useUpdateProfile()
  const uploadAvatarMutation = useUploadAvatar()

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user.name,
      email: user.email,
      username: user.username || '',
      bio: user.bio || '',
      location: user.location || '',
      website: user.website || '',
      isPrivate: user.isPrivate,
    },
  })

  const onSubmit = async (data: ProfileForm) => {
    try {
      const result = await updateProfileMutation.mutateAsync(data)
      onUpdate(result.data.user)
    } catch (error) {
      console.error('Failed to update profile:', error)
    }
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type - accept both images and videos for avatar
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      alert('Please select an image or video file')
      return
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB')
      return
    }

    try {
      const formData = new FormData()
      formData.append('avatar', file)

      const result = await uploadAvatarMutation.mutateAsync(formData)
      onUpdate(result.data.user)
      setAvatarPreview(result.data.user.avatar)
    } catch (error) {
      console.error('Failed to upload avatar:', error)
      alert('Failed to upload avatar. Please try again.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-serif font-bold text-gray-900">Edit Profile</h2>
        <p className="text-gray-600 mt-1">
          Update your personal information and preferences
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center space-x-6">
            <div className="relative">
              <div className="w-24 h-24 bg-gradient-to-br from-primary-400 to-accent-500 rounded-full flex items-center justify-center text-white text-2xl font-semibold overflow-hidden">
                {avatarPreview ? (
                  <img src={avatarPreview} alt={user.name} className="w-24 h-24 rounded-full object-cover" />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
              </div>
              <label
                htmlFor="avatar-upload"
                className="absolute -bottom-2 -right-2 p-2 bg-primary-600 text-white rounded-full hover:bg-primary-700 transition-colors duration-200 cursor-pointer"
                title="Upload avatar"
              >
                <Camera className="h-4 w-4" />
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                  disabled={uploadAvatarMutation.isPending}
                />
              </label>
              {uploadAvatarMutation.isPending && (
                <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                </div>
              )}
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">{user.name}</h3>
              <p className="text-gray-600">@{user.username || 'username'}</p>
              <p className="text-sm text-gray-500 mt-1">
                Click the camera icon to upload a new avatar (images or videos)
              </p>
            </div>
          </div>

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                <User className="h-4 w-4 inline mr-1" />
                Full Name
              </label>
              <input
                id="name"
                type="text"
                {...form.register('name')}
                className="input-field"
                placeholder="Enter your full name"
              />
              {form.formState.errors.name && (
                <p className="mt-1 text-sm text-red-600">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                <Mail className="h-4 w-4 inline mr-1" />
                Email Address
              </label>
              <input
                id="email"
                type="email"
                {...form.register('email')}
                className="input-field"
                placeholder="Enter your email"
              />
              {form.formState.errors.email && (
                <p className="mt-1 text-sm text-red-600">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                <User className="h-4 w-4 inline mr-1" />
                Username
              </label>
              <input
                id="username"
                type="text"
                {...form.register('username')}
                className="input-field"
                placeholder="Enter your username"
              />
              {form.formState.errors.username && (
                <p className="mt-1 text-sm text-red-600">{form.formState.errors.username.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="h-4 w-4 inline mr-1" />
                Location
              </label>
              <input
                id="location"
                type="text"
                {...form.register('location')}
                className="input-field"
                placeholder="Enter your location"
              />
              {form.formState.errors.location && (
                <p className="mt-1 text-sm text-red-600">{form.formState.errors.location.message}</p>
              )}
            </div>
          </div>

          {/* Bio */}
          <div>
            <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-2">
              Bio
            </label>
            <textarea
              id="bio"
              {...form.register('bio')}
              rows={4}
              className="input-field resize-none"
              placeholder="Tell us about yourself..."
            />
            {form.formState.errors.bio && (
              <p className="mt-1 text-sm text-red-600">{form.formState.errors.bio.message}</p>
            )}
          </div>

          {/* Website */}
          <div>
            <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-2">
              <Globe className="h-4 w-4 inline mr-1" />
              Website
            </label>
            <input
              id="website"
              type="url"
              {...form.register('website')}
              className="input-field"
              placeholder="https://yourwebsite.com"
            />
            {form.formState.errors.website && (
              <p className="mt-1 text-sm text-red-600">{form.formState.errors.website.message}</p>
            )}
          </div>

          {/* Privacy Settings */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Privacy Settings</h3>
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">Private Profile</h4>
                <p className="text-sm text-gray-600">
                  Only approved followers can see your posts and profile
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  {...form.register('isPrivate')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={updateProfileMutation.isPending}
              className="btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" />
              <span>{updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
} 