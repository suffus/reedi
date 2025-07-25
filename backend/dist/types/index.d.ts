import { Request } from 'express';
import { User, Post, Comment, Media, Reaction } from '@prisma/client';
export interface AuthenticatedRequest extends Request {
    user?: User;
}
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface RegisterRequest {
    name: string;
    email: string;
    username?: string;
    password: string;
}
export interface AuthResponse {
    user: Omit<User, 'password'>;
    token: string;
}
export interface CreatePostRequest {
    title?: string;
    content: string;
    isPrivate?: boolean;
    hashtags?: string[];
    mentions?: string[];
}
export interface UpdatePostRequest {
    title?: string;
    content?: string;
    isPrivate?: boolean;
    hashtags?: string[];
    mentions?: string[];
}
export interface CreateCommentRequest {
    content: string;
    postId: string;
    parentId?: string;
}
export interface UpdateCommentRequest {
    content: string;
}
export interface CreateMediaRequest {
    url: string;
    altText?: string;
    caption?: string;
    postId?: string;
    galleryId?: string;
    mediaType?: 'IMAGE' | 'VIDEO';
}
export interface VideoProcessingRequest {
    mediaId: string;
    s3Key: string;
    userId: string;
    originalFilename: string;
    mimeType: string;
}
export interface VideoProcessingResult {
    duration: number;
    codec: string;
    bitrate: number;
    framerate: number;
    videoUrl: string;
    videoS3Key: string;
    thumbnailUrl: string;
    thumbnailS3Key: string;
}
export interface CreateGalleryRequest {
    name: string;
    description?: string;
    isPrivate?: boolean;
}
export interface SearchRequest {
    query: string;
    type?: 'posts' | 'users' | 'hashtags' | 'all';
    limit?: number;
    offset?: number;
}
export interface PaginationParams {
    page?: number;
    limit?: number;
    offset?: number;
}
export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}
export type PostWithAuthor = Post & {
    author: User;
    _count: {
        comments: number;
        reactions: number;
    };
};
export type PostWithDetails = Post & {
    author: User;
    comments: Comment[];
    reactions: Reaction[];
    media: Media[];
    hashtags: {
        name: string;
    }[];
    _count: {
        comments: number;
        reactions: number;
    };
};
export type CommentWithAuthor = Comment & {
    author: User;
    _count: {
        replies: number;
        reactions: number;
    };
};
export type UserWithStats = User & {
    _count: {
        posts: number;
        followers: number;
        following: number;
    };
};
//# sourceMappingURL=index.d.ts.map