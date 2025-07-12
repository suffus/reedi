export declare const processImage: (buffer: Buffer, originalName: string, mimeType: string, userId: string) => Promise<{
    imagePath: string;
    thumbnailPath: string;
    width: number;
    height: number;
    size: number;
    s3Key: string;
    thumbnailS3Key?: string;
}>;
export declare const deleteImageFiles: (s3Key: string, thumbnailS3Key?: string) => Promise<void>;
//# sourceMappingURL=imageProcessor.d.ts.map