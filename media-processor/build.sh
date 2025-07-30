#!/bin/bash

# Media Processor Docker Build Script

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

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Function to build production image
build_production() {
    print_status "Building production Docker image..."
    docker build -t reedi-media-processor .
    print_success "Production image built successfully!"
}

# Function to build development image
build_development() {
    print_status "Building development Docker image..."
    docker build -f Dockerfile.dev -t reedi-media-processor:dev .
    print_success "Development image built successfully!"
}

# Function to run with docker-compose
run_compose() {
    local env_file=".env"
    
    if [ ! -f "$env_file" ]; then
        print_warning "No .env file found. Creating from template..."
        cp env.example .env
        print_warning "Please edit .env file with your configuration before running."
        exit 1
    fi
    
    print_status "Starting services with docker-compose..."
    docker-compose up -d
    
    print_success "Services started successfully!"
    print_status "Media Processor: http://localhost:8044"
    print_status "RabbitMQ Management: http://localhost:15672"
    print_status "View logs: docker-compose logs -f media-processor"
}

# Function to run development mode
run_development() {
    local env_file=".env"
    
    if [ ! -f "$env_file" ]; then
        print_warning "No .env file found. Creating from template..."
        cp env.example .env
        print_warning "Please edit .env file with your configuration before running."
        exit 1
    fi
    
    print_status "Starting development services..."
    docker-compose -f docker-compose.dev.yml up -d
    
    print_success "Development services started successfully!"
    print_status "Media Processor: http://localhost:8044"
    print_status "RabbitMQ Management: http://localhost:15672"
    print_status "View logs: docker-compose -f docker-compose.dev.yml logs -f media-processor"
}

# Function to stop services
stop_services() {
    print_status "Stopping services..."
    docker-compose down
    docker-compose -f docker-compose.dev.yml down 2>/dev/null || true
    print_success "Services stopped successfully!"
}

# Function to clean up
cleanup() {
    print_status "Cleaning up Docker resources..."
    docker-compose down -v
    docker-compose -f docker-compose.dev.yml down -v 2>/dev/null || true
    docker system prune -f
    print_success "Cleanup completed!"
}

# Function to show logs
show_logs() {
    print_status "Showing media processor logs..."
    docker-compose logs -f media-processor
}

# Function to show development logs
show_dev_logs() {
    print_status "Showing development logs..."
    docker-compose -f docker-compose.dev.yml logs -f media-processor
}

# Function to show help
show_help() {
    echo "Media Processor Docker Build Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  build-prod     Build production Docker image"
    echo "  build-dev      Build development Docker image"
    echo "  run            Run production services with docker-compose"
    echo "  run-dev        Run development services with hot reloading"
    echo "  stop           Stop all services"
    echo "  logs           Show production logs"
    echo "  logs-dev       Show development logs"
    echo "  cleanup        Clean up Docker resources"
    echo "  help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 build-prod  # Build production image"
    echo "  $0 run         # Start production services"
    echo "  $0 run-dev     # Start development services"
    echo "  $0 logs        # View logs"
}

# Main script logic
case "${1:-help}" in
    "build-prod")
        build_production
        ;;
    "build-dev")
        build_development
        ;;
    "run")
        run_compose
        ;;
    "run-dev")
        run_development
        ;;
    "stop")
        stop_services
        ;;
    "logs")
        show_logs
        ;;
    "logs-dev")
        show_dev_logs
        ;;
    "cleanup")
        cleanup
        ;;
    "help"|*)
        show_help
        ;;
esac 