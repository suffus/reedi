import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuidv4 } from 'uuid'
import logger from '../utils/logger'

export class S3ProcessorService {
  private s3Client: S3Client
  private readonly bucket: string
  private readonly tempDir: string

  constructor(
    region: string,
    accessKeyId: string,
    secretAccessKey: string,
    bucket: string,
    tempDir: string = '/tmp',
    endpoint?: string
  ) {
    const s3Config: any = {
      region,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    }

    // Add endpoint if provided (for S3-compatible services like IDrive)
    if (endpoint) {
      s3Config.endpoint = endpoint
      s3Config.forcePathStyle = true // Required for S3-compatible services
    }

    this.s3Client = new S3Client(s3Config)
    this.bucket = bucket
    this.tempDir = tempDir

    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true })
    }
  }

  async downloadVideo(s3Key: string): Promise<string> {
    const localPath = path.join(this.tempDir, `${uuidv4()}.mp4`)
    
    try {
      logger.info(`Downloading video from S3: ${s3Key} to ${localPath}`)
      
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: s3Key
      })

      const response = await this.s3Client.send(command)
      
      if (!response.Body) {
        throw new Error('No body in S3 response')
      }

      // Convert the readable stream to a buffer and write to file
      const chunks: Buffer[] = []
      for await (const chunk of response.Body as any) {
        chunks.push(chunk)
      }
      const buffer = Buffer.concat(chunks)
      
      fs.writeFileSync(localPath, buffer)
      
      logger.info(`Successfully downloaded video to ${localPath}`)
      return localPath
    } catch (error) {
      logger.error(`Failed to download video from S3: ${error}`)
      throw error
    }
  }

  async uploadFile(localPath: string, s3Key: string, contentType?: string): Promise<void> {
    try {
      logger.info(`Uploading file to S3: ${localPath} -> ${s3Key}`)
      
      const fileContent = fs.readFileSync(localPath)
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
        Body: fileContent,
        ContentType: contentType || this.getContentType(localPath)
      })

      await this.s3Client.send(command)
      logger.info(`Successfully uploaded file to S3: ${s3Key}`)
    } catch (error) {
      logger.error(`Failed to upload file to S3: ${error}`)
      throw error
    }
  }

  async uploadThumbnail(localPath: string, mediaId: string, index: number): Promise<string> {
    const s3Key = `thumbnails/${mediaId}_${index}.jpg`
    await this.uploadFile(localPath, s3Key, 'image/jpeg')
    return s3Key
  }

  async uploadVideoVersion(localPath: string, mediaId: string, quality: string): Promise<string> {
    const s3Key = `videos/${mediaId}_${quality}.mp4`
    await this.uploadFile(localPath, s3Key, 'video/mp4')
    return s3Key
  }

  async uploadOriginalVideo(localPath: string, mediaId: string): Promise<string> {
    const s3Key = `videos/${mediaId}_original.mp4`
    await this.uploadFile(localPath, s3Key, 'video/mp4')
    return s3Key
  }

  private getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()
    switch (ext) {
      case '.mp4':
        return 'video/mp4'
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg'
      case '.png':
        return 'image/png'
      default:
        return 'application/octet-stream'
    }
  }

  async cleanupTempFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        logger.debug(`Cleaned up temp file: ${filePath}`)
      }
    } catch (error) {
      logger.warn(`Failed to clean up temp file ${filePath}:`, error)
    }
  }

  async cleanupTempFiles(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      await this.cleanupTempFile(filePath)
    }
  }
} 