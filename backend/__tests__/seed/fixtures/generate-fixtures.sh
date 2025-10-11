#!/bin/bash

# Script to generate test media fixtures
# This creates test images and videos of various sizes and formats

set -e

FIXTURES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGES_DIR="$FIXTURES_DIR/images"
VIDEOS_DIR="$FIXTURES_DIR/videos"

echo "🎨 Generating test media fixtures..."

# Create directories
mkdir -p "$IMAGES_DIR"
mkdir -p "$VIDEOS_DIR"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Generate test images
echo ""
echo "📸 Generating test images..."

if command_exists convert; then
    # Using ImageMagick to generate test images
    
    # Small JPEG (800x600, ~100KB)
    convert -size 800x600 xc:white \
        -fill blue -draw "rectangle 100,100 700,500" \
        -fill yellow -draw "circle 400,300 450,350" \
        -pointsize 40 -fill black -gravity center \
        -annotate +0+0 "Test Image Small\n800x600" \
        -quality 85 "$IMAGES_DIR/test-image-small.jpg"
    echo "✅ Created test-image-small.jpg (800x600)"
    
    # Medium JPEG (1920x1080, ~500KB)
    convert -size 1920x1080 xc:white \
        -fill green -draw "rectangle 200,200 1720,880" \
        -fill red -draw "circle 960,540 1100,680" \
        -pointsize 60 -fill white -gravity center \
        -annotate +0+0 "Test Image Medium\n1920x1080" \
        -quality 90 "$IMAGES_DIR/test-image-medium.jpg"
    echo "✅ Created test-image-medium.jpg (1920x1080)"
    
    # Large JPEG (4000x3000, ~2MB)
    convert -size 4000x3000 xc:white \
        -fill purple -draw "rectangle 400,400 3600,2600" \
        -fill orange -draw "circle 2000,1500 2300,1800" \
        -pointsize 100 -fill white -gravity center \
        -annotate +0+0 "Test Image Large\n4000x3000" \
        -quality 92 "$IMAGES_DIR/test-image-large.jpg"
    echo "✅ Created test-image-large.jpg (4000x3000)"
    
    # PNG format
    convert -size 1024x768 xc:white \
        -fill cyan -draw "rectangle 150,150 874,618" \
        -fill magenta -draw "circle 512,384 600,450" \
        -pointsize 50 -fill black -gravity center \
        -annotate +0+0 "Test PNG\n1024x768" \
        "$IMAGES_DIR/test-image.png"
    echo "✅ Created test-image.png (1024x768)"
    
    # GIF format (animated)
    convert -size 400x300 xc:white \
        -fill red -draw "circle 200,150 250,200" \
        -pointsize 30 -fill black -gravity center \
        -annotate +0+0 "Frame 1" \
        \( -size 400x300 xc:white \
           -fill blue -draw "circle 200,150 250,200" \
           -pointsize 30 -fill white -gravity center \
           -annotate +0+0 "Frame 2" \) \
        -delay 50 -loop 0 "$IMAGES_DIR/test-image.gif"
    echo "✅ Created test-image.gif (400x300, animated)"
    
    # Progressive JPEG
    convert -size 1280x720 xc:white \
        -fill teal -draw "rectangle 150,100 1130,620" \
        -pointsize 50 -fill white -gravity center \
        -annotate +0+0 "Progressive JPEG\n1280x720" \
        -interlace Plane -quality 90 "$IMAGES_DIR/test-progressive.jpg"
    echo "✅ Created test-progressive.jpg (1280x720, progressive)"
    
else
    echo "⚠️  ImageMagick (convert) not found. Skipping image generation."
    echo "   Install with: brew install imagemagick (macOS) or apt-get install imagemagick (Linux)"
fi

# Generate test videos
echo ""
echo "🎥 Generating test videos..."

if command_exists ffmpeg; then
    # Short MP4 (10 seconds, 720p, ~5MB)
    ffmpeg -f lavfi -i testsrc=duration=10:size=1280x720:rate=30 \
        -f lavfi -i sine=frequency=1000:duration=10 \
        -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k \
        -y "$VIDEOS_DIR/test-video-short.mp4" 2>/dev/null
    echo "✅ Created test-video-short.mp4 (10s, 720p)"
    
    # Medium MP4 (30 seconds, 1080p, ~20MB)
    ffmpeg -f lavfi -i testsrc=duration=30:size=1920x1080:rate=30 \
        -f lavfi -i sine=frequency=800:duration=30 \
        -c:v libx264 -preset fast -crf 22 -c:a aac -b:a 192k \
        -y "$VIDEOS_DIR/test-video-medium.mp4" 2>/dev/null
    echo "✅ Created test-video-medium.mp4 (30s, 1080p)"
    
    # WebM format (10 seconds, 720p)
    ffmpeg -f lavfi -i testsrc=duration=10:size=1280x720:rate=30 \
        -f lavfi -i sine=frequency=600:duration=10 \
        -c:v libvpx-vp9 -b:v 1M -c:a libopus -b:a 128k \
        -y "$VIDEOS_DIR/test-video.webm" 2>/dev/null
    echo "✅ Created test-video.webm (10s, 720p)"
    
    # MOV format (10 seconds, 720p)
    ffmpeg -f lavfi -i testsrc=duration=10:size=1280x720:rate=30 \
        -f lavfi -i sine=frequency=1200:duration=10 \
        -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k \
        -y "$VIDEOS_DIR/test-video.mov" 2>/dev/null
    echo "✅ Created test-video.mov (10s, 720p)"
    
else
    echo "⚠️  FFmpeg not found. Skipping video generation."
    echo "   Install with: brew install ffmpeg (macOS) or apt-get install ffmpeg (Linux)"
fi

echo ""
echo "✅ Fixture generation complete!"
echo ""
echo "Generated files:"
ls -lh "$IMAGES_DIR" 2>/dev/null || true
ls -lh "$VIDEOS_DIR" 2>/dev/null || true
echo ""

