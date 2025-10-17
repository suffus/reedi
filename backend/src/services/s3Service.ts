import { 
  uploadZipFile, 
  deleteZipFile,
  uploadImageToS3,
  uploadImageWithThumbnail,
  deleteImageFromS3,
  deleteImageWithThumbnail,
  generatePresignedUrl,
  getImageFromS3,
  getPublicUrl,
  processImageForS3
} from '../utils/s3Service';

export const s3Service = {
  uploadZipFile,
  deleteZipFile,
  uploadImageToS3,
  uploadImageWithThumbnail,
  deleteImageFromS3,
  deleteImageWithThumbnail,
  generatePresignedUrl,
  getImageFromS3,
  getPublicUrl,
  processImageForS3
};


