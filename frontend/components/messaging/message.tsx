'use client';

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MediaDisplay } from '../common/media-display';
import { useMediaDetail } from '../common/media-detail-context';
import { LazyMedia } from '../lazy-media';

interface MessageProps {
  message: {
    id: string;
    content: string;
    messageType: string;
    createdAt: string;
    sender: {
      id: string;
      name: string;
      username?: string;
      avatar?: string;
    };
    media?: {
      id: string;
      url: string;
      thumbnail?: string;
      mimeType?: string;
      originalFilename?: string;
    };
    mediaItems?: Array<{
      id: string;
      order: number;
      media: {
        id: string;
        url: string;
        thumbnail?: string;
        mimeType?: string;
        originalFilename?: string;
      };
    }>;
  };
  isOwnMessage: boolean;
  showAvatar: boolean;
}

export function Message({ message, isOwnMessage, showAvatar }: MessageProps) {
  const { openMediaDetail } = useMediaDetail()
  
  // Debug logging for media messages
  if (message.messageType !== 'TEXT' && message.media) {
    console.log('Message media debug:', {
      messageType: message.messageType,
      media: message.media,
      url: message.media.url,
      thumbnail: message.media.thumbnail
    });
  }

  const renderMessageContent = () => {
    switch (message.messageType) {
      case 'IMAGE':
        return (
          <div className="max-w-md">
            <img
              src={message.media?.url || message.media?.thumbnail}
              alt="Image message"
              className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => {
                if (message.media) {
                  // Open in shared media detail modal
                  openMediaDetail(message.media);
                }
              }}
            />
            {message.content && (
              <p className="text-sm text-gray-600 mt-2">{message.content}</p>
            )}
          </div>
        );
      
      case 'VIDEO':
        return (
          <div className="max-w-md">
            <div className="flex items-center justify-center">
              <LazyMedia
                src={message.media?.url || ''}
                alt={message.media?.originalFilename || 'Video message'}
                className="w-auto h-auto max-w-full rounded-lg object-contain cursor-pointer hover:opacity-90 transition-opacity"
                style={{
                  // Ensure video maintains aspect ratio and fits within container
                  maxWidth: '100%',
                  height: 'auto',
                  width: 'auto'
                }}
                onClick={() => {
                  if (message.media) {
                    // Open in shared media detail modal
                    openMediaDetail(message.media);
                  }
                }}
                mediaType="VIDEO"
                showPlayButton={true}
                showVideoControls={true}
                isMainMedia={true}
              />
            </div>
            {message.content && (
              <p className="text-sm text-gray-600 mt-2">{message.content}</p>
            )}
          </div>
        );
      
      case 'AUDIO':
        return (
          <div className="max-w-xs">
            <audio
              src={message.media?.url}
              controls
              className="w-full"
            />
            {message.content && (
              <p className="text-sm text-gray-600 mt-2">{message.content}</p>
            )}
          </div>
        );
      
      case 'POST':
        return (
          <div className="max-w-md">
            {message.content && (
              <p className="text-sm text-gray-600 mb-2">{message.content}</p>
            )}
            {message.mediaItems && message.mediaItems.length > 0 && (
              <MediaDisplay
                media={message.mediaItems.map(item => item.media)}
                maxWidth="max-w-md"
              />
            )}
          </div>
        );

      case 'FILE':
        return (
          <div className="max-w-md">
            <div className="flex items-center p-3 bg-gray-100 rounded-lg">
              <div className="flex-shrink-0 mr-3">
                <svg className="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {message.media?.originalFilename || 'File'}
                </p>
                <p className="text-xs text-gray-500">
                  {message.media?.mimeType || 'Unknown type'}
                </p>
              </div>
              <button
                onClick={() => {
                  if (message.media?.url) {
                    window.open(message.media.url, '_blank');
                  }
                }}
                className="ml-2 p-1 text-gray-500 hover:text-gray-700"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            {message.content && (
              <p className="text-sm text-gray-600 mt-2">{message.content}</p>
            )}
          </div>
        );
      
      default:
        return (
          <div className="max-w-md">
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          </div>
        );
    }
  };

  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} items-end max-w-xs lg:max-w-md xl:max-w-lg`}>
        {showAvatar && !isOwnMessage && (
          <div className="flex-shrink-0 mr-2 mb-1">
            <img
              src={message.sender.avatar || '/images/default-avatar.png'}
              alt={message.sender.name}
              className="w-8 h-8 rounded-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = '/images/default-avatar.png';
              }}
            />
          </div>
        )}
        
        <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}>
          {!isOwnMessage && showAvatar && (
            <p className="text-xs text-gray-500 mb-1">{message.sender.name}</p>
          )}
          
          <div
            className={`px-4 py-3 rounded-none ${
              isOwnMessage
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-900'
            }`}
          >
            {renderMessageContent()}
          </div>
          
          <p className={`text-xs text-gray-500 mt-1 ${
            isOwnMessage ? 'text-right' : 'text-left'
          }`}>
            {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
          </p>
        </div>
      </div>
    </div>
  );
} 