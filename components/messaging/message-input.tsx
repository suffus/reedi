'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useMessaging } from '@/lib/messaging-context';
import { MediaPicker } from '@/components/common/media-picker';
import { useAuth } from '@/lib/api-hooks';

export function MessageInput() {
  const { currentConversation, sendMessage, startTyping, stopTyping } = useMessaging();
  const { data: authData, isLoading: authLoading } = useAuth();
  const [message, setMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!message.trim() && selectedMedia.length === 0) || !currentConversation) return;

    // If we have multiple media items, send as a POST message
    if (selectedMedia.length > 1) {
      console.log('Sending multi-media message:', { message, media: selectedMedia });
      const mediaIds = selectedMedia.map(media => media.id);
      sendMessage(message, 'POST', undefined, mediaIds);
    } else if (selectedMedia.length === 1) {
      // Single media item
      const mediaItem = selectedMedia[0];
      let messageType = 'FILE';
      if (mediaItem.mimeType?.startsWith('image/')) {
        messageType = 'IMAGE';
      } else if (mediaItem.mimeType?.startsWith('video/')) {
        messageType = 'VIDEO';
      } else if (mediaItem.mimeType?.startsWith('audio/')) {
        messageType = 'AUDIO';
      }
      sendMessage(message, messageType, mediaItem.id);
    } else {
      // Text only
      sendMessage(message.trim());
    }

    setMessage('');
    setSelectedMedia([]);
    stopTyping();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    } else if (e.key === 'Enter' && e.shiftKey) {
      // Allow new line with Shift+Enter
      return;
    } else {
      startTyping();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !currentConversation) return;

    setIsUploading(true);
    
    try {
      const file = files[0];
      const formData = new FormData();
      formData.append('file', file);
      formData.append('visibility', 'PRIVATE');

      // Upload file using existing media upload endpoint
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8088/api'}/media/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload file');
      }

      const mediaData = await response.json();
      
      // Determine message type based on file type
      let messageType = 'FILE';
      if (file.type.startsWith('image/')) {
        messageType = 'IMAGE';
      } else if (file.type.startsWith('video/')) {
        messageType = 'VIDEO';
      } else if (file.type.startsWith('audio/')) {
        messageType = 'AUDIO';
      }

      // Send message with media
      sendMessage('', messageType, mediaData.id);
      
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleMediaSelect = (media: any[]) => {
    console.log('handleMediaSelect called with:', media);
    setSelectedMedia(media);
    setShowMediaPicker(false);
  };

  const removeMedia = (index: number) => {
    setSelectedMedia(prev => prev.filter((_, i) => i !== index));
  };

  const reorderMedia = (fromIndex: number, toIndex: number) => {
    setSelectedMedia(prev => {
      const newMedia = [...prev];
      const [removed] = newMedia.splice(fromIndex, 1);
      newMedia.splice(toIndex, 0, removed);
      return newMedia;
    });
  };

  // Debug logging
  console.log('MessageInput Debug:', {
    authLoading,
    authData: authData,
    authDataId: authData?.data?.user?.id,
    hasUserId: !!authData?.data?.user?.id,
    buttonDisabled: isUploading || authLoading || !authData?.data?.user?.id
  });

  if (!currentConversation) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>Select a conversation to start messaging</p>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-200 p-6 bg-white">
      {/* Media Preview */}
      {selectedMedia.length > 0 && (
        <div className="mb-6 p-4 bg-gray-50 rounded-none border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-gray-900">
              Selected Media ({selectedMedia.length})
            </h4>
            <button
              type="button"
              onClick={() => setSelectedMedia([])}
              className="text-sm font-medium text-red-600 hover:text-red-800 transition-colors duration-200"
            >
              Clear All
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {selectedMedia.map((media, index) => (
              <div key={media.id} className="relative group">
                <img
                  src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8088/api'}/media/serve/${media.id}/thumbnail`}
                  alt={media.originalFilename || 'Media'}
                  className="w-full h-24 object-cover rounded-none border border-gray-200"
                />
                <button
                  type="button"
                  onClick={() => removeMedia(index)}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                >
                  ×
                </button>
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => reorderMedia(index, index - 1)}
                    className="absolute -top-1 -left-1 bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-blue-600"
                  >
                    ↑
                  </button>
                )}
                {index < selectedMedia.length - 1 && (
                  <button
                    type="button"
                    onClick={() => reorderMedia(index, index + 1)}
                    className="absolute -bottom-1 -left-1 bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-blue-600"
                  >
                    ↓
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

              <form onSubmit={handleSubmit} className="flex items-end space-x-3">
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              onBlur={stopTyping}
              placeholder="Type a message..."
              className="w-full px-4 py-3 border border-gray-300 rounded-none resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-medium"
              rows={1}
              maxLength={1000}
            />
          </div>
        
        <div className="flex items-center space-x-2">
          {/* Media picker button */}
          <button
            type="button"
            onClick={() => {
              if (authData?.data?.user?.id) {
                setShowMediaPicker(true);
              } else {
                console.error('No user ID available for media picker');
                alert('Please wait for authentication to complete');
              }
            }}
            disabled={isUploading || authLoading || !authData?.data?.user?.id}
            className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title={authLoading ? "Loading..." : "Select from media library"}
          >
            {authLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </button>
          
          {/* File upload button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Upload new file"
          >
            {isUploading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            )}
          </button>
          
          {/* Send button */}
          <button
            type="submit"
            disabled={(!message.trim() && selectedMedia.length === 0) || isUploading}
            className="px-6 py-3 bg-primary-600 text-white rounded-none hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </form>
      
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileUpload}
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
        className="hidden"
      />
      
      {/* Character count */}
      {message.length > 0 && (
        <div className="text-xs text-gray-500 mt-1 text-right">
          {message.length}/1000
        </div>
      )}
      
      {/* Media Picker Modal */}
                      <MediaPicker
                  isOpen={showMediaPicker}
                  onClose={() => setShowMediaPicker(false)}
                  onMediaSelected={handleMediaSelect}
                  userId={authData?.data?.user?.id || ''}
                  mode="messaging"
                  title="Select Media to Send"
                  confirmText="Add Media"
                  maxSelection={10}
                  showUpload={false}
                  showGlobalSearch={false}
                  showFilters={true}
                />
      

    </div>
  );
} 