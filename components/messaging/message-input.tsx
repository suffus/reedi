'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useMessaging } from '@/lib/messaging-context';
import { PostComposer } from '@/components/common/post-composer';
import { useAuth } from '@/lib/api-hooks';

export function MessageInput() {
  const { currentConversation, sendMessage, startTyping, stopTyping } = useMessaging();
  const { data: authData, isLoading: authLoading } = useAuth();
  const [message, setMessage] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !currentConversation) return;

    // Send text-only message
    sendMessage(message.trim());
    setMessage('');
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

  const handleComposerSubmit = async (content: string, mediaIds: string[]) => {
    if (!currentConversation) return;

    if (mediaIds.length > 1) {
      // Multiple media items - send as POST message
      sendMessage(content, 'POST', undefined, mediaIds);
    } else if (mediaIds.length === 1) {
      // Single media item - determine type and send
      // We'll need to fetch the media details to determine type
      // For now, send as POST with single media
      sendMessage(content, 'POST', undefined, mediaIds);
    } else {
      // Text only
      sendMessage(content);
    }
  };

  if (!currentConversation) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>Select a conversation to start messaging</p>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-200 p-6 bg-white">
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
          {/* Media composer button */}
          <button
            type="button"
            onClick={() => setShowComposer(true)}
            disabled={authLoading || !authData?.data?.user?.id}
            className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Create media message"
          >
            {authLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </button>
          
          {/* Send button */}
          <button
            type="submit"
            disabled={!message.trim()}
            className="px-6 py-3 bg-primary-600 text-white rounded-none hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </form>
      
      {/* Character count */}
      {message.length > 0 && (
        <div className="text-xs text-gray-500 mt-1 text-right">
          {message.length}/1000
        </div>
      )}
      
      {/* Post Composer Modal */}
      <PostComposer
        isOpen={showComposer}
        onClose={() => setShowComposer(false)}
        onSubmit={handleComposerSubmit}
        mode="message"
        title="Create Media Message"
        placeholder="Type your message..."
        maxLength={1000}
        maxMedia={10}
      />
    </div>
  );
} 