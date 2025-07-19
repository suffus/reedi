#!/bin/bash

# Build script for production deployment
set -e

echo "🚀 Building Reedi for production..."

# Build Next.js application
echo "📦 Building Next.js application..."
npm run build

# Create out directory for static files
echo "📁 Preparing static files..."
mkdir -p out

# Copy static files from .next/static to out/_next/static
cp -r .next/static out/_next/static

# Copy public files
cp -r public/* out/ 2>/dev/null || true

# Copy any static pages that should be served by nginx
# (You can add more static files here as needed)

echo "✅ Build completed successfully!"
echo "📋 Next steps:"
echo "   1. Run: docker-compose up --build"
echo "   2. Access the application at: http://localhost" 