import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { PrismaClient, DeliveryStatus } from '@prisma/client';
import jwt from 'jsonwebtoken';

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: any;
}

export class MessagingService {
  private io: SocketIOServer;
  private prisma: PrismaClient;
  private userSessions: Map<string, string> = new Map(); // userId -> socketId

  constructor(server: HTTPServer, prisma: PrismaClient) {
    this.prisma = prisma;
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST", "OPTIONS"],
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"]
      }
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        const user = await this.prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, name: true, username: true, avatar: true }
        });

        if (!user) {
          return next(new Error('Authentication error: User not found'));
        }

        socket.userId = user.id;
        socket.user = user;
        next();
      } catch (error) {
        next(new Error('Authentication error: Invalid token'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`User ${socket.userId} connected`);

      // Store user session
      this.userSessions.set(socket.userId!, socket.id);
      
      // Update user session in database
      this.updateUserSession(socket.userId!, socket.id);

      // Join user to their conversations
      this.joinUserConversations(socket);

      // Handle joining a specific conversation
      socket.on('join_conversation', async (data: { conversationId: string }) => {
        try {
          const participant = await this.prisma.conversationParticipant.findFirst({
            where: {
              conversationId: data.conversationId,
              userId: socket.userId!,
              isActive: true
            }
          });

          if (participant) {
            socket.join(data.conversationId);
            console.log(`User ${socket.userId} joined conversation ${data.conversationId}`);
          }
        } catch (error) {
          console.error('Error joining conversation:', error);
        }
      });

      // Handle leaving a conversation
      socket.on('leave_conversation', (data: { conversationId: string }) => {
        socket.leave(data.conversationId);
        console.log(`User ${socket.userId} left conversation ${data.conversationId}`);
      });

      // Handle sending a message
      socket.on('send_message', async (data: {
        conversationId: string;
        content: string;
        messageType: string;
        mediaId?: string;
        mediaIds?: string[];
      }) => {
        try {
          // Verify user is participant in conversation
          const participant = await this.prisma.conversationParticipant.findFirst({
            where: {
              conversationId: data.conversationId,
              userId: socket.userId!,
              isActive: true
            }
          });

          if (!participant) {
            socket.emit('error', { message: 'Not a participant in this conversation' });
            return;
          }

          // Create message
          const message = await this.prisma.message.create({
            data: {
              conversationId: data.conversationId,
              senderId: socket.userId!,
              content: data.content,
              messageType: data.messageType as any,
              mediaId: data.mediaId,
            },
            include: {
              sender: {
                select: { id: true, name: true, username: true, avatar: true }
              },
              media: {
                select: { id: true, url: true, thumbnail: true, mimeType: true, originalFilename: true }
              },
              mediaItems: {
                include: {
                  media: {
                    select: { id: true, url: true, thumbnail: true, mimeType: true, originalFilename: true }
                  }
                },
                orderBy: { order: 'asc' }
              }
            }
          });

          // If this is a POST message with multiple media items, create MessageMedia records
          if (data.messageType === 'POST' && data.mediaIds && data.mediaIds.length > 0) {
            const messageMediaData = data.mediaIds.map((mediaId, index) => ({
              messageId: message.id,
              mediaId: mediaId,
              order: index
            }));

            await this.prisma.messageMedia.createMany({
              data: messageMediaData
            });

            // Reload the message with the new media items
            const updatedMessage = await this.prisma.message.findUnique({
              where: { id: message.id },
              include: {
                sender: {
                  select: { id: true, name: true, username: true, avatar: true }
                },
                media: {
                  select: { id: true, url: true, thumbnail: true, mimeType: true, originalFilename: true }
                },
                mediaItems: {
                  include: {
                    media: {
                      select: { id: true, url: true, thumbnail: true, mimeType: true, originalFilename: true }
                    }
                  },
                  orderBy: { order: 'asc' }
                }
              }
            });

            if (updatedMessage) {
              message.mediaItems = updatedMessage.mediaItems;
            }
          }

          // Update conversation last message time
          await this.prisma.conversation.update({
            where: { id: data.conversationId },
            data: { lastMessageAt: new Date() }
          });

          // Create delivery status for all participants
          const participants = await this.prisma.conversationParticipant.findMany({
            where: {
              conversationId: data.conversationId,
              isActive: true
            }
          });

          const deliveryStatuses = participants.map(participant => ({
            messageId: message.id,
            userId: participant.userId,
            status: (participant.userId === socket.userId ? 'READ' : 'SENT') as DeliveryStatus
          }));

          await this.prisma.messageDeliveryStatus.createMany({
            data: deliveryStatuses
          });

          // Transform media URLs to full URLs
          const mediaWithUrls = message.media ? {
            ...message.media,
            url: message.media.url ? `${process.env.API_URL || 'http://localhost:8088'}/api/media/serve/${message.media.id}` : null,
            thumbnail: message.media.thumbnail ? `${process.env.API_URL || 'http://localhost:8088'}/api/media/serve/${message.media.id}/thumbnail` : null
          } : null;

          // Emit message to all participants in the conversation
          const messageData = {
            id: message.id,
            conversationId: message.conversationId,
            senderId: message.senderId,
            content: message.content,
            messageType: message.messageType,
            media: mediaWithUrls,
            createdAt: message.createdAt,
            sender: message.sender
          };

          this.io.to(data.conversationId).emit('new_message', messageData);

          // Emit delivery status to sender
          socket.emit('message_delivered', {
            messageId: message.id,
            deliveredAt: new Date()
          });

        } catch (error) {
          console.error('Error sending message:', error);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      // Handle typing indicators
      socket.on('typing_start', (data: { conversationId: string }) => {
        socket.to(data.conversationId).emit('user_typing', {
          conversationId: data.conversationId,
          userId: socket.userId
        });
      });

      socket.on('typing_stop', (data: { conversationId: string }) => {
        socket.to(data.conversationId).emit('user_stopped_typing', {
          conversationId: data.conversationId,
          userId: socket.userId
        });
      });

      // Handle marking message as read
      socket.on('mark_read', async (data: { messageId: string }) => {
        try {
          await this.prisma.messageDeliveryStatus.updateMany({
            where: {
              messageId: data.messageId,
              userId: socket.userId!
            },
            data: {
              status: 'READ',
              readAt: new Date()
            }
          });

          // Emit read receipt to conversation
          const message = await this.prisma.message.findUnique({
            where: { id: data.messageId },
            select: { conversationId: true }
          });

          if (message) {
            this.io.to(message.conversationId).emit('message_read', {
              messageId: data.messageId,
              readBy: socket.userId,
              readAt: new Date()
            });
          }
        } catch (error) {
          console.error('Error marking message as read:', error);
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`User ${socket.userId} disconnected`);
        this.userSessions.delete(socket.userId!);
        this.updateUserSessionOffline(socket.userId!);
      });
    });
  }

  private async joinUserConversations(socket: AuthenticatedSocket) {
    try {
      const conversations = await this.prisma.conversationParticipant.findMany({
        where: {
          userId: socket.userId!,
          isActive: true
        },
        select: {
          conversationId: true
        }
      });

      conversations.forEach(conv => {
        socket.join(conv.conversationId);
      });

      console.log(`User ${socket.userId} joined ${conversations.length} conversations`);
    } catch (error) {
      console.error('Error joining user conversations:', error);
    }
  }

  private async updateUserSession(userId: string, sessionId: string) {
    try {
      // First try to find existing session
      const existingSession = await this.prisma.userSession.findFirst({
        where: { userId }
      });

      if (existingSession) {
        await this.prisma.userSession.update({
          where: { id: existingSession.id },
          data: {
            sessionId,
            lastSeen: new Date(),
            isActive: true
          }
        });
      } else {
        await this.prisma.userSession.create({
          data: {
            userId,
            sessionId,
            deviceInfo: {},
            lastSeen: new Date(),
            isActive: true
          }
        });
      }
    } catch (error) {
      console.error('Error updating user session:', error);
    }
  }

  private async updateUserSessionOffline(userId: string) {
    try {
      await this.prisma.userSession.updateMany({
        where: { userId },
        data: {
          isActive: false,
          lastSeen: new Date()
        }
      });
    } catch (error) {
      console.error('Error updating user session offline:', error);
    }
  }

  // Public methods for external use
  public getIO() {
    return this.io;
  }

  public async sendMessageToUser(userId: string, event: string, data: any) {
    const socketId = this.userSessions.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
    }
  }

  public async sendMessageToConversation(conversationId: string, event: string, data: any) {
    this.io.to(conversationId).emit(event, data);
  }
} 