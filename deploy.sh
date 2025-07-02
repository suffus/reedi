#!/bin/bash

# Reedi Docker Deployment Script
# Usage: ./deploy.sh [dev|prod]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_success "Docker is running"
}

# Check if Docker Compose is available
check_docker_compose() {
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install it and try again."
        exit 1
    fi
    print_success "Docker Compose is available"
}

# Check environment file
check_env_file() {
    if [ ! -f ".env.production" ]; then
        print_warning "Production environment file not found. Creating from template..."
        if [ -f ".env.production.example" ]; then
            cp .env.production.example .env.production
            print_warning "Please edit .env.production with your configuration before continuing."
            print_warning "Press Enter when ready to continue..."
            read
        else
            print_error "No environment template found. Please create .env.production manually."
            exit 1
        fi
    fi
}

# Build images
build_images() {
    print_status "Building Docker images..."
    docker-compose build
    print_success "Images built successfully"
}

# Start services
start_services() {
    local profile=$1
    print_status "Starting services with profile: $profile"
    
    if [ "$profile" = "prod" ]; then
        docker-compose --profile production up -d
    else
        docker-compose up -d
    fi
    
    print_success "Services started successfully"
}

# Wait for services to be ready
wait_for_services() {
    print_status "Waiting for services to be ready..."
    
    # Wait for database
    print_status "Waiting for database..."
    timeout=60
    while [ $timeout -gt 0 ]; do
        if docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
            print_success "Database is ready"
            break
        fi
        sleep 2
        timeout=$((timeout - 2))
    done
    
    if [ $timeout -le 0 ]; then
        print_error "Database failed to start within 60 seconds"
        exit 1
    fi
    
    # Wait for backend
    print_status "Waiting for backend..."
    timeout=60
    while [ $timeout -gt 0 ]; do
        if curl -f http://localhost:8088/health > /dev/null 2>&1; then
            print_success "Backend is ready"
            break
        fi
        sleep 2
        timeout=$((timeout - 2))
    done
    
    if [ $timeout -le 0 ]; then
        print_error "Backend failed to start within 60 seconds"
        exit 1
    fi
    
    # Wait for frontend
    print_status "Waiting for frontend..."
    timeout=60
    while [ $timeout -gt 0 ]; do
        if curl -f http://localhost:3000 > /dev/null 2>&1; then
            print_success "Frontend is ready"
            break
        fi
        sleep 2
        timeout=$((timeout - 2))
    done
    
    if [ $timeout -le 0 ]; then
        print_error "Frontend failed to start within 60 seconds"
        exit 1
    fi
}

# Show service status
show_status() {
    print_status "Service Status:"
    docker-compose ps
    
    echo ""
    print_status "Access URLs:"
    echo "  Frontend: http://localhost:3000"
    echo "  Backend API: http://localhost:8088"
    echo "  Database: localhost:5432"
    
    if [ "$1" = "prod" ]; then
        echo "  Nginx: http://localhost:80"
        echo "  HTTPS: https://localhost:443 (if configured)"
    fi
}

# Main deployment function
deploy() {
    local environment=$1
    
    print_status "Starting Reedi deployment for environment: $environment"
    
    # Pre-flight checks
    check_docker
    check_docker_compose
    check_env_file
    
    # Stop existing services
    print_status "Stopping existing services..."
    docker-compose down --remove-orphans
    
    # Build and start
    build_images
    start_services $environment
    
    # Wait for services
    wait_for_services
    
    # Show final status
    show_status $environment
    
    print_success "Deployment completed successfully!"
}

# Show usage
show_usage() {
    echo "Usage: $0 [dev|prod]"
    echo ""
    echo "  dev   - Deploy for development (no nginx)"
    echo "  prod  - Deploy for production (with nginx)"
    echo ""
    echo "Examples:"
    echo "  $0 dev   # Deploy development environment"
    echo "  $0 prod  # Deploy production environment"
}

# Main script logic
case "${1:-}" in
    "dev")
        deploy "dev"
        ;;
    "prod")
        deploy "prod"
        ;;
    *)
        show_usage
        exit 1
        ;;
esac 