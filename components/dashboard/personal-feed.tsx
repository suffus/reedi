'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Heart, MessageCircle, Share, MoreHorizontal, User, Clock, Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { usePostsFeed, usePostReaction, useComments, useCreateComment, useAuth, useReorderPostMedia } from '../../lib/api-hooks'
import { MediaDetailModal } from './media-detail-modal'
import { PostMenu } from './post-menu'
import { FullScreenWrapper } from '../full-screen-wrapper'
import { PostAuthorForm } from './post-author-form'
import { getMediaUrl, getMediaUrlFromMedia } from '../../lib/api'
import { getBestThumbnailUrl } from '../../lib/media-utils'
import { LazyMedia } from '../lazy-media'

interface Post {
  id: string
  content: string
  publicationStatus: 'PUBLIC' | 'PAUSED' | 'CONTROLLED' | 'DELETED'
  visibility: 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE'
  authorId: string
  media: {
    id: string
    s3Key: string
    thumbnailS3Key?: string | null
    originalFilename?: string | null
    altText?: string | null
    caption?: string | null
    tags?: string[]
    visibility?: string
    createdAt?: string
    updatedAt?: string
    width?: number | null
    height?: number | null
    size?: number | null
    mimeType?: string | null
    authorId?: string
    mediaType: 'IMAGE' | 'VIDEO'
    processingStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'FAILED'
    duration?: number | null
    codec?: string | null
    bitrate?: number | null
    framerate?: number | null
    videoUrl?: string | null
    videoS3Key?: string | null
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

// Separate component for comment input to prevent post re-renders
function CommentInput({ 
  postId, 
  onAddComment, 
  isPending, 
  user, 
  authLoading 
}: { 
  postId: string
  onAddComment: (postId: string, content: string) => void
  isPending: boolean
  user: any
  authLoading: boolean
}) {
  const [commentText, setCommentText] = useState('')

  const handleSubmit = () => {
    const trimmedContent = commentText.trim()
    if (!trimmedContent) return
    
    onAddComment(postId, trimmedContent)
    setCommentText('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
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
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Write a comment..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <button
          onClick={handleSubmit}
          disabled={!commentText.trim() || isPending}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? '...' : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

export function PersonalFeed() {
  const router = useRouter()
  const [showComments, setShowComments] = useState<{ [postId: string]: boolean }>({})
  const [selectedMediaForDetail, setSelectedMediaForDetail] = useState<any>(null)
  const [isMediaDetailModalOpen, setIsMediaDetailModalOpen] = useState(false)
  const [currentPostMedia, setCurrentPostMedia] = useState<any[]>([])
  const [currentPostId, setCurrentPostId] = useState<string | null>(null)

  const { data: authData, isLoading: authLoading } = useAuth()
  const userId = authData?.data?.user?.id
  const user = authData?.data?.user

  const { data: postsData, isLoading, refetch: refetchPosts } = usePostsFeed()
  const postReactionMutation = usePostReaction()
  const createCommentMutation = useCreateComment()
  const reorderMediaMutation = useReorderPostMedia()

  const posts = postsData?.data?.posts || []

  const handleReaction = async (postId: string, type: string) => {
    try {
      await postReactionMutation.mutateAsync({ postId, type })
    } catch (error) {
      console.error('Failed to add reaction:', error)
    }
  }

  const handleAddComment = async (postId: string, content: string) => {
    try {
      await createCommentMutation.mutateAsync({
        content,
        postId
      })
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

  const handleMediaClick = async (media: any, postId?: string, postMedia?: any[]) => {
    try {
      // Fetch complete media data from backend
      const token = localStorage.getItem('token')
      if (!token) return
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8088/api'}/media/${media.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch media details')
      }
      
      const data = await response.json()
      if (data.success) {
        // Map the backend media data to the format expected by MediaDetailModal
        const mappedMedia = {
          id: data.data.media.id,
          s3Key: data.data.media.s3Key || data.data.media.url,
          thumbnailS3Key: data.data.media.thumbnailS3Key || data.data.media.thumbnail || data.data.media.url,
          url: data.data.media.s3Key || data.data.media.url, // Keep for backward compatibility
          thumbnail: data.data.media.thumbnailS3Key || data.data.media.thumbnail || data.data.media.url, // Keep for backward compatibility
          altText: data.data.media.altText,
          caption: data.data.media.caption,
          createdAt: data.data.media.createdAt,
          authorId: data.data.media.authorId,
          tags: data.data.media.tags || [],
          mediaType: data.data.media.mediaType || 'IMAGE',
          processingStatus: data.data.media.processingStatus || 'COMPLETED',
          width: data.data.media.width || null,
          height: data.data.media.height || null,
          size: data.data.media.size || null,
          mimeType: data.data.media.mimeType || null,
          visibility: data.data.media.visibility || 'PUBLIC',
          updatedAt: data.data.media.updatedAt
        }
        
        // Set post context for navigation
        if (postId && postMedia) {
          setCurrentPostId(postId)
          setCurrentPostMedia(postMedia.map(mediaItem => ({
            id: mediaItem.id,
            s3Key: mediaItem.s3Key || mediaItem.url,
            thumbnailS3Key: mediaItem.thumbnailS3Key || mediaItem.thumbnail || mediaItem.url,
            url: mediaItem.s3Key || mediaItem.url,
            thumbnail: mediaItem.thumbnailS3Key || mediaItem.thumbnail || mediaItem.url,
            altText: mediaItem.altText,
            caption: mediaItem.caption,
            createdAt: mediaItem.createdAt,
            authorId: mediaItem.authorId,
            tags: mediaItem.tags || [],
            mediaType: mediaItem.mediaType || 'IMAGE',
            processingStatus: mediaItem.processingStatus || 'COMPLETED',
            width: mediaItem.width || null,
            height: mediaItem.height || null,
            size: mediaItem.size || null,
            mimeType: mediaItem.mimeType || null,
            visibility: mediaItem.visibility || 'PUBLIC',
            updatedAt: mediaItem.updatedAt
          })))
        }
        
        setSelectedMediaForDetail(mappedMedia)
        setIsMediaDetailModalOpen(true)
      }
    } catch (error) {
      console.error('Failed to fetch media details:', error)
      // Fallback to using the post media data if fetch fails
      // Ensure the fallback media has the correct structure
      const fallbackMedia = {
        id: media.id,
        s3Key: media.s3Key || media.url,
        thumbnailS3Key: media.thumbnailS3Key || media.thumbnail || media.url,
        url: media.s3Key || media.url,
        thumbnail: media.thumbnailS3Key || media.thumbnail || media.url,
        altText: media.altText,
        caption: media.caption,
        createdAt: media.createdAt,
        authorId: media.authorId,
        tags: media.tags || [],
        mediaType: media.mediaType || 'IMAGE',
        processingStatus: media.processingStatus || 'COMPLETED',
        width: media.width || null,
        height: media.height || null,
        size: media.size || null,
        mimeType: media.mimeType || null,
        visibility: media.visibility || 'PUBLIC',
        updatedAt: media.updatedAt
      }
      
      // Set post context for navigation
      if (postId && postMedia) {
        setCurrentPostId(postId)
        setCurrentPostMedia(postMedia.map(mediaItem => ({
          id: mediaItem.id,
          s3Key: mediaItem.s3Key || mediaItem.url,
          thumbnailS3Key: mediaItem.thumbnailS3Key || mediaItem.thumbnail || mediaItem.url,
          url: mediaItem.s3Key || mediaItem.url,
          thumbnail: mediaItem.thumbnailS3Key || mediaItem.thumbnail || mediaItem.url,
          altText: mediaItem.altText,
          caption: mediaItem.caption,
          createdAt: mediaItem.createdAt,
          authorId: mediaItem.authorId,
          tags: mediaItem.tags || [],
          mediaType: mediaItem.mediaType || 'IMAGE',
          processingStatus: mediaItem.processingStatus || 'COMPLETED',
          width: mediaItem.width || null,
          height: mediaItem.height || null,
          size: mediaItem.size || null,
          mimeType: mediaItem.mimeType || null,
          visibility: mediaItem.visibility || 'PUBLIC',
          updatedAt: mediaItem.updatedAt
        })))
      }
      
      setSelectedMediaForDetail(fallbackMedia)
      setIsMediaDetailModalOpen(true)
    }
  }

  // Helper component for post media layout
  function PostMediaDisplay({ 
    media, 
    onMediaClick, 
    postId, 
    isOwner 
  }: { 
    media: Post["media"], 
    onMediaClick: (media: any) => void,
    postId: string,
    isOwner: boolean
  }) {
    const [draggedMedia, setDraggedMedia] = useState<any>(null)
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [isReordering, setIsReordering] = useState(false)
    const [reorderedMedia, setReorderedMedia] = useState<Post["media"]>(media)
    


    //console.log('reorderedMedia', reorderedMedia  )
    // Update reordered media when media prop changes
    useEffect(() => {
      setReorderedMedia(media)
    }, [media])
    
    if (!reorderedMedia || reorderedMedia.length === 0) return null;
    
    // Show reorder indicator for post owners
    const showReorderHint = isOwner && reorderedMedia.length > 1;
    
    const handleDragStart = (e: React.DragEvent, mediaItem: any, index: number) => {
      if (!isOwner) return
      setDraggedMedia(mediaItem)
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
      if (draggedMedia === null || !isOwner) return
      
      const dragIndex = parseInt(e.dataTransfer.getData('text/plain'))
      if (dragIndex === dropIndex) return
      
      const newMedia = [...reorderedMedia]
      const [draggedItem] = newMedia.splice(dragIndex, 1)
      newMedia.splice(dropIndex, 0, draggedItem)
      
      setReorderedMedia(newMedia)
      setDraggedMedia(null)
      setDragOverIndex(null)
      setIsDragging(false)
      setIsReordering(true)
      
      // Persist the new order to the backend
      try {
        const mediaIds = newMedia.map(mediaItem => typeof mediaItem === 'string' ? mediaItem : mediaItem.id)
        await reorderMediaMutation.mutateAsync({ postId, mediaIds })
        // Show success feedback (you could add a toast notification here)
        console.log('Media order updated successfully')
      } catch (error) {
        console.error('Failed to persist media order:', error)
        // Revert to original order on error
        setReorderedMedia(media)
        // Show error feedback (you could add a toast notification here)
        alert('Failed to update media order. Please try again.')
      } finally {
        setIsReordering(false)
      }
    }
    
      const handleDragEnd = () => {
    setDraggedMedia(null)
    setDragOverIndex(null)
    setIsDragging(false)
  }

  // Helper function to get the best media URL for display
  const getBestMediaUrl = (mediaItem: any, useThumbnail: boolean = false) => {
    if (typeof mediaItem === 'string') {
      return getMediaUrl(mediaItem)
    }
    
    if (useThumbnail) {
      // For thumbnails, try to use processed video thumbnails first
      const bestThumbnail = getBestThumbnailUrl(mediaItem)
      if (bestThumbnail) {
        return bestThumbnail
      }
      // Fall back to regular thumbnail endpoint
      return getMediaUrlFromMedia(mediaItem, true)
    }
    
    return getMediaUrlFromMedia(mediaItem, false)
  }

    
    if (reorderedMedia.length === 1) {
      const mediaItem = reorderedMedia[0];
      const isVideo = typeof mediaItem !== 'string' && mediaItem.mediaType === 'VIDEO';
      const mediaUrl = getBestMediaUrl(mediaItem, isVideo);
      return (
        <div className="mb-4 relative">
          {showReorderHint && (
            <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-full z-10">
              {isReordering ? 'Updating...' : 'Drag to reorder'}
            </div>
          )}
          <LazyMedia
            src={mediaUrl}
            alt={typeof mediaItem === 'string' ? 'Post media' : (mediaItem.caption || mediaItem.altText || 'Post media')}
            className="w-full rounded-lg object-contain cursor-pointer hover:opacity-90 transition-opacity"
            style={{
              height: 'auto',
              width: '100%',
              display: 'block'
            }}
            onClick={() => onMediaClick(mediaItem)}
            draggable={isOwner}
            onDragStart={(e) => handleDragStart(e, mediaItem, 0)}
            onDragOver={(e) => handleDragOver(e, 0)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 0)}
            onDragEnd={handleDragEnd}
            mediaType={typeof mediaItem === 'string' ? 'IMAGE' : mediaItem.mediaType || 'IMAGE'}
            showProgressiveEffect={true}
          />
        </div>
      );
    }
    
        if (reorderedMedia.length === 2 || reorderedMedia.length === 3) {
      return (
        <div className="mb-4 relative">
          {showReorderHint && (
            <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-full z-10">
              {isReordering ? 'Updating...' : 'Drag to reorder'}
            </div>
          )}
          <div className={`grid grid-cols-${reorderedMedia.length} gap-2`}>
          {reorderedMedia.map((mediaItem, idx) => {
              const isVideo = typeof mediaItem !== 'string' && mediaItem.mediaType === 'VIDEO';
              const mediaUrl = getBestMediaUrl(mediaItem, isVideo);
                              return (
                  <div
                    key={typeof mediaItem === 'string' ? idx : mediaItem.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, mediaItem, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, idx)}
                    onDragEnd={handleDragEnd}
                    className={`relative ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                  >
                    <LazyMedia
                      src={mediaUrl}
                      alt={typeof mediaItem === 'string' ? `Post media ${idx + 1}` : (mediaItem.caption || mediaItem.altText || `Post media ${idx + 1}`)}
                      className={`w-full rounded-lg object-contain max-h-72 transition-opacity ${
                        isDragging && draggedMedia?.id === mediaItem.id ? 'opacity-50' : 'opacity-100'
                      } ${isDragging ? 'cursor-grabbing' : 'cursor-pointer hover:opacity-90'}`}
                      style={typeof mediaItem === 'string' ? undefined : { aspectRatio: mediaItem.width && mediaItem.height ? `${mediaItem.width} / ${mediaItem.height}` : undefined }}
                      onClick={() => onMediaClick(mediaItem)}
                      mediaType={typeof mediaItem === 'string' ? 'IMAGE' : mediaItem.mediaType || 'IMAGE'}
                      showProgressiveEffect={true}
                    />
                    {/* Insertion marker */}
                    {dragOverIndex === idx && draggedMedia?.id !== mediaItem.id && (
                      <div className="absolute inset-0 border-2 border-blue-500 bg-blue-100 bg-opacity-20 rounded-lg pointer-events-none" />
                    )}
                  </div>
                );
            })}
          </div>
        </div>
      );
    }
    
    // 4+ media items: Layout based on main media aspect ratio
    const [main, ...thumbs] = reorderedMedia;
    const isMainVideo = typeof main !== 'string' && main.mediaType === 'VIDEO';
    const mainMediaUrl = getBestMediaUrl(main, isMainVideo);
    
    // Calculate aspect ratio for main media
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
              <LazyMedia
                src={mainMediaUrl}
                alt={typeof main === 'string' ? 'Main post media' : (main.caption || main.altText || 'Main post media')}
                className={`rounded-lg object-contain transition-opacity ${
                  isDragging && draggedMedia?.id === main.id ? 'opacity-50' : 'opacity-100'
                } ${isDragging ? 'cursor-grabbing' : 'cursor-pointer hover:opacity-90'}`}
                style={{
                  width: '100%',
                  maxWidth: '100%',
                  height: 'auto',
                  aspectRatio: typeof main === 'string' ? undefined : (main.width && main.height ? `${main.width} / ${main.height}` : undefined)
                }}
                onClick={() => onMediaClick(main)}
                mediaType={main.mediaType || 'IMAGE'}
              />
              {/* Insertion marker */}
              {dragOverIndex === 0 && draggedMedia?.id !== main.id && (
                <div className="absolute inset-0 border-2 border-blue-500 bg-blue-100 bg-opacity-20 rounded-lg pointer-events-none" />
              )}
            </div>
          </div>
          
          {/* Thumbnails - 17.5% of post width, vertical stack */}
          <div className="flex flex-col gap-2" style={{ width: '17.5%' }}>
            {thumbs.map((mediaItem, idx) => {
              const isVideo = typeof mediaItem !== 'string' && mediaItem.mediaType === 'VIDEO';
              const mediaUrl = getBestMediaUrl(mediaItem, isVideo);
              const actualIndex = idx + 1; // +1 because main media is at index 0
              return (
                <div
                  key={typeof mediaItem === 'string' ? idx : mediaItem.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, mediaItem, actualIndex)}
                  onDragOver={(e) => handleDragOver(e, actualIndex)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, actualIndex)}
                  onDragEnd={handleDragEnd}
                  className={`relative ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                >
                  <LazyMedia
                    src={mediaUrl}
                    alt={typeof mediaItem === 'string' ? `Thumbnail ${idx + 2}` : (mediaItem.caption || mediaItem.altText || `Thumbnail ${idx + 2}`)}
                    className={`rounded-lg object-cover transition-opacity ${
                      isDragging && draggedMedia?.id === mediaItem.id ? 'opacity-50' : 'opacity-100'
                    } ${isDragging ? 'cursor-grabbing' : 'cursor-pointer hover:opacity-90'}`}
                    style={{
                      width: '100%',
                      aspectRatio: '1 / 1'
                    }}
                    onClick={() => onMediaClick(mediaItem)}
                    mediaType={mediaItem.mediaType || 'IMAGE'}
                  />
                  {/* Insertion marker */}
                  {dragOverIndex === actualIndex && draggedMedia?.id !== mediaItem.id && (
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
            <LazyMedia
              src={mainMediaUrl}
              alt={typeof main === 'string' ? 'Main post media' : (main.caption || main.altText || 'Main post media')}
              className={`w-full rounded-lg object-contain transition-opacity ${
                isDragging && draggedMedia?.id === main.id ? 'opacity-50' : 'opacity-100'
              } ${isDragging ? 'cursor-grabbing' : 'cursor-pointer hover:opacity-90'}`}
              style={typeof main === 'string' ? undefined : { aspectRatio: main.width && main.height ? `${main.width} / ${main.height}` : undefined }}
              onClick={() => onMediaClick(main)}
              mediaType={main.mediaType || 'IMAGE'}
            />
            {/* Insertion marker */}
            {dragOverIndex === 0 && draggedMedia?.id !== main.id && (
              <div className="absolute inset-0 border-2 border-blue-500 bg-blue-100 bg-opacity-20 rounded-lg pointer-events-none" />
            )}
          </div>
          
          {/* Thumbnails - horizontal row at 17.5% of post width */}
          <div className="flex gap-2 overflow-x-auto">
            {thumbs.map((mediaItem, idx) => {
              const mediaUrl = typeof mediaItem === 'string' ? getMediaUrl(mediaItem) : getMediaUrlFromMedia(mediaItem, false);
              const actualIndex = idx + 1; // +1 because main media is at index 0
              return (
                <div
                  key={typeof mediaItem === 'string' ? idx : mediaItem.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, mediaItem, actualIndex)}
                  onDragOver={(e) => handleDragOver(e, actualIndex)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, actualIndex)}
                  onDragEnd={handleDragEnd}
                  className={`relative flex-shrink-0 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                  style={{ width: '17.5%' }}
                >
                  <LazyMedia
                    src={mediaUrl}
                    alt={typeof mediaItem === 'string' ? `Thumbnail ${idx + 2}` : (mediaItem.caption || mediaItem.altText || `Thumbnail ${idx + 2}`)}
                    className={`w-full rounded-lg object-cover border border-gray-200 transition-opacity ${
                      isDragging && draggedMedia?.id === mediaItem.id ? 'opacity-50' : 'opacity-100'
                    } ${isDragging ? 'cursor-grabbing' : 'cursor-pointer hover:opacity-90'}`}
                    style={{
                      aspectRatio: '1 / 1'
                    }}
                    onClick={() => onMediaClick(mediaItem)}
                    mediaType={mediaItem.mediaType || 'IMAGE'}
                  />
                  {/* Insertion marker */}
                  {dragOverIndex === actualIndex && draggedMedia?.id !== mediaItem.id && (
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
            
            {/* Post Media */}
            {post.media && post.media.length > 0 && (
              <PostMediaDisplay 
                media={post.media} 
                onMediaClick={(mediaItem) => handleMediaClick(mediaItem, post.id, post.media)}
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
                <CommentInput 
                  postId={post.id} 
                  onAddComment={handleAddComment} 
                  isPending={createCommentMutation.isPending} 
                  user={user} 
                  authLoading={authLoading} 
                />
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

      {/* Media Detail Modal */}
      {selectedMediaForDetail && (
        <FullScreenWrapper>
        <MediaDetailModal
          media={selectedMediaForDetail}
          onClose={() => {
            setIsMediaDetailModalOpen(false)
            setSelectedMediaForDetail(null)
            setCurrentPostId(null)
            setCurrentPostMedia([])
          }}
          onMediaUpdate={() => {
            // Refresh posts data when media is updated
            refetchPosts()
          }}
          updateMedia={(mediaId: string, updates: Partial<any>) => {
            // Update the media in the current post media array
            if (currentPostMedia && currentPostMedia.length > 0) {
              const updatedMedia = currentPostMedia.map(media => 
                media.id === mediaId 
                  ? { ...media, ...updates }
                  : media
              )
              setCurrentPostMedia(updatedMedia)
              
              // Also update the selected media if it's the same one
              if (selectedMediaForDetail && selectedMediaForDetail.id === mediaId) {
                setSelectedMediaForDetail({ ...selectedMediaForDetail, ...updates })
              }
            }
          }}
          allMedia={currentPostMedia}
          onNavigate={(media: any) => setSelectedMediaForDetail(media)}
        />
        </FullScreenWrapper>
      )}
    </div>
  )
} 