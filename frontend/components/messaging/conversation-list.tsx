'use client';

import React, { useState } from 'react';
import { useMessaging } from '@/lib/messaging-context';
import { formatDistanceToNow } from 'date-fns';
import { NewConversationModal } from './new-conversation-modal';

interface ConversationListProps {
  currentUserId?: string;
}

export function ConversationList({ currentUserId }: ConversationListProps) {
  const { 
    conversations, 
    currentConversation, 
    setCurrentConversation, 
    isLoading, 
    error,
    isConnected 
  } = useMessaging();
  
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-500 text-center">
        <p>Error: {error}</p>
        {!isConnected && (
          <p className="text-sm text-gray-500 mt-2">Not connected to messaging service</p>
        )}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="p-6 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-serif font-bold text-gray-900">Messages</h2>
            <button
              onClick={() => setShowNewConversationModal(true)}
              className="p-2 text-primary-600 hover:bg-primary-50 rounded-none transition-colors duration-200"
              title="New Conversation"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <div className="flex items-center mt-1">
            <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-500">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
        
        <div className="p-8 text-center text-gray-500">
          <p className="text-lg font-medium mb-2">No conversations yet</p>
          <p className="text-sm">Start a conversation with someone!</p>
        </div>
        
        <NewConversationModal
          isOpen={showNewConversationModal}
          onClose={() => setShowNewConversationModal(false)}
        />
      </div>
    );
  }

  const getConversationName = (conversation: any) => {
    if (conversation.type === 'GROUP') {
      return conversation.name || 'Group Chat';
    }
    
    // For direct conversations, show the other participant's name
    const otherParticipant = conversation.participants.find(
      (p: any) => p.user.id !== currentUserId
    );
    return otherParticipant?.user.name || 'Unknown User';
  };

  const getConversationAvatar = (conversation: any) => {
    if (conversation.type === 'GROUP') {
      return conversation.avatarUrl || '/images/default-group-avatar.png';
    }
    
    const otherParticipant = conversation.participants.find(
      (p: any) => p.user.id !== currentUserId
    );
    return otherParticipant?.user.avatar || '/images/default-avatar.png';
  };

  const getLastMessage = (conversation: any) => {
    if (!conversation.messages || conversation.messages.length === 0) {
      return 'No messages yet';
    }
    
    const lastMessage = conversation.messages[0];
    if (lastMessage.messageType === 'IMAGE') {
      return '📷 Image';
    } else if (lastMessage.messageType === 'VIDEO') {
      return '🎥 Video';
    } else if (lastMessage.messageType === 'AUDIO') {
      return '🎵 Audio';
    } else if (lastMessage.messageType === 'FILE') {
      return '📎 File';
    }
    
    return lastMessage.content || 'No content';
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-serif font-bold text-gray-900">Messages</h2>
          <button
            onClick={() => setShowNewConversationModal(true)}
            className="p-2 text-primary-600 hover:bg-primary-50 rounded-none transition-colors duration-200"
            title="New Conversation"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        <div className="flex items-center mt-2">
          <div className={`w-2 h-2 rounded-none mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm font-medium text-gray-600">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
      
      <div className="divide-y divide-gray-100">
        {conversations.map((conversation) => (
          <div
            key={conversation.id}
            onClick={() => setCurrentConversation(conversation)}
            className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors duration-200 ${
              currentConversation?.id === conversation.id ? 'bg-primary-50 border-r-2 border-primary-500' : ''
            }`}
          >
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <img
                  className="h-12 w-12 rounded-full object-cover"
                  src={getConversationAvatar(conversation)}
                  alt={getConversationName(conversation)}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/images/default-avatar.png';
                  }}
                />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-900 truncate">
                    {getConversationName(conversation)}
                  </h3>
                  {conversation.lastMessageAt && (
                    <span className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: true })}
                    </span>
                  )}
                </div>
                
                <p className="text-sm text-gray-500 truncate mt-1">
                  {getLastMessage(conversation)}
                </p>
                
                {conversation.type === 'GROUP' && (
                  <p className="text-xs text-gray-400 mt-1">
                    {conversation.participants.length} members
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <NewConversationModal
        isOpen={showNewConversationModal}
        onClose={() => setShowNewConversationModal(false)}
      />
    </div>
  );
} 