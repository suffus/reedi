# Reedi Bulk Upload Utility

A powerful command-line tool for bulk uploading images and videos to the Reedi app backend. This utility handles both small files (direct upload) and large files (chunked multipart upload) automatically.

## Features

- 🔐 **Authentication**: Secure login with email/password
- 📁 **Bulk Upload**: Upload multiple files in one command
- 🚀 **Smart Upload**: Automatically chooses between direct and chunked upload
- 📊 **Progress Tracking**: Visual progress bars and real-time status updates
- 🔄 **Retry Logic**: Automatic retry with exponential backoff for failed chunks
- 🏷️ **Metadata Support**: Set title, description, and tags for all uploaded media
- 💪 **Robust Error Handling**: Comprehensive error reporting and cleanup

## Installation

### Option 1: Install Dependencies and Run Directly

```bash
# Install dependencies
npm install

# Make the script executable
chmod +x reedi-upload.js

# Run the utility
node reedi-upload.js --help
```

### Option 2: Install Globally (Recommended)

```bash
# Install dependencies
npm install

# Install globally for easy access
npm run install-global

# Now you can run from anywhere
reedi-upload --help
```

## Usage

### Basic Command Structure

```bash
reedi-upload --backend <url> --user <email> --password <password> [options] <files...>
```

### Required Parameters

- `--backend`: Backend server URL (e.g., `localhost:8088`, `https://api.reedi.com`)
- `--user`: Your email address for authentication
- `--password`: Your password for authentication
- `<files...>`: One or more files to upload (images and videos)

### Optional Parameters

- `--title`: Title for all uploaded media (default: "Bulk Upload")
- `--description`: Description for all uploaded media (default: "")
- `--tags`: Comma-separated tags for all media (e.g., "vacation,summer,2024")

### Examples

#### Upload a few images with metadata

```bash
reedi-upload \
  --backend localhost:8088 \
  --user s.finch@fanjango.com.hk \
  --password XxxxxxxxY \
  --title "Edinburgh Vacation Photos" \
  --tags "edinburgh,vacation,scotland,2024" \
  --description "Photos from our trip to Edinburgh in 2024" \
  photo1.jpg photo2.jpg photo3.jpg
```

#### Upload mixed media types

```bash
reedi-upload \
  --backend localhost:8088 \
  --user s.finch@fanjango.com.hk \
  --password XxxxxxxxY \
  --title "Family Memories" \
  --tags "family,memories,2024" \
  image1.JPG video1.MP4 image2.PNG video2.mov
```

#### Simple upload without metadata

```bash
reedi-upload \
  --backend localhost:8088 \
  --user s.finch@fanjango.com.hk \
  --password XxxxxxxxY \
  *.jpg *.mp4
```

## How It Works

### Authentication
1. Logs in to the backend using your credentials
2. Receives a JWT token for subsequent requests
3. Automatically handles token expiration

### File Upload Strategy
- **Small files** (< 5MB): Direct upload using the `/media/upload` endpoint
- **Large files** (≥ 5MB): Chunked multipart upload using the chunked upload endpoints

### Chunked Upload Process
1. **Initiate**: Creates a multipart upload session
2. **Upload Chunks**: Splits file into 5MB chunks and uploads them concurrently (max 3 at a time)
3. **Complete**: Finalizes the upload and creates the media record
4. **Cleanup**: Automatically aborts failed uploads

### Progress Tracking
- **Small files**: Spinner with success/failure status
- **Large files**: Progress bar showing chunk upload progress
- **Overall**: Summary of successful and failed uploads

## Supported File Types

### Images
- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)

### Videos
- MP4 (.mp4)
- WebM (.webm)
- MOV (.mov)
- AVI (.avi)
- MKV (.mkv)

## Configuration

The utility uses these default settings (matching your backend):

- **Chunk Size**: 5MB (5,242,880 bytes)
- **Max Concurrent Chunks**: 3
- **Max Retries**: 3 per chunk
- **Chunk Threshold**: 5MB (files larger than this use chunked upload)

## Error Handling

### Common Errors and Solutions

#### Authentication Failed
```
❌ Authentication failed: Invalid credentials
```
**Solution**: Check your email and password

#### File Not Found
```
❌ File not found: /path/to/file.jpg
```
**Solution**: Verify the file path exists and is accessible

#### Upload Failed
```
❌ Upload failed: Network timeout
```
**Solution**: Check your internet connection and backend server status

#### Chunk Upload Failed
```
❌ Chunk 5 failed: ETag mismatch
```
**Solution**: The utility will automatically retry with exponential backoff

### Exit Codes
- `0`: All uploads successful
- `1`: One or more uploads failed

## Troubleshooting

### Backend Connection Issues
- Verify the backend URL is correct and accessible
- Check if the backend server is running
- Ensure no firewall is blocking the connection

### Large File Upload Issues
- Check available disk space on the backend
- Verify S3/IDrive credentials are configured correctly
- Monitor backend logs for detailed error information

### Performance Issues
- Large files are automatically chunked for better reliability
- The utility uses concurrent chunk uploads for speed
- Network latency may affect upload times

## Security Notes

- Passwords are sent over HTTPS (recommended) or HTTP (development)
- JWT tokens are automatically managed and refreshed
- No credentials are stored locally
- Consider using environment variables for production deployments

## Development

### Project Structure
```
reedi-upload/
├── reedi-upload.js    # Main utility script
├── package.json        # Dependencies and scripts
└── README.md          # This documentation
```

### Dependencies
- **axios**: HTTP client for API requests
- **commander**: Command-line argument parsing
- **form-data**: Multipart form data handling
- **ora**: Terminal spinners
- **chalk**: Terminal color output
- **cli-progress**: Progress bars
- **mime-types**: File type detection

### Building and Testing
```bash
# Install dependencies
npm install

# Run tests (if any)
npm test

# Install globally for development
npm run install-global
```

## License

MIT License - see LICENSE file for details.

## Support

For issues or questions:
1. Check this README for common solutions
2. Review the backend logs for detailed error information
3. Verify your backend configuration matches the expected API endpoints
4. Ensure all required environment variables are set on the backend 