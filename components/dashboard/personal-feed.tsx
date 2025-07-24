'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Heart, MessageCircle, Share, MoreHorizontal, User, Clock, Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { usePostsFeed, usePostReaction, useComments, useCreateComment, useAuth, useReorderPostImages } from '../../lib/api-hooks'
import { ImageDetailModal } from './image-detail-modal'
import { PostMenu } from './post-menu'
import { FullScreenWrapper } from '../full-screen-wrapper'
import { PostAuthorForm } from './post-author-form'
import { getImageUrl, getImageUrlFromImage } from '../../lib/api'
import { LazyImage } from '../lazy-image'

interface Post {
  id: string
  content: string
  publicationStatus: 'PUBLIC' | 'PAUSED' | 'CONTROLLED' | 'DELETED'
  visibility: 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE'
  authorId: string
  images: {
    id: string
    url: string
    thumbnail?: string | null
    altText?: string | null
    caption?: string | null
    width?: number | null
    height?: number | null
  }[]
  createdAt: string
  author: {
    id: string
    name: string
    username: string | null
    avatar: string | null
  }
  reactions: {
    id: string
    type: string
    authorId: string
  }[]
  comments: {
    id: string
    content: string
    createdAt: string
    author: {
      id: string
      name: string
      username: string | null
      avatar: string | null
    }
  }[]
  _count: {
    reactions: number
    comments: number
  }
}

interface Comment {
  id: string
  content: string
  createdAt: string
  author: {
    id: string
    name: string
    username: string | null
    avatar: string | null
  }
}

export function PersonalFeed() {
  const router = useRouter()
  const [newComments, setNewComments] = useState<{ [postId: string]: string }>({})
  const [showComments, setShowComments] = useState<{ [postId: string]: boolean }>({})
  const [selectedImageForDetail, setSelectedImageForDetail] = useState<any>(null)
  const [isImageDetailModalOpen, setIsImageDetailModalOpen] = useState(false)
  const [currentPostImages, setCurrentPostImages] = useState<any[]>([])
  const [currentPostId, setCurrentPostId] = useState<string | null>(null)

  const { data: authData, isLoading: authLoading } = useAuth()
  const userId = authData?.data?.user?.id
  const user = authData?.data?.user

  const { data: postsData, isLoading } = usePostsFeed()
  const postReactionMutation = usePostReaction()
  const createCommentMutation = useCreateComment()
  const reorderImagesMutation = useReorderPostImages()

  const posts = postsData?.data?.posts || []

  const handleReaction = async (postId: string, type: string) => {
    try {
      await postReactionMutation.mutateAsync({ postId, type })
    } catch (error) {
      console.error('Failed to add reaction:', error)
    }
  }

  const handleAddComment = async (postId: string) => {
    const commentContent = newComments[postId]?.trim()
    if (!commentContent) return

    try {
      await createCommentMutation.mutateAsync({
        content: commentContent,
        postId
      })
      setNewComments(prev => ({ ...prev, [postId]: '' }))
    } catch (error) {
      console.error('Failed to add comment:', error)
    }
  }

  const toggleComments = (postId: string) => {
    setShowComments(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }))
  }

  const hasUserLiked = (post: Post) => {
    // This would need to be implemented based on the current user's reactions
    return post.reactions.some(reaction => reaction.type === 'LIKE')
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleAuthorClick = (authorId: string, authorUsername: string | null) => {
    // Don't navigate if it's the current user's own post
    if (authorId === user?.id) return
    
    // Navigate to the user's public profile
    const identifier = authorUsername || authorId
    router.push(`/user/${identifier}`)
  }

  const handleImageClick = async (image: any, postId?: string, postImages?: any[]) => {
    try {
      // Fetch complete image data from backend
      const token = localStorage.getItem('token')
      if (!token) return
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8088/api'}/images/${image.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch image details')
      }
      
      const data = await response.json()
      if (data.success) {
        // Map the backend image data to the format expected by ImageDetailModal
        const mappedImage = {
          id: data.data.image.id,
          s3Key: data.data.image.s3Key || data.data.image.url,
          thumbnailS3Key: data.data.image.thumbnailS3Key || data.data.image.thumbnail || data.data.image.url,
          url: data.data.image.s3Key || data.data.image.url, // Keep for backward compatibility
          thumbnail: data.data.image.thumbnailS3Key || data.data.image.thumbnail || data.data.image.url, // Keep for backward compatibility
          title: data.data.image.altText || data.data.image.title,
          description: data.data.image.caption || data.data.image.description,
          createdAt: data.data.image.createdAt,
          authorId: data.data.image.authorId,
          tags: data.data.image.tags || [],
          metadata: {
            width: data.data.image.width || 0,
            height: data.data.image.height || 0,
            size: data.data.image.size || 0,
            format: data.data.image.mimeType || 'unknown'
          }
        }
        
        // Set post context for navigation
        if (postId && postImages) {
          setCurrentPostId(postId)
          setCurrentPostImages(postImages.map(img => ({
            id: img.id,
            s3Key: img.s3Key || img.url,
            thumbnailS3Key: img.thumbnailS3Key || img.thumbnail || img.url,
            url: img.s3Key || img.url,
            thumbnail: img.thumbnailS3Key || img.thumbnail || img.url,
            title: img.altText || img.title,
            description: img.caption || img.description,
            createdAt: img.createdAt,
            authorId: img.authorId,
            tags: img.tags || [],
            metadata: {
              width: img.width || 0,
              height: img.height || 0,
              size: img.size || 0,
              format: img.mimeType || 'unknown'
            }
          })))
        }
        
        setSelectedImageForDetail(mappedImage)
        setIsImageDetailModalOpen(true)
      }
    } catch (error) {
      console.error('Failed to fetch image details:', error)
      // Fallback to using the post image data if fetch fails
      // Ensure the fallback image has the correct structure
      const fallbackImage = {
        id: image.id,
        s3Key: image.s3Key || image.url,
        thumbnailS3Key: image.thumbnailS3Key || image.thumbnail || image.url,
        url: image.s3Key || image.url,
        thumbnail: image.thumbnailS3Key || image.thumbnail || image.url,
        title: image.altText || image.title,
        description: image.caption || image.description,
        createdAt: image.createdAt,
        authorId: image.authorId,
        tags: image.tags || [],
        metadata: {
          width: image.width || 0,
          height: image.height || 0,
          size: image.size || 0,
          format: image.mimeType || 'unknown'
        }
      }
      
      // Set post context for navigation
      if (postId && postImages) {
        setCurrentPostId(postId)
        setCurrentPostImages(postImages.map(img => ({
          id: img.id,
          s3Key: img.s3Key || img.url,
          thumbnailS3Key: img.thumbnailS3Key || img.thumbnail || img.url,
          url: img.s3Key || img.url,
          thumbnail: img.thumbnailS3Key || img.thumbnail || img.url,
          title: img.altText || img.title,
          description: img.caption || img.description,
          createdAt: img.createdAt,
          authorId: img.authorId,
          tags: img.tags || [],
          metadata: {
            width: img.width || 0,
            height: img.height || 0,
            size: img.size || 0,
            format: img.mimeType || 'unknown'
          }
        })))
      }
      
      setSelectedImageForDetail(fallbackImage)
      setIsImageDetailModalOpen(true)
    }
  }

  // Helper component for post image layout
  function PostImagesDisplay({ 
    images, 
    onImageClick, 
    postId, 
    isOwner 
  }: { 
    images: Post["images"], 
    onImageClick: (image: any) => void,
    postId: string,
    isOwner: boolean
  }) {
    const [draggedImage, setDraggedImage] = useState<any>(null)
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [isReordering, setIsReordering] = useState(false)
    const [reorderedImages, setReorderedImages] = useState<Post["images"]>(images)
    
    // Update reordered images when images prop changes
    useEffect(() => {
      setReorderedImages(images)
    }, [images])
    
    if (!reorderedImages || reorderedImages.length === 0) return null;
    
    // Show reorder indicator for post owners
    const showReorderHint = isOwner && reorderedImages.length > 1;
    
    const handleDragStart = (e: React.DragEvent, image: any, index: number) => {
      if (!isOwner) return
      setDraggedImage(image)
      setIsDragging(true)
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', index.toString())
    }
    
    const handleDragOver = (e: React.DragEvent, index: number) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setDragOverIndex(index)
    }
    
    const handleDragLeave = () => {
      setDragOverIndex(null)
    }
    
    const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault()
      if (draggedImage === null || !isOwner) return
      
      const dragIndex = parseInt(e.dataTransfer.getData('text/plain'))
      if (dragIndex === dropIndex) return
      
      const newImages = [...reorderedImages]
      const [draggedItem] = newImages.splice(dragIndex, 1)
      newImages.splice(dropIndex, 0, draggedItem)
      
      setReorderedImages(newImages)
      setDraggedImage(null)
      setDragOverIndex(null)
      setIsDragging(false)
      setIsReordering(true)
      
      // Persist the new order to the backend
      try {
        const imageIds = newImages.map(img => typeof img === 'string' ? img : img.id)
        await reorderImagesMutation.mutateAsync({ postId, imageIds })
        // Show success feedback (you could add a toast notification here)
        console.log('Image order updated successfully')
      } catch (error) {
        console.error('Failed to persist image order:', error)
        // Revert to original order on error
        setReorderedImages(images)
        // Show error feedback (you could add a toast notification here)
        alert('Failed to update image order. Please try again.')
      } finally {
        setIsReordering(false)
      }
    }
    
    const handleDragEnd = () => {
      setDraggedImage(null)
      setDragOverIndex(null)
      setIsDragging(false)
    }
    
    if (reorderedImages.length === 1) {
      const img = reorderedImages[0];
                    const imageUrl = typeof img === 'string' ? getImageUrl(img) : getImageUrlFromImage(img, false);
      return (
        <div className="mb-4 relative">
          {showReorderHint && (
            <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-full z-10">
              {isReordering ? 'Updating...' : 'Drag to reorder'}
            </div>
          )}
          <LazyImage
            src={imageUrl}
            alt={typeof img === 'string' ? 'Post image' : (img.caption || img.altText || 'Post image')}
            className="w-full rounded-lg object-contain cursor-pointer hover:opacity-90 transition-opacity"
            style={{
              height: 'auto',
              width: '100%',
              display: 'block'
            }}
            onClick={() => onImageClick(img)}
            draggable={isOwner}
            onDragStart={(e) => handleDragStart(e, img, 0)}
            onDragOver={(e) => handleDragOver(e, 0)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 0)}
            onDragEnd={handleDragEnd}
            showProgressiveEffect={true}
          />
        </div>
      );
    }
    
        if (reorderedImages.length === 2 || reorderedImages.length === 3) {
      return (
        <div className="mb-4 relative">
          {showReorderHint && (
            <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-full z-10">
              {isReordering ? 'Updating...' : 'Drag to reorder'}
            </div>
          )}
          <div className={`grid grid-cols-${reorderedImages.length} gap-2`}>
          {reorderedImages.map((img, idx) => {
              const imageUrl = typeof img === 'string' ? getImageUrl(img) : getImageUrlFromImage(img, false);
                              return (
                  <div
                    key={typeof img === 'string' ? idx : img.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, img, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, idx)}
                    onDragEnd={handleDragEnd}
                    className={`relative ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                  >
                    <LazyImage
                      src={imageUrl}
                      alt={typeof img === 'string' ? `Post image ${idx + 1}` : (img.caption || img.altText || `Post image ${idx + 1}`)}
                      className={`w-full rounded-lg object-contain max-h-72 transition-opacity ${
                        isDragging && draggedImage?.id === img.id ? 'opacity-50' : 'opacity-100'
                      } ${isDragging ? 'cursor-grabbing' : 'cursor-pointer hover:opacity-90'}`}
                      style={typeof img === 'string' ? undefined : { aspectRatio: img.width && img.height ? `${img.width} / ${img.height}` : undefined }}
                      onClick={() => onImageClick(img)}
                      showProgressiveEffect={true}
                    />
                    {/* Insertion marker */}
                    {dragOverIndex === idx && draggedImage?.id !== img.id && (
                      <div className="absolute inset-0 border-2 border-blue-500 bg-blue-100 bg-opacity-20 rounded-lg pointer-events-none" />
                    )}
                  </div>
                );
            })}
          </div>
        </div>
      );
    }
    
    // 4+ images: Layout based on main image aspect ratio
    const [main, ...thumbs] = reorderedImages;
    const mainImageUrl = typeof main === 'string' ? getImageUrl(main) : getImageUrlFromImage(main, false);
    
    // Calculate aspect ratio for main image
    const mainAspectRatio = typeof main === 'string' ? 1 : (main.width && main.height ? main.width / main.height : 1);
    const isPortrait = mainAspectRatio < 1;
    
    if (isPortrait) {
      // Portrait layout: Main image scaled to 80% width with true aspect ratio, thumbnails on the right
      return (
        <div className="mb-4 flex gap-2 relative">
          {showReorderHint && (
            <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-full z-10">
              {isReordering ? 'Updating...' : 'Drag to reorder'}
            </div>
          )}
          {/* Main image container - 80% width */}
          <div className="w-4/5 flex justify-center">
            <div
              draggable
              onDragStart={(e) => handleDragStart(e, main, 0)}
              onDragOver={(e) => handleDragOver(e, 0)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 0)}
              onDragEnd={handleDragEnd}
              className={`relative ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            >
              <LazyImage
                src={mainImageUrl}
                alt={typeof main === 'string' ? 'Main post image' : (main.caption || main.altText || 'Main post image')}
                className={`rounded-lg object-contain transition-opacity ${
                  isDragging && draggedImage?.id === main.id ? 'opacity-50' : 'opacity-100'
                } ${isDragging ? 'cursor-grabbing' : 'cursor-pointer hover:opacity-90'}`}
                style={{
                  width: '100%',
                  maxWidth: '100%',
                  height: 'auto',
                  aspectRatio: typeof main === 'string' ? undefined : (main.width && main.height ? `${main.width} / ${main.height}` : undefined)
                }}
                onClick={() => onImageClick(main)}
              />
              {/* Insertion marker */}
              {dragOverIndex === 0 && draggedImage?.id !== main.id && (
                <div className="absolute inset-0 border-2 border-blue-500 bg-blue-100 bg-opacity-20 rounded-lg pointer-events-none" />
              )}
            </div>
          </div>
          
          {/* Thumbnails - 17.5% of post width, vertical stack */}
          <div className="flex flex-col gap-2" style={{ width: '17.5%' }}>
            {thumbs.map((img, idx) => {
              const imageUrl = typeof img === 'string' ? getImageUrl(img) : getImageUrlFromImage(img, false);
              const actualIndex = idx + 1; // +1 because main image is at index 0
              return (
                <div
                  key={typeof img === 'string' ? idx : img.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, img, actualIndex)}
                  onDragOver={(e) => handleDragOver(e, actualIndex)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, actualIndex)}
                  onDragEnd={handleDragEnd}
                  className={`relative ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                >
                  <LazyImage
                    src={imageUrl}
                    alt={typeof img === 'string' ? `Thumbnail ${idx + 2}` : (img.caption || img.altText || `Thumbnail ${idx + 2}`)}
                    className={`rounded-lg object-cover transition-opacity ${
                      isDragging && draggedImage?.id === img.id ? 'opacity-50' : 'opacity-100'
                    } ${isDragging ? 'cursor-grabbing' : 'cursor-pointer hover:opacity-90'}`}
                    style={{
                      width: '100%',
                      aspectRatio: '1 / 1'
                    }}
                    onClick={() => onImageClick(img)}
                  />
                  {/* Insertion marker */}
                  {dragOverIndex === actualIndex && draggedImage?.id !== img.id && (
                    <div className="absolute inset-0 border-2 border-blue-500 bg-blue-100 bg-opacity-20 rounded-lg pointer-events-none" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    } else {
      // Landscape layout: Main image full width, thumbnails below at 25% height
      return (
        <div className="mb-4 relative">
          {showReorderHint && (
            <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-full z-10">
              {isReordering ? 'Updating...' : 'Drag to reorder'}
            </div>
          )}
          {/* Main image - full width */}
          <div
            draggable
            onDragStart={(e) => handleDragStart(e, main, 0)}
            onDragOver={(e) => handleDragOver(e, 0)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 0)}
            onDragEnd={handleDragEnd}
            className={`relative mb-2 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          >
            <LazyImage
              src={mainImageUrl}
              alt={typeof main === 'string' ? 'Main post image' : (main.caption || main.altText || 'Main post image')}
              className={`w-full rounded-lg object-contain transition-opacity ${
                isDragging && draggedImage?.id === main.id ? 'opacity-50' : 'opacity-100'
              } ${isDragging ? 'cursor-grabbing' : 'cursor-pointer hover:opacity-90'}`}
              style={typeof main === 'string' ? undefined : { aspectRatio: main.width && main.height ? `${main.width} / ${main.height}` : undefined }}
              onClick={() => onImageClick(main)}
            />
            {/* Insertion marker */}
            {dragOverIndex === 0 && draggedImage?.id !== main.id && (
              <div className="absolute inset-0 border-2 border-blue-500 bg-blue-100 bg-opacity-20 rounded-lg pointer-events-none" />
            )}
          </div>
          
          {/* Thumbnails - horizontal row at 17.5% of post width */}
          <div className="flex gap-2 overflow-x-auto">
            {thumbs.map((img, idx) => {
              const imageUrl = typeof img === 'string' ? getImageUrl(img) : getImageUrlFromImage(img, false);
              const actualIndex = idx + 1; // +1 because main image is at index 0
              return (
                <div
                  key={typeof img === 'string' ? idx : img.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, img, actualIndex)}
                  onDragOver={(e) => handleDragOver(e, actualIndex)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, actualIndex)}
                  onDragEnd={handleDragEnd}
                  className={`relative flex-shrink-0 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                  style={{ width: '17.5%' }}
                >
                  <LazyImage
                    src={imageUrl}
                    alt={typeof img === 'string' ? `Thumbnail ${idx + 2}` : (img.caption || img.altText || `Thumbnail ${idx + 2}`)}
                    className={`w-full rounded-lg object-cover border border-gray-200 transition-opacity ${
                      isDragging && draggedImage?.id === img.id ? 'opacity-50' : 'opacity-100'
                    } ${isDragging ? 'cursor-grabbing' : 'cursor-pointer hover:opacity-90'}`}
                    style={{
                      aspectRatio: '1 / 1'
                    }}
                    onClick={() => onImageClick(img)}
                  />
                  {/* Insertion marker */}
                  {dragOverIndex === actualIndex && draggedImage?.id !== img.id && (
                    <div className="absolute inset-0 border-2 border-blue-500 bg-blue-100 bg-opacity-20 rounded-lg pointer-events-none" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-32"></div>
              <div className="h-3 bg-gray-200 rounded w-24"></div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Create Post */}
      <PostAuthorForm 
        userId={userId} 
        onPostCreated={() => {
          // The posts feed will automatically refetch due to React Query invalidation
          // in the useCreatePost hook's onSuccess callback
        }}
      />

      {/* Posts Feed */}
      {posts.map((post: Post) => (
        <motion.div
          key={post.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-lg shadow-sm border overflow-hidden relative ${
            post.publicationStatus === 'PAUSED' 
              ? 'bg-gray-50 border-gray-300' 
              : 'bg-white border-gray-200'
          }`}
        >
          {/* Post Header */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-accent-500 rounded-full flex items-center justify-center text-white font-semibold">
                  {post.author.avatar ? (
                    <img src={post.author.avatar} alt={post.author.name} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    post.author.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <h3 
                    className={`font-medium text-gray-900 ${
                      post.author.id !== user?.id ? 'cursor-pointer hover:text-primary-600 hover:underline' : ''
                    }`}
                    onClick={() => handleAuthorClick(post.author.id, post.author.username)}
                  >
                    {post.author.name}
                  </h3>
                  <div className="flex items-center space-x-2">
                    <p className="text-sm text-gray-500 flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatDate(post.createdAt)}
                    </p>
                    {post.publicationStatus === 'PAUSED' && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Paused
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <PostMenu 
                post={post} 
                currentUserId={user?.id || ''} 
                onClose={() => {
                  // Refresh posts data when menu actions are completed
                  // This will be handled by the PostMenu internally
                }}
              />
            </div>
          </div>

          {/* Post Content */}
          <div className="p-4">
            <p className="text-gray-900 mb-4">{post.content}</p>
            
            {/* Post Images */}
            {post.images && post.images.length > 0 && (
              <PostImagesDisplay 
                images={post.images} 
                onImageClick={(image) => handleImageClick(image, post.id, post.images)}
                postId={post.id}
                isOwner={post.author.id === user?.id}
              />
            )}
          </div>

          {/* Post Actions */}
          <div className="px-4 py-3 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <button
                  onClick={() => handleReaction(post.id, 'LIKE')}
                  disabled={postReactionMutation.isPending}
                  className={`flex items-center space-x-2 text-gray-500 hover:text-red-500 transition-colors duration-200 ${
                    hasUserLiked(post) ? 'text-red-500' : ''
                  }`}
                >
                  <Heart className={`h-5 w-5 ${hasUserLiked(post) ? 'fill-current' : ''}`} />
                  <span>{post._count.reactions}</span>
                </button>
                
                <button
                  onClick={() => toggleComments(post.id)}
                  className="flex items-center space-x-2 text-gray-500 hover:text-blue-500 transition-colors duration-200"
                >
                  <MessageCircle className="h-5 w-5" />
                  <span>{post._count.comments}</span>
                </button>
                
                <button className="flex items-center space-x-2 text-gray-500 hover:text-green-500 transition-colors duration-200">
                  <Share className="h-5 w-5" />
                  <span>Share</span>
                </button>
              </div>
            </div>
          </div>

          {/* Comments Section */}
          {showComments[post.id] && (
            <div className="border-t border-gray-100 p-4 bg-gray-50">
              <div className="space-y-3">
                {post.comments?.map((comment) => (
                  <div key={comment.id} className="flex space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-accent-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                      {comment.author.avatar ? (
                        <img src={comment.author.avatar} alt={comment.author.name} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        comment.author.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="bg-white rounded-lg p-3">
                        <div className="flex items-center space-x-2 mb-1">
                          <span 
                            className={`font-medium text-sm text-gray-900 ${
                              comment.author.id !== user?.id ? 'cursor-pointer hover:text-primary-600 hover:underline' : ''
                            }`}
                            onClick={() => handleAuthorClick(comment.author.id, comment.author.username)}
                          >
                            {comment.author.name}
                          </span>
                          <span className="text-xs text-gray-500">{formatDate(comment.createdAt)}</span>
                        </div>
                        <p className="text-sm text-gray-700">{comment.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Add Comment */}
                <div className="flex space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-accent-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                    {authLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : user?.avatar ? (
                      <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
                    ) : user?.name ? (
                      user.name.charAt(0).toUpperCase()
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 flex space-x-2">
                    <input
                      type="text"
                      value={newComments[post.id] || ''}
                      onChange={(e) => setNewComments(prev => ({ ...prev, [post.id]: e.target.value }))}
                      placeholder="Write a comment..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <button
                      onClick={() => handleAddComment(post.id)}
                      disabled={!newComments[post.id]?.trim() || createCommentMutation.isPending}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {createCommentMutation.isPending ? '...' : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Paused Post Overlay */}
          {post.publicationStatus === 'PAUSED' && (
            <div className="absolute inset-0 bg-black bg-opacity-20 pointer-events-none rounded-lg" />
          )}
        </motion.div>
      ))}

      {posts.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <MessageCircle className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No posts yet</h3>
          <p className="text-gray-600">Be the first to share something with your family and friends!</p>
        </div>
      )}

      {/* Image Detail Modal */}
      {selectedImageForDetail && (
        <FullScreenWrapper>
        <ImageDetailModal
          image={selectedImageForDetail}
          onClose={() => {
            setIsImageDetailModalOpen(false)
            setSelectedImageForDetail(null)
            setCurrentPostId(null)
            setCurrentPostImages([])
          }}
          onImageUpdate={() => {
            // Refresh posts data when image is updated
            // This will be handled by the ImageDetailModal internally
          }}
          updateImage={() => {
            // This will be handled by the ImageDetailModal internally
          }}
          allImages={currentPostImages}
          onNavigate={(image: any) => setSelectedImageForDetail(image)}
        />
        </FullScreenWrapper>
      )}
    </div>
  )
} 