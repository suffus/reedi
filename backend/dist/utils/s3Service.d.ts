export interface UploadResult {
    key: string;
    url: string;
    thumbnailKey?: string;
    thumbnailUrl?: string;
    width?: number;
    height?: number;
    size: number;
}
export interface ProcessedImage {
    originalBuffer: Buffer;
    thumbnailBuffer: Buffer;
    width: number;
    height: number;
    size: number;
}
export declare function processImageForS3(buffer: Buffer, originalName: string, mimeType: string): Promise<ProcessedImage>;
export declare function uploadImageToS3(buffer: Buffer, key: string, mimeType: string, metadata?: Record<string, string>): Promise<string>;
export declare function uploadImageWithThumbnail(originalBuffer: Buffer, thumbnailBuffer: Buffer, originalName: string, mimeType: string, userId: string): Promise<UploadResult>;
export declare function deleteImageFromS3(key: string): Promise<void>;
export declare function deleteImageWithThumbnail(originalKey: string, thumbnailKey?: string): Promise<void>;
export declare function generatePresignedUrl(key: string, expiresIn?: number): Promise<string>;
export declare function getImageFromS3(key: string): Promise<Buffer>;
export declare function getPublicUrl(key: string): Promise<string>;
//# sourceMappingURL=s3Service.d.ts.map