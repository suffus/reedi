'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Camera, Settings, LogOut, Plus, Grid, List, Users, UserPlus } from 'lucide-react'
import { PersonalFeed } from './personal-feed'
import { UserGallery } from './user-gallery'
import { ProfileEditor } from './profile-editor'
import { ImageUploader } from './image-uploader'
import FriendRequests from './friend-requests'
import FriendsList from './friends-list'
import { useAuth } from '../../lib/api-hooks'

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

export function DashboardWrapper() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'feed' | 'gallery' | 'profile' | 'friends' | 'requests'>('feed')
  const [showImageUploader, setShowImageUploader] = useState(false)
  const [isClient, setIsClient] = useState(false)

  const { data: authData, isLoading, error } = useAuth()

  const handleUploadComplete = useCallback(() => {
    // The optimistic update will handle this automatically
    console.log('Upload complete')
  }, [])

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (isClient && !isLoading && !authData) {
      // Clear any invalid token and redirect to login
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token')
      }
      router.push('/')
    }
  }, [authData, isLoading, router, isClient])

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token')
    }
    router.push('/')
  }

  const handleProfileUpdate = (updatedUser: UserData) => {
    // The auth query will automatically refetch when the profile is updated
  }

  // Don't render anything until client-side hydration is complete
  if (!isClient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (error || !authData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Authentication failed</p>
          <button 
            onClick={() => router.push('/')}
            className="btn-primary"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  const user = authData.data.user

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-accent-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">R</span>
              </div>
              <span className="text-xl font-serif font-bold gradient-text">Reedi</span>
            </div>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowImageUploader(true)}
                className="btn-primary flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Upload Image</span>
              </button>
              
              <div className="relative group">
                <button className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200">
                  <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-accent-500 rounded-full flex items-center justify-center text-white font-semibold">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      user.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <span className="hidden md:block font-medium">{user.name}</span>
                </button>
                
                {/* Dropdown Menu */}
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                  <div className="py-1">
                    <button
                      onClick={() => setActiveTab('profile')}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <User className="h-4 w-4" />
                      <span>Profile</span>
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 text-red-600"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-serif font-bold text-gray-900 mb-2">
            Welcome back, {user.name}! 👋
          </h1>
          <p className="text-gray-600">
            Here's what's happening with your family and friends
          </p>
        </motion.div>

        {/* Navigation Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200 overflow-x-auto">
            <button
              onClick={() => setActiveTab('feed')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors duration-200 whitespace-nowrap ${
                activeTab === 'feed'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <List className="h-4 w-4" />
              <span>Feed</span>
            </button>
            <button
              onClick={() => setActiveTab('gallery')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors duration-200 whitespace-nowrap ${
                activeTab === 'gallery'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Grid className="h-4 w-4" />
              <span>Gallery</span>
            </button>
            <button
              onClick={() => setActiveTab('friends')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors duration-200 whitespace-nowrap ${
                activeTab === 'friends'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Friends</span>
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors duration-200 whitespace-nowrap ${
                activeTab === 'requests'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <UserPlus className="h-4 w-4" />
              <span>Requests</span>
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors duration-200 whitespace-nowrap ${
                activeTab === 'profile'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Settings className="h-4 w-4" />
              <span>Profile</span>
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'feed' && (
            <motion.div
              key="feed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <PersonalFeed />
            </motion.div>
          )}

          {activeTab === 'gallery' && (
            <motion.div
              key="gallery"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <UserGallery userId={user.id} />
            </motion.div>
          )}

          {activeTab === 'friends' && (
            <motion.div
              key="friends"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <FriendsList />
            </motion.div>
          )}

          {activeTab === 'requests' && (
            <motion.div
              key="requests"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <FriendRequests />
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <ProfileEditor user={user} onUpdate={handleProfileUpdate} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Image Uploader Modal */}
      <AnimatePresence>
        {showImageUploader && (
          <ImageUploader
            userId={user.id}
            onClose={() => setShowImageUploader(false)}
            onUploadComplete={handleUploadComplete}
          />
        )}
      </AnimatePresence>
    </div>
  )
} 