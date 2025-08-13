#!/bin/bash

# Example script showing how to use the reedi-upload utility
# Make sure to replace the placeholder values with your actual credentials

echo "🚀 Reedi Bulk Upload Example"
echo "=============================="

# Configuration - UPDATE THESE VALUES
BACKEND_URL="localhost:8088"
USER_EMAIL="s.finch@fanjango.com.hk"
USER_PASSWORD="XxxxxxxxY"

# Example 1: Upload a few images with metadata
echo ""
echo "📸 Example 1: Uploading images with metadata"
echo "----------------------------------------------"
node reedi-upload.js \
  --backend "$BACKEND_URL" \
  --user "$USER_EMAIL" \
  --password "$USER_PASSWORD" \
  --title "Edinburgh Vacation Photos" \
  --tags "edinburgh,vacation,scotland,2024" \
  --description "Photos from our trip to Edinburgh in 2024" \
  photo1.jpg photo2.jpg photo3.jpg

# Example 2: Upload mixed media types
echo ""
echo "🎬 Example 2: Uploading mixed media types"
echo "------------------------------------------"
node reedi-upload.js \
  --backend "$BACKEND_URL" \
  --user "$USER_EMAIL" \
  --password "$USER_PASSWORD" \
  --title "Family Memories" \
  --tags "family,memories,2024" \
  image1.JPG video1.MP4 image2.PNG video2.mov

# Example 3: Simple upload without metadata
echo ""
echo "📁 Example 3: Simple upload without metadata"
echo "--------------------------------------------"
node reedi-upload.js \
  --backend "$BACKEND_URL" \
  --user "$USER_EMAIL" \
  --password "$USER_PASSWORD" \
  *.jpg *.mp4

echo ""
echo "✅ Examples completed!"
echo ""
echo "💡 Tips:"
echo "  - Use 'node reedi-upload.js --help' to see all options"
echo "  - Files larger than 5MB are automatically chunked"
echo "  - Check the README.md for detailed usage information" 