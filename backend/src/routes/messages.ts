import express from 'express';
import { prisma } from '@/db';
import { authMiddleware } from '@/middleware/auth';

const router = express.Router();

// Get user's conversations
router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: {
            userId,
            isActive: true
          }
        }
      },
      include: {
        participants: {
          where: { isActive: true },
          include: {
            user: {
              select: { id: true, name: true, username: true, avatar: true }
            }
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: { id: true, name: true, username: true, avatar: true }
            },
            media: {
              select: { id: true, url: true, thumbnail: true, mimeType: true }
            }
          }
        }
      },
      orderBy: { lastMessageAt: 'desc' }
    });

    // Transform media URLs to full URLs in conversations
    const conversationsWithUrls = conversations.map(conversation => ({
      ...conversation,
      messages: conversation.messages.map(message => ({
        ...message,
        media: message.media ? {
          ...message.media,
          url: message.media.url ? `${process.env.API_URL || 'http://localhost:8088'}/api/media/serve/${message.media.id}` : null,
          thumbnail: message.media.thumbnail ? `${process.env.API_URL || 'http://localhost:8088'}/api/media/serve/${message.media.id}/thumbnail` : null
        } : null
      }))
    }));

    res.json(conversationsWithUrls);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Create direct conversation
router.post('/conversations/direct', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { participantId } = req.body;

    if (!participantId) {
      return res.status(400).json({ error: 'Participant ID is required' });
    }

    // Check if conversation already exists
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        type: 'DIRECT',
        participants: {
          every: {
            userId: { in: [userId, participantId] },
            isActive: true
          }
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, username: true, avatar: true }
            }
          }
        }
      }
    });

    if (existingConversation) {
      return res.json(existingConversation);
    }

    // Create new conversation
    const conversation = await prisma.conversation.create({
      data: {
        type: 'DIRECT',
        createdById: userId,
        participants: {
          create: [
            { userId, role: 'MEMBER' },
            { userId: participantId, role: 'MEMBER' }
          ]
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, username: true, avatar: true }
            }
          }
        }
      }
    });

    res.status(201).json(conversation);
  } catch (error) {
    console.error('Error creating direct conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Create group conversation
router.post('/conversations/group', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { name, participantIds, avatarUrl } = req.body;

    if (!name || !participantIds || !Array.isArray(participantIds)) {
      return res.status(400).json({ error: 'Name and participant IDs array are required' });
    }

    // Add creator to participants if not already included
    const allParticipantIds = participantIds.includes(userId) 
      ? participantIds 
      : [userId, ...participantIds];

    const conversation = await prisma.conversation.create({
      data: {
        type: 'GROUP',
        name,
        avatarUrl,
        createdById: userId,
        participants: {
          create: allParticipantIds.map(participantId => ({
            userId: participantId,
            role: participantId === userId ? 'ADMIN' : 'MEMBER'
          }))
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, username: true, avatar: true }
            }
          }
        }
      }
    });

    res.status(201).json(conversation);
  } catch (error) {
    console.error('Error creating group conversation:', error);
    res.status(500).json({ error: 'Failed to create group conversation' });
  }
});

// Get conversation details
router.get('/conversations/:conversationId', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { conversationId } = req.params;

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: {
            userId,
            isActive: true
          }
        }
      },
      include: {
        participants: {
          where: { isActive: true },
          include: {
            user: {
              select: { id: true, name: true, username: true, avatar: true }
            }
          }
        }
      }
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json(conversation);
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// Get messages for a conversation
router.get('/conversations/:conversationId/messages', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { conversationId } = req.params;
    const { limit = 50, before } = req.query;

    // Verify user is participant
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId,
        isActive: true
      }
    });

    if (!participant) {
      return res.status(403).json({ error: 'Not a participant in this conversation' });
    }

    // Build query
    const where: any = {
      conversationId,
      isDeleted: false
    };

    if (before) {
      where.createdAt = { lt: new Date(before as string) };
    }

    const messages = await prisma.message.findMany({
      where,
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
        },
        deliveryStatus: {
          where: { userId }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string)
    });

    // Transform media URLs to full URLs
    const messagesWithUrls = messages.map(message => ({
      ...message,
      media: message.media ? {
        ...message.media,
        url: message.media.url ? `${process.env.API_URL || 'http://localhost:8088'}/api/media/serve/${message.media.id}` : null,
        thumbnail: message.media.thumbnail ? `${process.env.API_URL || 'http://localhost:8088'}/api/media/serve/${message.media.id}/thumbnail` : null
      } : null,
      mediaItems: message.mediaItems?.map(item => ({
        ...item,
        media: {
          ...item.media,
          url: item.media.url ? `${process.env.API_URL || 'http://localhost:8088'}/api/media/serve/${item.media.id}` : null,
          thumbnail: item.media.thumbnail ? `${process.env.API_URL || 'http://localhost:8088'}/api/media/serve/${item.media.id}/thumbnail` : null
        }
      })) || []
    }));

    res.json(messagesWithUrls.reverse()); // Return in chronological order
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Delete message
router.delete('/messages/:messageId', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { messageId } = req.params;

    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        senderId: userId
      }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found or not authorized' });
    }

    await prisma.message.update({
      where: { id: messageId },
      data: { isDeleted: true }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Add participants to group conversation
router.post('/conversations/:conversationId/participants', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { conversationId } = req.params;
    const { participantIds } = req.body;

    if (!participantIds || !Array.isArray(participantIds)) {
      return res.status(400).json({ error: 'Participant IDs array is required' });
    }

    // Verify user is admin
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId,
        isActive: true
      }
    });

    if (!participant || participant.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized to add participants' });
    }

    // Add participants
    const newParticipants = await prisma.conversationParticipant.createMany({
      data: participantIds.map(participantId => ({
        conversationId,
        userId: participantId,
        role: 'MEMBER'
      })),
      skipDuplicates: true
    });

    res.json({ success: true, added: newParticipants.count });
  } catch (error) {
    console.error('Error adding participants:', error);
    res.status(500).json({ error: 'Failed to add participants' });
  }
});

// Remove participant from group conversation
router.delete('/conversations/:conversationId/participants/:participantId', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { conversationId, participantId } = req.params;

    // Verify user is admin
    const adminParticipant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId,
        isActive: true
      }
    });

    if (!adminParticipant || adminParticipant.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized to remove participants' });
    }

    await prisma.conversationParticipant.updateMany({
      where: {
        conversationId,
        userId: participantId
      },
      data: {
        isActive: false,
        leftAt: new Date()
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing participant:', error);
    res.status(500).json({ error: 'Failed to remove participant' });
  }
});

// Leave conversation
router.delete('/conversations/:conversationId/participants/me', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { conversationId } = req.params;

    await prisma.conversationParticipant.updateMany({
      where: {
        conversationId,
        userId
      },
      data: {
        isActive: false,
        leftAt: new Date()
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error leaving conversation:', error);
    res.status(500).json({ error: 'Failed to leave conversation' });
  }
});

export default router; 