import request from 'supertest';
import express, { Express } from 'express';
import { testPrisma } from '../seed/test-database.config';
import { generateTestToken, getTestUserByEmail } from '../utils/test-helpers';
import mediaRoutes from '../../src/routes/media';
import { authMiddleware } from '../../src/middleware/auth';
import { errorHandler } from '../../src/middleware/errorHandler';
import * as fs from 'fs';
import * as path from 'path';

// Helper function to create a minimal valid zip file
function createTestZipFile(): Buffer {
  // This creates a minimal valid ZIP file with a single text file
  const zipContent = Buffer.from([
    0x50, 0x4B, 0x03, 0x04, // Local file header signature
    0x14, 0x00, // Version needed to extract
    0x00, 0x00, // General purpose bit flag
    0x08, 0x00, // Compression method (deflate)
    0x00, 0x00, 0x00, 0x00, // Last mod file time/date
    0x00, 0x00, 0x00, 0x00, // CRC-32
    0x05, 0x00, 0x00, 0x00, // Compressed size
    0x05, 0x00, 0x00, 0x00, // Uncompressed size
    0x04, 0x00, // File name length
    0x00, 0x00, // Extra field length
    // File name: "test"
    0x74, 0x65, 0x73, 0x74,
    // File data: "hello"
    0x48, 0x65, 0x6C, 0x6C, 0x6F,
    // Central directory file header
    0x50, 0x4B, 0x01, 0x02, // Central file header signature
    0x14, 0x00, // Version made by
    0x14, 0x00, // Version needed to extract
    0x00, 0x00, // General purpose bit flag
    0x08, 0x00, // Compression method
    0x00, 0x00, 0x00, 0x00, // Last mod file time/date
    0x00, 0x00, 0x00, 0x00, // CRC-32
    0x05, 0x00, 0x00, 0x00, // Compressed size
    0x05, 0x00, 0x00, 0x00, // Uncompressed size
    0x04, 0x00, // File name length
    0x00, 0x00, // Extra field length
    0x00, 0x00, // File comment length
    0x00, 0x00, // Disk number start
    0x00, 0x00, // Internal file attributes
    0x00, 0x00, 0x00, 0x00, // External file attributes
    0x00, 0x00, 0x00, 0x00, // Relative offset of local header
    // File name: "test"
    0x74, 0x65, 0x73, 0x74,
    // End of central directory record
    0x50, 0x4B, 0x05, 0x06, // End of central dir signature
    0x00, 0x00, // Number of this disk
    0x00, 0x00, // Number of the disk with the start of the central directory
    0x01, 0x00, // Total number of entries in the central directory on this disk
    0x01, 0x00, // Total number of entries in the central directory
    0x4E, 0x00, 0x00, 0x00, // Size of the central directory
    0x2A, 0x00, 0x00, 0x00, // Offset of start of central directory
    0x00, 0x00 // ZIP file comment length
  ]);
  
  return zipContent;
}

describe('ZIP Upload Integration Tests', () => {
  let app: Express;
  let testUser: any;
  let authToken: string;
  let testETag: string;

  beforeAll(async () => {
    // Create Express app for testing
    app = express();
    app.use(express.json());
    app.use('/api/media', authMiddleware, mediaRoutes);
    app.use(errorHandler);

    // Get test user
    testUser = await getTestUserByEmail('alice@test.com');
    authToken = generateTestToken(testUser);
  });

  afterAll(async () => {
    await testPrisma.media.deleteMany({
      where: { authorId: testUser.id, mediaType: 'ZIP' }
    });
  });

  describe('POST /api/media/upload (Direct Upload)', () => {
    it('should upload a small zip file directly', async () => {
      // Create a proper zip file buffer
      const zipBuffer = createTestZipFile();
      
      const response = await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('media', zipBuffer, 'test.zip')
        .field('preserveStructure', 'false')
        .field('maxFileSize', '10485760') // 10MB
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.media).toHaveProperty('id');
      expect(response.body.media).toHaveProperty('mediaType', 'ZIP');
      expect(response.body.media).toHaveProperty('originalFilename', 'test.zip');
      expect(response.body.media).toHaveProperty('processingStatus', 'PENDING');

      // Verify media was created in database
      const media = await testPrisma.media.findUnique({
        where: { id: response.body.media.id }
      });
      expect(media).toBeTruthy();
      expect(media?.authorId).toBe(testUser.id);
      expect(media?.originalFilename).toBe('test.zip');
      expect(media?.mediaType).toBe('ZIP');
    });

    it('should reject non-zip files', async () => {
      const textBuffer = Buffer.from('This is not a zip file');
      
      await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('media', textBuffer, 'test.txt')
        .expect(400);
    });

    it('should require authentication', async () => {
      const zipBuffer = createTestZipFile();
      
      await request(app)
        .post('/api/media/upload')
        .attach('media', zipBuffer, 'test.zip')
        .expect(401);
    });
  });

  describe('POST /api/media/upload/initiate (Chunked Upload)', () => {
    it('should initiate multipart upload for large zip file', async () => {
      const response = await request(app)
        .post('/api/media/upload/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          filename: 'large-test.zip',
          contentType: 'application/zip',
          fileSize: 10 * 1024 * 1024, // 10MB
          options: JSON.stringify({
            preserveStructure: false,
            maxFileSize: 1073741824,
            allowedTypes: ['IMAGE', 'VIDEO']
          })
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('uploadId');
      expect(response.body).toHaveProperty('key');
      expect(response.body).toHaveProperty('chunkSize');
      expect(response.body).toHaveProperty('maxConcurrentChunks');
    });

    it('should require authentication for initiate', async () => {
      await request(app)
        .post('/api/media/upload/initiate')
        .set('Content-Type', 'application/json')
        .send({
          filename: 'test.zip',
          contentType: 'application/zip',
          fileSize: 1024
        })
        .expect(401);
    });

    it('should require all required fields', async () => {
      await request(app)
        .post('/api/media/upload/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          filename: 'test.zip'
          // Missing contentType and fileSize
        })
        .expect(400);
    });
  });

  describe('POST /api/media/upload/chunk', () => {
    let uploadId: string;
    let key: string;

    beforeAll(async () => {
      // Initiate upload first
      const response = await request(app)
        .post('/api/media/upload/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          filename: 'chunk-test.zip',
          contentType: 'application/zip',
          fileSize: 1024
        });
      
      uploadId = response.body.uploadId;
      key = response.body.key;
    });

    it('should upload a chunk', async () => {
      const chunkData = Buffer.from('test chunk data');
      
      const response = await request(app)
        .post('/api/media/upload/chunk')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          uploadId,
          key,
          partNumber: 1,
          chunk: chunkData.toString('base64')
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('etag');
      
      // Store the real ETag for the complete test
      testETag = response.body.etag;
    });

    it('should require authentication for chunk upload', async () => {
      await request(app)
        .post('/api/media/upload/chunk')
        .set('Content-Type', 'application/json')
        .send({
          uploadId: 'test',
          key: 'test',
          partNumber: 1,
          chunk: 'dGVzdA=='
        })
        .expect(401);
    });
  });

  describe('POST /api/media/upload/complete', () => {
    let uploadId: string;
    let key: string;

    beforeAll(async () => {
      // Initiate upload and upload a chunk
      const initiateResponse = await request(app)
        .post('/api/media/upload/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          filename: 'complete-test.zip',
          contentType: 'application/zip',
          fileSize: 1024
        });
      
      uploadId = initiateResponse.body.uploadId;
      key = initiateResponse.body.key;

      // Upload a chunk
      const chunkData = Buffer.from('test chunk data');
      await request(app)
        .post('/api/media/upload/chunk')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          uploadId,
          key,
          partNumber: 1,
          chunk: chunkData.toString('base64')
        });
    });

    it('should complete multipart upload and create media record', async () => {
      const response = await request(app)
        .post('/api/media/upload/complete')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          uploadId,
          key,
          parts: [{ PartNumber: 1, ETag: testETag || 'test-etag' }],
          filename: 'complete-test.zip',
          contentType: 'application/zip',
          fileSize: 1024
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.media).toHaveProperty('id');
      expect(response.body.media).toHaveProperty('mediaType', 'ZIP');
      expect(response.body.media).toHaveProperty('originalFilename', 'complete-test.zip');

      // Verify media was created in database
      const media = await testPrisma.media.findUnique({
        where: { id: response.body.media.id }
      });
      expect(media).toBeTruthy();
      expect(media?.authorId).toBe(testUser.id);
      expect(media?.originalFilename).toBe('complete-test.zip');
      expect(media?.mediaType).toBe('ZIP');
    });

    it('should require authentication for complete', async () => {
      await request(app)
        .post('/api/media/upload/complete')
        .set('Content-Type', 'application/json')
        .send({
          uploadId: 'test',
          key: 'test',
          parts: []
        })
        .expect(401);
    });
  });
});
