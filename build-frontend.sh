#!/bin/bash

echo "🏗️  Building frontend static files..."

# Clean previous build
rm -rf .next out

# Build the static export
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Frontend build successful!"
    echo "🐳 Rebuilding Docker container..."
    
    # Rebuild the frontend container
    sudo docker compose build frontend
    
    if [ $? -eq 0 ]; then
        echo "✅ Docker container rebuilt successfully!"
        echo "🔄 Restarting containers..."
        
        # Restart containers
        sudo docker compose up -d
        
        if [ $? -eq 0 ]; then
            echo "🎉 Frontend updated and deployed successfully!"
            echo "🌐 Access your app at: http://localhost"
        else
            echo "❌ Failed to restart containers"
            exit 1
        fi
    else
        echo "❌ Failed to rebuild Docker container"
        exit 1
    fi
else
    echo "❌ Frontend build failed"
    exit 1
fi 