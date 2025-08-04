'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './api-hooks';

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  messageType: string;
  media?: {
    id: string;
    url: string;
    thumbnail?: string;
    mimeType?: string;
    originalFilename?: string;
  };
  createdAt: string;
  sender: {
    id: string;
    name: string;
    username?: string;
    avatar?: string;
  };
}

interface Conversation {
  id: string;
  type: 'DIRECT' | 'GROUP';
  name?: string;
  avatarUrl?: string;
  lastMessageAt?: string;
  participants: Array<{
    id: string;
    role: 'ADMIN' | 'MEMBER';
    user: {
      id: string;
      name: string;
      username?: string;
      avatar?: string;
    };
  }>;
  messages?: Message[];
}

interface MessagingContextType {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  socket: Socket | null;
  unreadCount: number;
  setCurrentConversation: (conversation: Conversation | null) => void;
  sendMessage: (content: string, messageType?: string, mediaId?: string, mediaIds?: string[]) => void;
  createDirectConversation: (participantId: string) => Promise<Conversation>;
  createGroupConversation: (name: string, participantIds: string[]) => Promise<Conversation>;
  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: string, limit?: number) => Promise<void>;
  markMessageAsRead: (messageId: string) => void;
  startTyping: () => void;
  stopTyping: () => void;
}

const MessagingContext = createContext<MessagingContextType | undefined>(undefined);

export function MessagingProvider({ children }: { children: React.ReactNode }) {
  const { data: authData } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get token from localStorage
  const getToken = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token');
    }
    return null;
  };

  const token = getToken();
  const user = authData?.data?.user;

  // Calculate unread message count
  const calculateUnreadCount = () => {
    if (!user?.id || !conversations) return 0;
    
    return conversations.reduce((total, conversation) => {
      if (!conversation.messages || conversation.messages.length === 0) return total;
      
      const lastMessage = conversation.messages[0];
      // If the last message is from someone else, count it as unread
      // This is a simplified approach - in a full implementation we'd check delivery status
      if (lastMessage.senderId !== user.id) {
        // Only count as unread if this conversation is not currently active
        if (currentConversation?.id !== conversation.id) {
          return total + 1;
        }
      }
      return total;
    }, 0);
  };

  const unreadCount = React.useMemo(() => calculateUnreadCount(), [user?.id, conversations, currentConversation?.id]);

  // Initialize Socket.io connection
  useEffect(() => {
    if (!user || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    const socket = io('http://localhost:8088', {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to messaging service');
      setIsConnected(true);
      setError(null);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from messaging service');
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setError('Failed to connect to messaging service');
      setIsConnected(false);
    });

    socket.on('new_message', (message: Message) => {
      setMessages(prev => [...prev, message]);
      
      // Update conversation's last message
      setConversations(prev => prev.map(conv => 
        conv.id === message.conversationId 
          ? { ...conv, lastMessageAt: message.createdAt }
          : conv
      ));
    });

    socket.on('message_delivered', (data: { messageId: string; deliveredAt: string }) => {
      // Handle message delivery confirmation
      console.log('Message delivered:', data.messageId);
    });

    socket.on('message_read', (data: { messageId: string; readBy: string; readAt: string }) => {
      // Handle read receipts
      console.log('Message read:', data.messageId, 'by:', data.readBy);
    });

    socket.on('user_typing', (data: { conversationId: string; userId: string }) => {
      // Handle typing indicators
      console.log('User typing:', data.userId, 'in conversation:', data.conversationId);
    });

    socket.on('user_stopped_typing', (data: { conversationId: string; userId: string }) => {
      // Handle typing stop
      console.log('User stopped typing:', data.userId, 'in conversation:', data.conversationId);
    });

    socket.on('error', (error: { message: string }) => {
      setError(error.message);
    });

    return () => {
      socket.disconnect();
    };
  }, [user, token]);

  // Load conversations
  const loadConversations = async () => {
    if (!token) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8088/api'}/messages/conversations`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to load conversations');
      
      const data = await response.json();
      setConversations(data);
    } catch (error) {
      console.error('Error loading conversations:', error);
      setError('Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  };

  // Load messages for a conversation
  const loadMessages = async (conversationId: string, limit = 50) => {
    if (!token) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8088/api'}/messages/conversations/${conversationId}/messages?limit=${limit}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (!response.ok) throw new Error('Failed to load messages');
      
      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.error('Error loading messages:', error);
      setError('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  };

  // Send message
  const sendMessage = (content: string, messageType = 'TEXT', mediaId?: string, mediaIds?: string[]) => {
    if (!socketRef.current || !currentConversation) return;
    
    // Allow media messages with empty content, but require content for text messages
    if (messageType === 'TEXT' && !content.trim()) return;

    socketRef.current.emit('send_message', {
      conversationId: currentConversation.id,
      content: content.trim(),
      messageType,
      mediaId,
      mediaIds
    });
  };

  // Create direct conversation
  const createDirectConversation = async (participantId: string): Promise<Conversation> => {
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8088/api'}/messages/conversations/direct`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ participantId })
    });

    if (!response.ok) throw new Error('Failed to create conversation');

    const conversation = await response.json();
    setConversations(prev => [conversation, ...prev]);
    return conversation;
  };

  // Create group conversation
  const createGroupConversation = async (name: string, participantIds: string[]): Promise<Conversation> => {
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8088/api'}/messages/conversations/group`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name, participantIds })
    });

    if (!response.ok) throw new Error('Failed to create group conversation');

    const conversation = await response.json();
    setConversations(prev => [conversation, ...prev]);
    return conversation;
  };

  // Mark message as read
  const markMessageAsRead = (messageId: string) => {
    if (!socketRef.current) return;

    socketRef.current.emit('mark_read', { messageId });
  };

  // Typing indicators
  const startTyping = () => {
    if (!socketRef.current || !currentConversation) return;

    socketRef.current.emit('typing_start', { conversationId: currentConversation.id });
  };

  const stopTyping = () => {
    if (!socketRef.current || !currentConversation) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('typing_stop', { conversationId: currentConversation!.id });
    }, 1000);
  };

  // Join conversation when current conversation changes
  useEffect(() => {
    if (socketRef.current && currentConversation) {
      socketRef.current.emit('join_conversation', { conversationId: currentConversation.id });
      loadMessages(currentConversation.id);
    }
  }, [currentConversation?.id]);

  // Load conversations on mount
  useEffect(() => {
    if (isConnected) {
      loadConversations();
    }
  }, [isConnected]);

  const value: MessagingContextType = {
    conversations,
    currentConversation,
    messages,
    isConnected,
    isLoading,
    error,
    socket: socketRef.current,
    unreadCount,
    setCurrentConversation,
    sendMessage,
    createDirectConversation,
    createGroupConversation,
    loadConversations,
    loadMessages,
    markMessageAsRead,
    startTyping,
    stopTyping
  };

  return (
    <MessagingContext.Provider value={value}>
      {children}
    </MessagingContext.Provider>
  );
}

export function useMessaging() {
  const context = useContext(MessagingContext);
  if (context === undefined) {
    throw new Error('useMessaging must be used within a MessagingProvider');
  }
  return context;
} 