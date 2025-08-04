'use client';

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMessaging } from '@/lib/messaging-context';
import { useAuth } from '@/lib/api-hooks';
import { ConversationList } from './conversation-list';
import { Message } from './message';
import { MessageInput } from './message-input';
import { Grid } from 'lucide-react';

export function MessagingApp() {
  const router = useRouter();
  const { data: authData } = useAuth();
  const { 
    currentConversation, 
    messages, 
    isLoading, 
    error,
    markMessageAsRead
  } = useMessaging();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark messages as read when user scrolls to bottom
  useEffect(() => {
    if (currentConversation && messages.length > 0) {
      const messagesContainer = document.querySelector('.messages-container');
      if (messagesContainer) {
        const isAtBottom = messagesContainer.scrollTop + messagesContainer.clientHeight >= messagesContainer.scrollHeight - 10;
        
        if (isAtBottom) {
          const currentUserId = authData?.data?.user?.id;
          const unreadMessages = messages.filter(
            message => message.senderId !== currentUserId
          );
          
          // Mark messages as read when user scrolls to bottom
          unreadMessages.forEach(message => {
            markMessageAsRead(message.id);
          });
        }
      }
    }
  }, [currentConversation, messages, markMessageAsRead, authData?.data?.user?.id]);

  const getConversationName = (conversation: any) => {
    if (conversation.type === 'GROUP') {
      return conversation.name || 'Group Chat';
    }
    
    // For direct conversations, show the other participant's name
    const currentUserId = authData?.data?.user?.id;
    const otherParticipant = conversation.participants.find(
      (p: any) => p.user.id !== currentUserId
    );
    return otherParticipant?.user.name || 'Unknown User';
  };

  const getConversationAvatar = (conversation: any) => {
    if (conversation.type === 'GROUP') {
      return conversation.avatarUrl || '/images/default-group-avatar.png';
    }
    
    const currentUserId = authData?.data?.user?.id;
    const otherParticipant = conversation.participants.find(
      (p: any) => p.user.id !== currentUserId
    );
    return otherParticipant?.user.avatar || '/images/default-avatar.png';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left side - Logo */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-accent-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">R</span>
              </div>
              <span className="text-xl font-serif font-bold gradient-text">Reedi Messages</span>
            </div>
            
            {/* Right side - Navigation and User Info */}
            <div className="flex items-center space-x-3">
              {/* Dashboard Icon */}
              <button
                onClick={() => router.push('/dashboard')}
                className="p-2 rounded-none hover:bg-gray-100 transition-colors duration-200"
                title="Go to Dashboard"
              >
                <Grid className="h-6 w-6 text-gray-600" />
              </button>
              
              {/* User Avatar and Name */}
              <div className="flex items-center space-x-3">
                <img
                  src={authData?.data?.user?.avatar || '/images/default-avatar.png'}
                  alt={authData?.data?.user?.name || 'User'}
                  className="w-8 h-8 rounded-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/images/default-avatar.png';
                  }}
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">{authData?.data?.user?.name || 'User'}</p>
                  <p className="text-xs text-gray-500">@{authData?.data?.user?.username || 'username'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex h-[calc(100vh-12rem)] bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
          {/* Conversation List */}
          <div className="w-80 border-r border-gray-200 flex flex-col bg-gray-50">
            <ConversationList currentUserId={authData?.data?.user?.id} />
          </div>
          
          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col bg-white">
        {currentConversation ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center p-6 border-b border-gray-200 bg-white">
              <div className="flex items-center">
                <img
                  src={getConversationAvatar(currentConversation)}
                  alt={getConversationName(currentConversation)}
                  className="w-12 h-12 rounded-none object-cover mr-4"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/images/default-avatar.png';
                  }}
                />
                <div>
                  <h2 className="text-xl font-serif font-bold text-gray-900">
                    {getConversationName(currentConversation)}
                  </h2>
                  {currentConversation.type === 'GROUP' && (
                    <p className="text-sm font-medium text-gray-600">
                      {currentConversation.participants.length} members
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 messages-container">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : error ? (
                <div className="text-center text-red-500">
                  <p>Error: {error}</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-gray-500 mt-8">
                  <p>No messages yet</p>
                  <p className="text-sm mt-1">Start the conversation!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message, index) => {
                    const currentUserId = authData?.data?.user?.id;
                    const isOwnMessage = message.senderId === currentUserId;
                    const showAvatar = index === 0 || 
                      messages[index - 1]?.senderId !== message.senderId ||
                      new Date(message.createdAt).getTime() - new Date(messages[index - 1]?.createdAt).getTime() > 5 * 60 * 1000; // 5 minutes
                    
                    return (
                      <Message
                        key={message.id}
                        message={message}
                        isOwnMessage={isOwnMessage}
                        showAvatar={showAvatar}
                      />
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
            
            {/* Message Input */}
            <MessageInput />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <h3 className="text-lg font-medium mb-2">Welcome to Messages</h3>
              <p className="text-sm">Select a conversation to start messaging</p>
            </div>
          </div>
        )}
          </div>
        </div>
      </div>
    </div>
  );
} 