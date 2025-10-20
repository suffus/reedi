import { useState, useEffect } from 'react'

import { Post, Media } from '@/lib/types'
import { getMediaUrl, getMediaUrlFromMedia, getVideoUrlWithQuality } from '@/lib/api'
import { getBestThumbnailUrl, getSmartMediaUrl } from '@/lib/media-utils'
import { Lock } from 'lucide-react'
import { LazyMedia } from '@/components/lazy-media'
import { useReorderPostMedia } from '@/lib/api-hooks'
import { usePostsFeed } from '@/lib/api-hooks'

interface PostMediaDisplayProps {
  media: Post["media"] // Media[] - flattened array from API
  onMediaClick: (media: any, allMedia?: Media[]) => void // allMedia is the same Media[] array
  postId?: string
  isOwner?: boolean
  showReorderControls?: boolean
  isPublicView?: boolean
}

export function PostMediaDisplay({ 
  media, 
  onMediaClick, 
  postId,
  isOwner = false,
  showReorderControls = false,
  isPublicView = false
}: PostMediaDisplayProps) {
  const [draggedMedia, setDraggedMedia] = useState<any>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isReordering, setIsReordering] = useState(false)
  const [reorderedMedia, setReorderedMedia] = useState<Post["media"]>(media)
  const reorderMediaMutation = useReorderPostMedia()
  const { data: postsData, isLoading, refetch: refetchPosts } = usePostsFeed()
  const posts = postsData?.data?.posts || []

  // Update reordered media when media prop changes
  useEffect(() => {
    setReorderedMedia(media)
  }, [media])
  
  if (!reorderedMedia || reorderedMedia.length === 0) return null;
  
  // Show reorder indicator for post owners (only when showReorderControls is true)
  const showReorderHint = showReorderControls && isOwner && reorderedMedia.length > 1;
  
  const handleDragStart = (e: React.DragEvent, mediaItem: any, index: number) => {
    if (!isOwner || !showReorderControls) return
    setDraggedMedia(mediaItem)
    setIsDragging(true)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index.toString())
  }
  
  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (!showReorderControls) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }
  
  const handleDragLeave = () => {
    setDragOverIndex(null)
  }
  
  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (draggedMedia === null || !isOwner || !showReorderControls || !postId) return
    
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
      const mediaIds = newMedia.map(mediaItem => typeof mediaItem === 'string' ? mediaItem : mediaItem.id).filter((id): id is string => id !== undefined)
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
    
    // For locked media without ID, return empty string to show placeholder
    if (mediaItem.isLocked && !mediaItem.id) {
      return ''
    }
    
    // For videos, always use thumbnail for display (not the video file itself)
    const isVideo = mediaItem.mediaType === 'VIDEO' || mediaItem.mimeType?.startsWith('video/')
    if (isVideo || useThumbnail) {
      // For thumbnails and videos, use the smart thumbnail URL
      return getSmartMediaUrl(mediaItem, 'thumbnail')
    }
    
    // For main images, use 1080p quality
    return getSmartMediaUrl(mediaItem, 'main')
  }

  const getVideoUrl = (mediaItem: any) => {
    if (typeof mediaItem === 'string') {
      return null
    }
    
    // Return the video URL for video playback
    return mediaItem.videoUrl || getMediaUrlFromMedia(mediaItem, false)
  }

  // State to store video URLs with quality
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({})

  // Effect to load video URLs with preferred quality
  useEffect(() => {
    const loadVideoUrls = async () => {
      const newVideoUrls: Record<string, string> = {}
      
      for (const post of posts) {
        for (const mediaItem of post.media) {
          // Skip locked media without IDs
          if (mediaItem.mediaType === 'VIDEO' && mediaItem.id && !videoUrls[mediaItem.id] && !mediaItem.isLocked) {
            try {
              const qualityUrl = await getVideoUrlWithQuality(mediaItem.id, '540p')
              newVideoUrls[mediaItem.id] = qualityUrl
            } catch (error) {
              console.error('Error getting video quality URL:', error)
              // Fallback to regular URL
              newVideoUrls[mediaItem.id] = mediaItem.videoUrl || getMediaUrlFromMedia(mediaItem, false)
            }
          }
        }
      }
      
      if (Object.keys(newVideoUrls).length > 0) {
        setVideoUrls(prev => ({ ...prev, ...newVideoUrls }))
      }
    }

    loadVideoUrls()
  }, [posts])

  const getCachedVideoUrl = (mediaItem: any) => {
    if (typeof mediaItem === 'string') {
      return null
    }
    
    // Return cached quality URL if available, otherwise fallback
    return videoUrls[mediaItem.id] || mediaItem.videoUrl || getMediaUrlFromMedia(mediaItem, false)
  }

  // Single media item
  if (reorderedMedia.length === 1) {
    const mediaItem = reorderedMedia[0];
    const isVideo = typeof mediaItem !== 'string' && mediaItem.mediaType === 'VIDEO';
    const mediaUrl = getBestMediaUrl(mediaItem, false);
    const videoUrl = getCachedVideoUrl(mediaItem);
    
    return (
      <div className="mb-4 relative">
        {showReorderHint && (
          <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-full z-10">
            {isReordering ? 'Updating...' : 'Drag to reorder'}
          </div>
        )}
        {mediaUrl ? (
          <LazyMedia
            src={mediaUrl}
            alt={typeof mediaItem === 'string' ? 'Post media' : (mediaItem.caption || mediaItem.altText || 'Post media')}
            className="w-full h-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
            style={{
              width: '100%',
              height: 'auto',
              display: 'block'
            }}
            onClick={() => onMediaClick(mediaItem, reorderedMedia)}
            draggable={isOwner && showReorderControls}
            onDragStart={(e) => handleDragStart(e, mediaItem, 0)}
            onDragOver={(e) => handleDragOver(e, 0)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 0)}
            onDragEnd={handleDragEnd}
            mediaType={typeof mediaItem === 'string' ? 'IMAGE' : mediaItem.mediaType || 'IMAGE'}
            showProgressiveEffect={true}
            isMainMedia={true}
            videoUrl={videoUrl}
            showVideoControls={isVideo}
            showPlayButton={isVideo}
          />
        ) : (
          // Locked media placeholder
          <div className="w-full bg-gray-100 rounded-lg aspect-video flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors">
            <div className="text-center">
              <Lock className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Locked Content</p>
            </div>
          </div>
        )}
      </div>
    );
  }
  
  // 2-3 media items
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
            const mediaUrl = getBestMediaUrl(mediaItem, false);
            const videoUrl = getCachedVideoUrl(mediaItem);
            
            return (
              <div
                key={typeof mediaItem === 'string' ? idx : mediaItem.id}
                draggable={isOwner && showReorderControls}
                onDragStart={(e) => handleDragStart(e, mediaItem, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                className={`relative ${isDragging && showReorderControls ? 'cursor-grabbing' : 'cursor-grab'}`}
              >
                {mediaUrl ? (
                  <LazyMedia
                    src={mediaUrl}
                    alt={typeof mediaItem === 'string' ? `Post media ${idx + 1}` : (mediaItem.caption || mediaItem.altText || `Post media ${idx + 1}`)}
                    className={`w-full h-auto rounded-lg max-h-72 transition-opacity ${
                      isDragging && draggedMedia?.id === mediaItem.id ? 'opacity-50' : 'opacity-100'
                    } ${isDragging && showReorderControls ? 'cursor-grabbing' : 'cursor-pointer hover:opacity-90'}`}
                    style={{ width: '100%', height: 'auto' }}
                    onClick={() => onMediaClick(mediaItem, reorderedMedia)}
                    mediaType={typeof mediaItem === 'string' ? 'IMAGE' : mediaItem.mediaType || 'IMAGE'}
                    showProgressiveEffect={true}
                    isMainMedia={idx === 0} // First item is main media
                    videoUrl={videoUrl}
                    showVideoControls={isVideo && idx === 0} // Only show controls for main video
                    showPlayButton={isVideo}
                  />
                ) : (
                  // Locked media placeholder
                  <div className="w-full bg-gray-100 rounded-lg aspect-square flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors">
                    <div className="text-center">
                      <Lock className="h-8 w-8 text-gray-400 mx-auto mb-1" />
                      <p className="text-xs text-gray-500">Locked</p>
                    </div>
                  </div>
                )}
                {/* Insertion marker */}
                {dragOverIndex === idx && draggedMedia?.id !== mediaItem.id && showReorderControls && (
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
  const mainMediaUrl = getBestMediaUrl(main, false);
  const mainVideoUrl = getCachedVideoUrl(main);
  
  // Calculate aspect ratio for main media
  const mainAspectRatio = typeof main === 'string' ? 1 : (
    main.width && main.height && main.width > 0 && main.height > 0
      ? main.width / main.height 
      : 0.75 // Default to portrait aspect ratio when dimensions are unknown
  );
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
        <div className="w-4/5">
          <div
            draggable={isOwner && showReorderControls}
            onDragStart={(e) => handleDragStart(e, main, 0)}
            onDragOver={(e) => handleDragOver(e, 0)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 0)}
            onDragEnd={handleDragEnd}
            className={`relative w-full ${isDragging && showReorderControls ? 'cursor-grabbing' : 'cursor-grab'}`}
          >
            {mainMediaUrl ? (
              <LazyMedia
                src={mainMediaUrl}
                alt={typeof main === 'string' ? 'Main post media' : (main.caption || main.altText || 'Main post media')}
                className={`w-full h-auto rounded-lg transition-opacity ${
                  isDragging && draggedMedia?.id === main.id ? 'opacity-50' : 'opacity-100'
                } ${isDragging && showReorderControls ? 'cursor-grabbing' : 'cursor-pointer hover:opacity-90'}`}
                style={{
                  width: '100%',
                  height: 'auto'
                }}
                onClick={() => onMediaClick(main, reorderedMedia)}
                mediaType={typeof main === 'string' ? 'IMAGE' : main.mediaType || 'IMAGE'}
                isMainMedia={true}
                videoUrl={mainVideoUrl}
                showVideoControls={isMainVideo}
                showPlayButton={isMainVideo}
              />
            ) : (
              // Locked media placeholder
              <div className="w-full bg-gray-100 rounded-lg aspect-video flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors">
                <div className="text-center">
                  <Lock className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Locked Content</p>
                </div>
              </div>
            )}
            {/* Insertion marker */}
            {dragOverIndex === 0 && draggedMedia?.id !== main.id && showReorderControls && (
              <div className="absolute inset-0 border-2 border-blue-500 bg-blue-100 bg-opacity-20 rounded-lg pointer-events-none" />
            )}
          </div>
        </div>
        
        {/* Thumbnails - 17.5% of post width, vertical stack */}
        <div className="flex flex-col gap-2" style={{ width: '17.5%' }}>
          {thumbs.map((mediaItem, idx) => {
            const isVideo = typeof mediaItem !== 'string' && mediaItem.mediaType === 'VIDEO';
            const mediaUrl = getSmartMediaUrl(mediaItem, 'thumbnail');
            const videoUrl = getCachedVideoUrl(mediaItem);
            const actualIndex = idx + 1; // +1 because main media is at index 0
            return (
              <div
                key={typeof mediaItem === 'string' ? idx : mediaItem.id}
                draggable={isOwner && showReorderControls}
                onDragStart={(e) => handleDragStart(e, mediaItem, actualIndex)}
                onDragOver={(e) => handleDragOver(e, actualIndex)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, actualIndex)}
                onDragEnd={handleDragEnd}
                className={`relative flex-shrink-0 ${isDragging && showReorderControls ? 'cursor-grabbing' : 'cursor-grab'}`}
              >
                {mediaUrl ? (
                  <LazyMedia
                    src={mediaUrl}
                    alt={typeof mediaItem === 'string' ? `Thumbnail ${idx + 2}` : (mediaItem.caption || mediaItem.altText || `Thumbnail ${idx + 2}`)}
                    className={`rounded-lg object-cover transition-opacity ${
                      isDragging && draggedMedia?.id === mediaItem.id ? 'opacity-50' : 'opacity-100'
                    } ${isDragging && showReorderControls ? 'cursor-grabbing' : 'cursor-pointer hover:opacity-90'}`}
                    style={{
                      width: '100%',
                      aspectRatio: '1 / 1'
                    }}
                    onClick={() => onMediaClick(mediaItem, reorderedMedia)}
                    mediaType={typeof mediaItem === 'string' ? 'IMAGE' : (mediaItem as any).mediaType || 'IMAGE'}
                    videoUrl={videoUrl}
                    showPlayButton={true}
                  />
                ) : (
                  // Locked media placeholder
                  <div className="w-full bg-gray-100 rounded-lg aspect-square flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors border border-gray-200">
                    <div className="text-center">
                      <Lock className="h-6 w-6 text-gray-400 mx-auto mb-1" />
                      <p className="text-xs text-gray-500">Locked</p>
                    </div>
                  </div>
                )}
                {/* Insertion marker */}
                {dragOverIndex === actualIndex && draggedMedia?.id !== mediaItem.id && showReorderControls && (
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
          draggable={isOwner && showReorderControls}
          onDragStart={(e) => handleDragStart(e, main, 0)}
          onDragOver={(e) => handleDragOver(e, 0)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 0)}
          onDragEnd={handleDragEnd}
          className={`relative mb-2 ${isDragging && showReorderControls ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          {mainMediaUrl ? (
            <LazyMedia
              src={mainMediaUrl}
              alt={typeof main === 'string' ? 'Main post media' : (main.caption || main.altText || 'Main post media')}
              className={`w-full h-auto rounded-lg transition-opacity ${
                isDragging && draggedMedia?.id === main.id ? 'opacity-50' : 'opacity-100'
              } ${isDragging && showReorderControls ? 'cursor-grabbing' : 'cursor-pointer hover:opacity-90'}`}
              style={{ width: '100%', height: 'auto' }}
              onClick={() => onMediaClick(main, reorderedMedia)}
              mediaType={typeof main === 'string' ? 'IMAGE' : main.mediaType || 'IMAGE'}
              isMainMedia={true}
              videoUrl={mainVideoUrl}
              showVideoControls={isMainVideo}
              showPlayButton={isMainVideo}
            />
          ) : (
            // Locked media placeholder
            <div className="w-full bg-gray-100 rounded-lg aspect-video flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors">
              <div className="text-center">
                <Lock className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Locked Content</p>
              </div>
            </div>
          )}
          {/* Insertion marker */}
          {dragOverIndex === 0 && draggedMedia?.id !== main.id && showReorderControls && (
            <div className="absolute inset-0 border-2 border-blue-500 bg-blue-100 bg-opacity-20 rounded-lg pointer-events-none" />
          )}
        </div>
        
        {/* Thumbnails - horizontal row at 17.5% of post width */}
        <div className="flex gap-2 overflow-x-auto">
          {thumbs.map((mediaItem, idx) => {
            const isVideo = typeof mediaItem !== 'string' && mediaItem.mediaType === 'VIDEO';
            const mediaUrl = getSmartMediaUrl(mediaItem, 'thumbnail');
            const videoUrl = getCachedVideoUrl(mediaItem);
            const actualIndex = idx + 1; // +1 because main media is at index 0
            return (
              <div
                key={typeof mediaItem === 'string' ? idx : mediaItem.id}
                draggable={isOwner && showReorderControls}
                onDragStart={(e) => handleDragStart(e, mediaItem, actualIndex)}
                onDragOver={(e) => handleDragOver(e, actualIndex)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, actualIndex)}
                onDragEnd={handleDragEnd}
                className={`relative flex-shrink-0 ${isDragging && showReorderControls ? 'cursor-grabbing' : 'cursor-grab'}`}
                style={{ width: '17.5%' }}
              >
                {mediaUrl ? (
                  <LazyMedia
                    src={mediaUrl}
                    alt={typeof mediaItem === 'string' ? `Thumbnail ${idx + 2}` : (mediaItem.caption || mediaItem.altText || `Thumbnail ${idx + 2}`)}
                    className={`w-full rounded-lg object-cover border border-gray-200 transition-opacity ${
                      isDragging && draggedMedia?.id === mediaItem.id ? 'opacity-50' : 'opacity-100'
                    } ${isDragging && showReorderControls ? 'cursor-grabbing' : 'cursor-pointer hover:opacity-90'}`}
                    style={{
                      aspectRatio: '1 / 1'
                    }}
                    onClick={() => onMediaClick(mediaItem, reorderedMedia)}
                    mediaType={typeof mediaItem === 'string' ? 'IMAGE' : mediaItem.mediaType || 'IMAGE'}
                    videoUrl={videoUrl}
                    showPlayButton={isVideo}
                  />                  
                ) : (
                  // Locked media placeholder
                  <div className="w-full bg-gray-100 rounded-lg aspect-square flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors border border-gray-200">
                    <div className="text-center">
                      <Lock className="h-6 w-6 text-gray-400 mx-auto mb-1" />
                      <p className="text-xs text-gray-500">Locked</p>
                    </div>
                  </div>
                )}
                {/* Insertion marker */}
                {dragOverIndex === actualIndex && draggedMedia?.id !== mediaItem.id && showReorderControls && (
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