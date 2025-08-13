#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');
const mime = require('mime-types');
const { program } = require('commander');
const ora = require('ora');
const chalk = require('chalk');
const cliProgress = require('cli-progress');

// Configuration
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
const MAX_CONCURRENT_CHUNKS = 3;
const MAX_RETRIES = 3;

class ReediUploader {
  constructor(backendUrl, userEmail, password) {
    this.backendUrl = backendUrl.replace(/\/$/, ''); // Remove trailing slash
    this.userEmail = userEmail;
    this.password = password;
    this.authToken = null;
    this.axiosInstance = axios.create({
      baseURL: this.backendUrl,
      timeout: 300000, // 5 minutes
    });
  }

  async authenticate() {
    const spinner = ora('Authenticating...').start();
    
    try {
      const response = await this.axiosInstance.post('/api/auth/login', {
        email: this.userEmail,
        password: this.password
      });

      if (response.data.success && response.data.data.token) {
        this.authToken = response.data.data.token;
        this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${this.authToken}`;
        spinner.succeed(`Authenticated as ${chalk.green(this.userEmail)}`);
        return true;
      } else {
        throw new Error('Authentication failed: Invalid response');
      }
    } catch (error) {
      spinner.fail(`Authentication failed: ${error.response?.data?.error || error.message}`);
      return false;
    }
  }

  async uploadFile(filePath, title, description, tags) {
    const fileName = path.basename(filePath);
    const fileSize = fs.statSync(filePath).size;
    const mimeType = mime.lookup(filePath) || 'application/octet-stream';
    
    console.log(`\n${chalk.blue('📁')} Uploading: ${chalk.cyan(fileName)}`);
    console.log(`   Size: ${this.formatFileSize(fileSize)} | Type: ${mimeType}`);
    
    try {
      if (fileSize > CHUNK_SIZE) {
        return await this.uploadLargeFile(filePath, fileName, fileSize, mimeType, title, description, tags);
      } else {
        return await this.uploadSmallFile(filePath, fileName, fileSize, mimeType, title, description, tags);
      }
    } catch (error) {
      console.error(`   ${chalk.red('❌')} Upload failed: ${error.message}`);
      return false;
    }
  }

  async uploadSmallFile(filePath, fileName, fileSize, mimeType, title, description, tags) {
    const spinner = ora('Uploading file...').start();
    
    try {
      const formData = new FormData();
      formData.append('media', fs.createReadStream(filePath));
      formData.append('title', title || fileName);
      formData.append('description', description || '');
      formData.append('tags', JSON.stringify(tags || []));

      const response = await this.axiosInstance.post('/api/media/upload', formData, {
        headers: {
          ...formData.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      if (response.data.success) {
        spinner.succeed(`Uploaded successfully`);
        return true;
      } else {
        throw new Error(response.data.error || 'Upload failed');
      }
    } catch (error) {
      spinner.fail(`Upload failed: ${error.response?.data?.error || error.message}`);
      throw error;
    }
  }

  async uploadLargeFile(filePath, fileName, fileSize, mimeType, title, description, tags) {
    const spinner = ora('Initiating multipart upload...').start();
    
    try {
      // Step 1: Initiate multipart upload
      const initiateResponse = await this.axiosInstance.post('/api/media/upload/initiate', {
        filename: fileName,
        contentType: mimeType,
        fileSize: fileSize,
        metadata: {
          title: title || fileName,
          description: description || '',
          tags: tags || []
        }
      });

      if (!initiateResponse.data.success) {
        throw new Error('Failed to initiate multipart upload');
      }

      const { uploadId, key, chunkSize } = initiateResponse.data;
      const totalChunks = Math.ceil(fileSize / chunkSize);
      
      spinner.succeed(`Multipart upload initiated (${totalChunks} chunks)`);

      // Step 2: Upload chunks
      const progressBar = new cliProgress.SingleBar({
        format: '   Uploading chunks |{bar}| {percentage}% | {value}/{total} chunks | ETA: {eta}s',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
      });

      progressBar.start(totalChunks, 0);

      const parts = [];
      const chunks = this.calculateChunks(fileSize, chunkSize);
      
      // Upload chunks with concurrency control
      for (let i = 0; i < chunks.length; i += MAX_CONCURRENT_CHUNKS) {
        const batch = chunks.slice(i, i + MAX_CONCURRENT_CHUNKS);
        const promises = batch.map(chunk => this.uploadChunk(filePath, key, uploadId, chunk, progressBar));
        
        const batchResults = await Promise.allSettled(promises);
        
        for (let j = 0; j < batchResults.length; j++) {
          const result = batchResults[j];
          if (result.status === 'fulfilled') {
            parts.push(result.value);
          } else {
            throw new Error(`Chunk ${batch[j].partNumber} failed: ${result.reason.message}`);
          }
        }
      }

      progressBar.stop();

      // Step 3: Complete multipart upload
      spinner.text = 'Completing multipart upload...';
      
      const completeResponse = await this.axiosInstance.post('/api/media/upload/complete', {
        uploadId,
        key,
        parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
        filename: fileName,
        contentType: mimeType,
        fileSize: fileSize,
        metadata: {
          title: title || fileName,
          description: description || '',
          tags: tags || []
        }
      });

      if (completeResponse.data.success) {
        spinner.succeed(`Multipart upload completed successfully`);
        return true;
      } else {
        throw new Error('Failed to complete multipart upload');
      }

    } catch (error) {
      spinner.fail(`Multipart upload failed: ${error.message}`);
      
      // Try to abort the upload if we have an uploadId
      if (error.uploadId) {
        try {
          await this.axiosInstance.post('/api/media/upload/abort', {
            uploadId: error.uploadId,
            key: error.key
          });
        } catch (abortError) {
          console.warn(`   Warning: Failed to abort upload: ${abortError.message}`);
        }
      }
      
      throw error;
    }
  }

  calculateChunks(fileSize, chunkSize) {
    const chunks = [];
    let partNumber = 1;
    let start = 0;

    while (start < fileSize) {
      const end = Math.min(start + chunkSize, fileSize);
      chunks.push({
        partNumber,
        start,
        end,
        size: end - start
      });
      start = end;
      partNumber++;
    }

    return chunks;
  }

  async uploadChunk(filePath, key, uploadId, chunk, progressBar) {
    let retries = 0;
    
    while (retries < MAX_RETRIES) {
      try {
        const chunkBuffer = fs.readFileSync(filePath, { start: chunk.start, end: chunk.end - 1 });
        
        const formData = new FormData();
        formData.append('chunk', chunkBuffer, {
          filename: `chunk_${chunk.partNumber}`,
          contentType: 'application/octet-stream'
        });
        formData.append('uploadId', uploadId);
        formData.append('key', key);
        formData.append('partNumber', chunk.partNumber.toString());

        const response = await this.axiosInstance.post('/api/media/upload/chunk', formData, {
          headers: {
            ...formData.getHeaders(),
          },
          timeout: 60000, // 1 minute per chunk
        });

        if (response.data.success) {
          progressBar.increment();
          return {
            PartNumber: chunk.partNumber,
            ETag: response.data.etag
          };
        } else {
          throw new Error(response.data.error || 'Chunk upload failed');
        }
      } catch (error) {
        retries++;
        if (retries >= MAX_RETRIES) {
          throw new Error(`Failed to upload chunk ${chunk.partNumber} after ${MAX_RETRIES} retries: ${error.message}`);
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
      }
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async uploadFiles(filePaths, title, description, tags) {
    console.log(`\n${chalk.green('🚀')} Starting bulk upload of ${filePaths.length} files`);
    console.log(`   Title: ${chalk.cyan(title || 'Bulk Upload')}`);
    console.log(`   Description: ${chalk.cyan(description || 'No description')}`);
    console.log(`   Tags: ${chalk.cyan(tags ? tags.join(', ') : 'No tags')}`);
    
    const results = {
      total: filePaths.length,
      successful: 0,
      failed: 0,
      errors: []
    };

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      
      if (!fs.existsSync(filePath)) {
        console.error(`   ${chalk.red('❌')} File not found: ${filePath}`);
        results.failed++;
        results.errors.push(`File not found: ${filePath}`);
        continue;
      }

      try {
        const success = await this.uploadFile(filePath, title, description, tags);
        if (success) {
          results.successful++;
        } else {
          results.failed++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`${path.basename(filePath)}: ${error.message}`);
      }
    }

    // Summary
    console.log(`\n${chalk.green('📊')} Upload Summary:`);
    console.log(`   Total files: ${results.total}`);
    console.log(`   Successful: ${chalk.green(results.successful)}`);
    console.log(`   Failed: ${chalk.red(results.failed)}`);
    
    if (results.errors.length > 0) {
      console.log(`\n${chalk.red('❌')} Errors:`);
      results.errors.forEach(error => console.log(`   ${error}`));
    }

    return results;
  }
}

// CLI setup
program
  .name('reedi-upload')
  .description('Bulk upload images and videos to Reedi app')
  .version('1.0.0')
  .requiredOption('--backend <url>', 'Backend server URL (e.g., localhost:8088)')
  .requiredOption('--user <email>', 'User email for authentication')
  .requiredOption('--password <password>', 'User password for authentication')
  .option('--title <title>', 'Title for all uploaded media', 'Bulk Upload')
  .option('--tags <tags>', 'Comma-separated tags for all media')
  .option('--description <description>', 'Description for all uploaded media', '')
  .argument('<files...>', 'Files to upload (images and videos)')
  .action(async (files, options) => {
    try {
      // Parse tags
      const tags = options.tags ? options.tags.split(',').map(tag => tag.trim()) : [];
      
      // Create uploader instance
      const uploader = new ReediUploader(options.backend, options.user, options.password);
      
      // Authenticate
      const authenticated = await uploader.authenticate();
      if (!authenticated) {
        process.exit(1);
      }
      
      // Upload files
      const results = await uploader.uploadFiles(files, options.title, options.description, tags);
      
      // Exit with appropriate code
      if (results.failed > 0) {
        process.exit(1);
      }
      
    } catch (error) {
      console.error(`\n${chalk.red('💥')} Fatal error: ${error.message}`);
      process.exit(1);
    }
  });

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error(`\n${chalk.red('💥')} Unhandled promise rejection:`, reason);
  process.exit(1);
});

// Parse command line arguments
program.parse(); 