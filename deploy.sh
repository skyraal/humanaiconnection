#!/bin/bash

# Human Connection Card Game - Deployment Script
# This script helps deploy and manage the game system

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

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_success "Docker is running"
}

# Function to check if Docker Compose is available
check_docker_compose() {
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose and try again."
        exit 1
    fi
    print_success "Docker Compose is available"
}

# Function to start the system
start_system() {
    print_status "Starting Human Connection Card Game system..."
    
    check_docker
    check_docker_compose
    
    # Build and start services
    print_status "Building and starting services..."
    docker-compose up -d --build
    
    # Wait for services to be ready
    print_status "Waiting for services to be ready..."
    sleep 10
    
    # Check service health
    print_status "Checking service health..."
    
    # Check Redis
    if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
        print_success "Redis is healthy"
    else
        print_warning "Redis health check failed"
    fi
    
    # Check server
    if curl -f http://localhost:3001/health > /dev/null 2>&1; then
        print_success "Server is healthy"
    else
        print_warning "Server health check failed"
    fi
    
    # Check client
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        print_success "Client is healthy"
    else
        print_warning "Client health check failed"
    fi
    
    print_success "System started successfully!"
    print_status "Access the game at: http://localhost"
    print_status "Admin dashboard at: http://localhost/admin"
    print_status "Server API at: http://localhost:3001"
}

# Function to stop the system
stop_system() {
    print_status "Stopping Human Connection Card Game system..."
    docker-compose down
    print_success "System stopped"
}

# Function to restart the system
restart_system() {
    print_status "Restarting Human Connection Card Game system..."
    stop_system
    start_system
}

# Function to show system status
show_status() {
    print_status "System status:"
    docker-compose ps
    
    print_status "Service logs (last 10 lines):"
    docker-compose logs --tail=10
}

# Function to show system logs
show_logs() {
    print_status "Showing system logs (press Ctrl+C to exit):"
    docker-compose logs -f
}

# Function to clean up the system
cleanup() {
    print_warning "This will remove all containers, volumes, and images. Are you sure? (y/N)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        print_status "Cleaning up system..."
        docker-compose down -v --rmi all
        print_success "Cleanup completed"
    else
        print_status "Cleanup cancelled"
    fi
}

# Function to show help
show_help() {
    echo "Human Connection Card Game - Deployment Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start     Start the system"
    echo "  stop      Stop the system"
    echo "  restart   Restart the system"
    echo "  status    Show system status"
    echo "  logs      Show system logs"
    echo "  cleanup   Clean up all containers and volumes"
    echo "  help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start      # Start the system"
    echo "  $0 status     # Check system status"
    echo "  $0 logs       # View logs"
}

# Main script logic
case "${1:-help}" in
    start)
        start_system
        ;;
    stop)
        stop_system
        ;;
    restart)
        restart_system
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    cleanup)
        cleanup
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac 