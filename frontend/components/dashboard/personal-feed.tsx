'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Heart, MessageCircle, Share, MoreHorizontal, User, Clock, Send, Lock, Unlock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useInfinitePostsFeed, usePostReaction, useComments, useCreateComment, useAuth, useReorderPostMedia } from '../../lib/api-hooks'
import { PostMenu } from './post-menu'
import { useMediaDetail } from '../common/media-detail-context'
import { PostMediaDisplay } from '@/components/common/post-media-display'
import { Post, Comment } from '@/lib/types'

import { PostAuthorForm } from './post-author-form'
import { getMediaUrl, getMediaUrlFromMedia, getVideoUrlWithQuality, fetchFreshMediaData } from '../../lib/api'
import { getBestThumbnailUrl, getSmartMediaUrl, getFirstThumbnail } from '../../lib/media-utils'
import { LazyMedia } from '../lazy-media'
import { InfiniteScrollContainer } from '../infinite-scroll-container'



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

  const { data: authData, isLoading: authLoading } = useAuth()
  const { openMediaDetail } = useMediaDetail()

  const userId = authData?.data?.user?.id
  const user = authData?.data?.user

  const { 
    data: infinitePostsData, 
    isLoading, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage,
    refetch: refetchPosts
  } = useInfinitePostsFeed()
  const postReactionMutation = usePostReaction()
  const createCommentMutation = useCreateComment()
  const reorderMediaMutation = useReorderPostMedia()

  // Flatten the pages of posts into a single array
  const posts = infinitePostsData?.pages.flatMap(page => page.data.posts) || []

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
    return post.reactions?.some(reaction => reaction.type === 'LIKE') || false
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

  const handleAuthorClick = (authorId: string, authorUsername: string | null | undefined) => {
    // Don't navigate if it's the current user's own post
    if (authorId === user?.id) return
    
    // Navigate to the user's public profile
    const identifier = authorUsername || authorId
    router.push(`/user/${identifier}`)
  }

  const handleUnlockPost = async (postId: string) => {
    try {
      const response = await fetch(`/api/posts/${postId}/unlock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to unlock post');
      }

      // Refresh the posts feed
      window.location.reload();
    } catch (error) {
      console.error('Error unlocking post:', error);
      alert('Failed to unlock post. Please try again.');
    }
  };

  const handleMediaClick = async (media: any, postId?: string, postMedia?: any[]) => {
    try {
      // Map the media data to the format expected by MediaDetailModal
      const mappedMedia = {
        id: media.id,
        s3Key: media.s3Key || media.url,
        url: media.s3Key || media.url, // Keep for backward compatibility
        thumbnail: getFirstThumbnail(media), // Use new helper function
        altText: media.altText,
        caption: media.caption,
        createdAt: media.createdAt,
        authorId: media.authorId,
        author: media.author || {
          id: media.authorId || '',
          name: 'Loading...',
          email: '',
          isPrivate: false,
          isVerified: false,
          createdAt: media.createdAt || new Date().toISOString(),
          updatedAt: media.updatedAt || new Date().toISOString()
        },
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
        

        

        
        // Open the unified media viewer with all post media
        if (postId && postMedia) {
          const mappedPostMedia = postMedia.map(mediaItem => ({
            id: mediaItem.id,
            url: mediaItem.s3Key || mediaItem.url,
            thumbnail: getFirstThumbnail(mediaItem),
            altText: mediaItem.altText,
            caption: mediaItem.caption,
            createdAt: mediaItem.createdAt,
            authorId: mediaItem.authorId,
            author: mediaItem.author || {
              id: mediaItem.authorId || '',
              name: 'Loading...',
              email: '',
              isPrivate: false,
              isVerified: false,
              createdAt: mediaItem.createdAt || new Date().toISOString(),
              updatedAt: mediaItem.updatedAt || new Date().toISOString()
            },
            tags: mediaItem.tags || [],
            mediaType: mediaItem.mediaType || 'IMAGE',
            processingStatus: mediaItem.processingStatus || 'COMPLETED',
            width: mediaItem.width || null,
            height: mediaItem.height || null,
            size: mediaItem.size || null,
            mimeType: mediaItem.mimeType || null,
            visibility: mediaItem.visibility || 'PUBLIC',
            updatedAt: mediaItem.updatedAt
          }))
          
          openMediaDetail(mappedMedia, mappedPostMedia)
        } else {
          openMediaDetail(mappedMedia)
        }
      } catch (error) {
      console.error('Failed to fetch media details:', error)
      // Fallback to using the post media data if fetch fails
      // Ensure the fallback media has the correct structure
      const fallbackMedia = {
        id: media.id,
        s3Key: media.s3Key || media.url,
        url: media.s3Key || media.url,
        thumbnail: getFirstThumbnail(media),
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
      

      

      
      // Open the unified media viewer with all post media
      if (postId && postMedia) {
        const mappedPostMedia = postMedia.map(mediaItem => ({
          id: mediaItem.id,
          url: mediaItem.s3Key || mediaItem.url,
          thumbnail: getFirstThumbnail(mediaItem),
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
        }))
        
        openMediaDetail(fallbackMedia, mappedPostMedia)
      } else {
        openMediaDetail(fallbackMedia)
      }
    }
  }

  // Helper component for post media layout
  

  // Component to display locked media
  function LockedMediaDisplay({ 
    media, 
    postId, 
    isOwner,
    isUnlocked,
    unlockPrice,
    onUnlock
  }: { 
    media: Post["media"], 
    postId: string,
    isOwner: boolean,
    isUnlocked: boolean,
    unlockPrice?: number,
    onUnlock: (postId: string) => void
  }) {
    const lockedMedia = (media || []).filter(m => m.isLocked);
    const unlockedMedia = (media || []).filter(m => !m.isLocked);

    return (
      <div className="space-y-4">
        {/* Show unlocked media normally */}
        {unlockedMedia.length > 0 && (
          <PostMediaDisplay 
            media={unlockedMedia} 
            onMediaClick={(mediaItem) => handleMediaClick(mediaItem, postId, media)}
            postId={postId}
            isOwner={isOwner}
          />
        )}

        {/* Show locked media as placeholder cards for non-owners who haven't unlocked */}
        {lockedMedia.length > 0 && !isUnlocked && !isOwner && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center space-x-2">
                <Lock className="h-5 w-5 text-gray-500" />
                <span className="text-sm text-gray-600">
                  {lockedMedia.length} locked media item{lockedMedia.length > 1 ? 's' : ''}
                </span>
              </div>
              {unlockPrice && (
                <button
                  onClick={() => onUnlock(postId)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Unlock for {unlockPrice} tokens
                </button>
              )}
            </div>
            
            {/* Locked media placeholders */}
            <div className="grid grid-cols-2 gap-2">
              {lockedMedia.map((mediaItem, index) => (
                <div key={mediaItem.id || `locked-${index}`} className="relative bg-gray-100 rounded-lg aspect-square flex items-center justify-center">
                  <div className="text-center">
                    <Lock className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">Locked Content</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Show locked media normally if unlocked OR if owner */}
        {lockedMedia.length > 0 && (isUnlocked || isOwner) && (
          <PostMediaDisplay 
            media={lockedMedia} 
            onMediaClick={(mediaItem) => handleMediaClick(mediaItem, postId, media)}
            postId={postId}
            isOwner={isOwner}
          />
        )}
      </div>
    );
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
        defaultFeedTarget={{
          id: userId || 'personal',
          name: 'Personal Feed',
          type: 'PERSONAL',
          isDefault: true
        }}
      />

      {/* Posts Feed with Infinite Scroll */}
      <InfiniteScrollContainer
        hasMore={!!hasNextPage}
        isLoading={isFetchingNextPage}
        onLoadMore={fetchNextPage}
        className="space-y-6"
      >
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
                    onClick={() => handleAuthorClick(post.author.id, post.author.username || null)}
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
                    {post.isLocked && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <Lock className="h-3 w-3 mr-1" />
                        Locked
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
              post.isLocked ? (
                <LockedMediaDisplay 
                  media={post.media} 
                  postId={post.id}
                  isOwner={post.author.id === user?.id}
                  isUnlocked={!!(post.isLocked)}
                  unlockPrice={post.unlockPrice}
                  onUnlock={handleUnlockPost}
                />
              ) : (
                <PostMediaDisplay 
                  media={post.media} 
                  onMediaClick={(mediaItem) => handleMediaClick(mediaItem, post.id, post.media)}
                  postId={post.id}
                  isOwner={post.author.id === user?.id}
                />
              )
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
                  <span>{post._count?.reactions || 0}</span>
                </button>
                
                <button
                  onClick={() => toggleComments(post.id)}
                  className="flex items-center space-x-2 text-gray-500 hover:text-blue-500 transition-colors duration-200"
                >
                  <MessageCircle className="h-5 w-5" />
                  <span>{post._count?.comments}</span>
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
                {post.comments?.map((comment : Comment) => (
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
      </InfiniteScrollContainer>


    </div>
  )
} 