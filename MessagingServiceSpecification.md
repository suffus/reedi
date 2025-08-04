# Reedi Messaging Service Specification

## Executive Summary

This document outlines the specification for a comprehensive messaging service that integrates with the Reedi social media platform. The service will provide WhatsApp/Telegram-like functionality including direct messaging, group chats, media sharing, and end-to-end encryption, with a scalable architecture designed to support thousands to millions of users.

## 1. System Overview

### 1.1 Core Features
- **Direct Messaging**: One-on-one conversations between users
- **Group Chats**: Multi-user conversations with admin controls
- **Media Sharing**: Text, images, videos, documents, voice messages
- **End-to-End Encryption**: Signal Protocol-based encryption
- **Real-time Communication**: WebSocket-based real-time messaging
- **Message Status**: Read receipts, delivery confirmations
- **Voice/Video Calls**: WebRTC-based calling (future phase)
- **Message Search**: Full-text search across conversations
- **Message Reactions**: Emoji reactions to messages
- **Message Threading**: Reply to specific messages
- **File Sharing**: Document and file uploads
- **User Status**: Online/offline status, typing indicators

### 1.2 Integration with Reedi
- Seamless user authentication using existing Reedi accounts
- Shared media library integration
- Cross-platform notifications
- Unified user profiles and avatars
- Integration with existing friend/follower system

## 2. Technical Architecture

### 2.1 Technology Stack

#### Backend Services
- **API Gateway**: Node.js with Express.js (existing)
- **Message Service**: Node.js with TypeScript
- **WebSocket Service**: Socket.io for real-time communication
- **Media Service**: Existing Reedi media infrastructure
- **Database**: PostgreSQL (existing) + Redis for caching
- **Message Queue**: RabbitMQ (existing)
- **File Storage**: AWS S3 (existing)
- **Encryption**: Signal Protocol implementation

#### Frontend
- **Web Client**: React.js with TypeScript (existing)
- **Mobile App**: React Native (future)
- **Real-time**: Socket.io-client
- **Encryption**: Web Crypto API + Signal Protocol

#### Infrastructure
- **Containerization**: Docker (existing)
- **Orchestration**: Docker Compose (existing)
- **Load Balancing**: Nginx (existing)
- **Monitoring**: Prometheus + Grafana
- **Logging**: Winston (existing)

### 2.2 System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │  Mobile Client  │    │   API Gateway   │
│   (React.js)    │    │ (React Native)  │    │   (Express.js)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  WebSocket Hub  │
                    │   (Socket.io)   │
                    └─────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Message Service │    │  Media Service  │    │  Auth Service   │
│   (Node.js)     │    │   (Existing)    │    │   (Existing)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │   (Existing)    │
                    └─────────────────┘
                                 │
                    ┌─────────────────┐
                    │     Redis       │
                    │   (Caching)     │
                    └─────────────────┘
```

## 3. Database Schema

### 3.1 New Tables for Messaging

```sql
-- Conversations (Direct and Group)
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type CONVERSATION_TYPE NOT NULL, -- 'direct' or 'group'
    name VARCHAR(255), -- For group chats
    avatar_url VARCHAR(500), -- For group chats
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_message_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Conversation participants
CREATE TABLE conversation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role PARTICIPANT_ROLE DEFAULT 'member', -- 'admin', 'member'
    joined_at TIMESTAMP DEFAULT NOW(),
    left_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(conversation_id, user_id)
);

-- Messages
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT,
    message_type MESSAGE_TYPE NOT NULL, -- 'text', 'image', 'video', 'audio', 'file', 'system'
    media_id UUID REFERENCES media(id), -- For media messages
    reply_to_id UUID REFERENCES messages(id), -- For threaded replies
    encrypted_content TEXT, -- Encrypted message content
    encryption_version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT false
);

-- Message delivery status
CREATE TABLE message_delivery_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status DELIVERY_STATUS DEFAULT 'sent', -- 'sent', 'delivered', 'read'
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    UNIQUE(message_id, user_id)
);

-- Message reactions
CREATE TABLE message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reaction VARCHAR(10) NOT NULL, -- Emoji
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(message_id, user_id, reaction)
);

-- User sessions (for WebSocket connections)
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    device_info JSONB,
    last_seen TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Encryption keys (for Signal Protocol)
CREATE TABLE encryption_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    key_type KEY_TYPE NOT NULL, -- 'identity', 'prekey', 'signed_prekey'
    key_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);

-- Enums
CREATE TYPE CONVERSATION_TYPE AS ENUM ('direct', 'group');
CREATE TYPE PARTICIPANT_ROLE AS ENUM ('admin', 'member');
CREATE TYPE MESSAGE_TYPE AS ENUM ('text', 'image', 'video', 'audio', 'file', 'system');
CREATE TYPE DELIVERY_STATUS AS ENUM ('sent', 'delivered', 'read');
CREATE TYPE KEY_TYPE AS ENUM ('identity', 'prekey', 'signed_prekey');
```

## 4. API Endpoints

### 4.1 Conversation Management

```typescript
// Create direct conversation
POST /api/messages/conversations/direct
{
  "participantId": "user-uuid"
}

// Create group conversation
POST /api/messages/conversations/group
{
  "name": "Group Name",
  "participantIds": ["user-uuid-1", "user-uuid-2"],
  "avatarUrl": "optional-avatar-url"
}

// Get user conversations
GET /api/messages/conversations

// Get conversation details
GET /api/messages/conversations/:conversationId

// Update conversation
PUT /api/messages/conversations/:conversationId
{
  "name": "New Name",
  "avatarUrl": "new-avatar-url"
}

// Leave conversation
DELETE /api/messages/conversations/:conversationId/participants/me

// Add participants (group only)
POST /api/messages/conversations/:conversationId/participants
{
  "participantIds": ["user-uuid-1", "user-uuid-2"]
}

// Remove participants (group only)
DELETE /api/messages/conversations/:conversationId/participants/:userId
```

### 4.2 Message Management

```typescript
// Send message
POST /api/messages/conversations/:conversationId/messages
{
  "content": "Message content",
  "messageType": "text",
  "replyToId": "optional-reply-message-id",
  "mediaId": "optional-media-id"
}

// Get messages
GET /api/messages/conversations/:conversationId/messages?limit=50&before=message-id

// Delete message
DELETE /api/messages/messages/:messageId

// React to message
POST /api/messages/messages/:messageId/reactions
{
  "reaction": "👍"
}

// Remove reaction
DELETE /api/messages/messages/:messageId/reactions/:reaction
```

### 4.3 Encryption

```typescript
// Get user's public keys
GET /api/messages/keys/:userId

// Upload keys
POST /api/messages/keys
{
  "identityKey": "base64-encoded-key",
  "preKeys": ["base64-encoded-key-1", "base64-encoded-key-2"],
  "signedPreKey": "base64-encoded-signed-key"
}

// Get pre-keys for user
GET /api/messages/keys/:userId/prekeys?count=10
```

## 5. WebSocket Events

### 5.1 Client to Server

```typescript
// Join conversation
socket.emit('join_conversation', { conversationId: 'uuid' });

// Leave conversation
socket.emit('leave_conversation', { conversationId: 'uuid' });

// Send message
socket.emit('send_message', {
  conversationId: 'uuid',
  content: 'message content',
  messageType: 'text',
  replyToId: 'optional-reply-id'
});

// Typing indicator
socket.emit('typing_start', { conversationId: 'uuid' });
socket.emit('typing_stop', { conversationId: 'uuid' });

// Mark message as read
socket.emit('mark_read', { messageId: 'uuid' });
```

### 5.2 Server to Client

```typescript
// New message
socket.on('new_message', {
  messageId: 'uuid',
  conversationId: 'uuid',
  senderId: 'uuid',
  content: 'message content',
  messageType: 'text',
  timestamp: '2024-01-01T00:00:00Z'
});

// Message delivered
socket.on('message_delivered', {
  messageId: 'uuid',
  deliveredAt: '2024-01-01T00:00:00Z'
});

// Message read
socket.on('message_read', {
  messageId: 'uuid',
  readAt: '2024-01-01T00:00:00Z'
});

// Typing indicator
socket.on('user_typing', {
  conversationId: 'uuid',
  userId: 'uuid'
});

// User online/offline
socket.on('user_status_change', {
  userId: 'uuid',
  status: 'online' | 'offline',
  lastSeen: '2024-01-01T00:00:00Z'
});
```

## 6. Implementation Phases

### Phase 1: Core Messaging (Weeks 1-4)
1. **Database Schema Setup**
   - Create messaging tables
   - Add indexes for performance
   - Set up foreign key relationships

2. **Basic API Endpoints**
   - Conversation CRUD operations
   - Message sending/receiving
   - Basic WebSocket integration

3. **Frontend Integration**
   - Message UI components
   - Conversation list
   - Basic real-time messaging

### Phase 2: Enhanced Features (Weeks 5-8)
1. **Media Support**
   - Image/video sharing
   - File uploads
   - Voice messages

2. **Message Features**
   - Message reactions
   - Reply threading
   - Message search

3. **Group Chat Features**
   - Group management
   - Admin controls
   - Participant management

### Phase 3: Encryption (Weeks 9-12)
1. **Signal Protocol Implementation**
   - Key generation and management
   - End-to-end encryption
   - Key verification

2. **Security Features**
   - Message encryption/decryption
   - Key rotation
   - Forward secrecy

### Phase 4: Advanced Features (Weeks 13-16)
1. **Voice/Video Calls**
   - WebRTC integration
   - Call signaling
   - Call recording (optional)

2. **Performance Optimization**
   - Message pagination
   - Caching strategies
   - Load balancing

3. **Monitoring & Analytics**
   - Message delivery metrics
   - User engagement tracking
   - Performance monitoring

## 7. Security Considerations

### 7.1 End-to-End Encryption
- **Signal Protocol**: Industry-standard encryption protocol
- **Perfect Forward Secrecy**: Keys change with each message
- **Key Verification**: Users can verify each other's keys
- **No Backdoor**: Server cannot decrypt messages

### 7.2 Data Protection
- **Message Encryption**: All messages encrypted at rest
- **Media Encryption**: Files encrypted before storage
- **Key Management**: Secure key storage and rotation
- **Access Controls**: Role-based access to conversations

### 7.3 Privacy Features
- **Message Deletion**: True deletion from all devices
- **Self-Destructing Messages**: Optional auto-deletion
- **Privacy Settings**: Control who can message you
- **Blocking**: Block unwanted users

## 8. Scalability Considerations

### 8.1 Database Optimization
- **Sharding Strategy**: Conversation-based sharding
- **Read Replicas**: Separate read/write databases
- **Caching**: Redis for frequently accessed data
- **Indexing**: Optimized indexes for message queries

### 8.2 WebSocket Scaling
- **Redis Adapter**: Socket.io with Redis for horizontal scaling
- **Load Balancing**: Multiple WebSocket servers
- **Connection Management**: Efficient connection pooling
- **Message Queuing**: RabbitMQ for message processing

### 8.3 Media Handling
- **CDN Integration**: Fast media delivery
- **Progressive Loading**: Optimized media loading
- **Compression**: Image/video compression
- **Storage Optimization**: Efficient file storage

## 9. Key Risks and Mitigation

### 9.1 Technical Risks

#### Risk: WebSocket Connection Stability
- **Impact**: High - Users may lose real-time updates
- **Mitigation**: 
  - Implement automatic reconnection
  - Fallback to polling for critical messages
  - Connection health monitoring

#### Risk: Database Performance
- **Impact**: High - Slow message delivery
- **Mitigation**:
  - Implement message pagination
  - Use read replicas for message queries
  - Optimize database indexes
  - Implement message archiving

#### Risk: Encryption Implementation
- **Impact**: Critical - Security vulnerabilities
- **Mitigation**:
  - Use proven Signal Protocol libraries
  - Extensive security testing
  - Regular security audits
  - Key management best practices

### 9.2 Operational Risks

#### Risk: High Infrastructure Costs
- **Impact**: Medium - May affect profitability
- **Mitigation**:
  - Implement efficient caching
  - Use auto-scaling
  - Monitor resource usage
  - Optimize media storage

#### Risk: User Adoption
- **Impact**: High - Low usage may not justify costs
- **Mitigation**:
  - Seamless integration with existing Reedi features
  - Intuitive user interface
  - Performance optimization
  - User feedback integration

## 10. Monitoring and Analytics

### 10.1 Key Metrics
- **Message Delivery Rate**: Percentage of messages delivered successfully
- **Response Time**: Time from message send to delivery
- **User Engagement**: Daily/monthly active users
- **Media Usage**: Types and sizes of shared media
- **Error Rates**: Failed message deliveries

### 10.2 Monitoring Tools
- **Application Monitoring**: Prometheus + Grafana
- **Error Tracking**: Sentry or similar
- **Performance Monitoring**: New Relic or DataDog
- **Log Management**: ELK Stack or similar

## 11. Testing Strategy

### 11.1 Unit Testing
- Message encryption/decryption
- WebSocket event handling
- Database operations
- API endpoint validation

### 11.2 Integration Testing
- End-to-end message flow
- WebSocket connection management
- Media upload and sharing
- Group chat functionality

### 11.3 Load Testing
- Concurrent user connections
- Message throughput
- Media upload performance
- Database query performance

### 11.4 Security Testing
- Encryption implementation
- Authentication and authorization
- Input validation
- SQL injection prevention

## 12. Deployment Strategy

### 12.1 Environment Setup
- **Development**: Local Docker setup
- **Staging**: Production-like environment
- **Production**: Multi-region deployment

### 12.2 CI/CD Pipeline
- Automated testing
- Security scanning
- Performance testing
- Blue-green deployment

### 12.3 Rollback Strategy
- Database migration rollback
- Application version rollback
- Feature flag management
- Emergency procedures

## 13. Success Criteria

### 13.1 Technical Metrics
- Message delivery success rate > 99.9%
- Average message delivery time < 100ms
- System uptime > 99.9%
- Support for 10,000+ concurrent users

### 13.2 User Experience Metrics
- User adoption rate > 60% within 3 months
- Average session duration > 10 minutes
- Message response rate > 80%
- User satisfaction score > 4.5/5

### 13.3 Business Metrics
- Increased user engagement on Reedi platform
- Reduced user churn
- Positive user feedback
- Successful integration with existing features

## 14. Conclusion

This messaging service specification provides a comprehensive roadmap for implementing a secure, scalable, and feature-rich messaging system that integrates seamlessly with the existing Reedi platform. The phased approach ensures manageable development cycles while delivering value incrementally.

The focus on end-to-end encryption, real-time communication, and scalability positions the service to compete with established messaging platforms while leveraging the existing Reedi user base and infrastructure.

Key success factors include:
- Robust encryption implementation
- Seamless integration with existing Reedi features
- Performance optimization for scale
- Comprehensive testing and monitoring
- User-centric design and experience

This specification serves as a living document that should be updated as requirements evolve and new insights are gained during development. 