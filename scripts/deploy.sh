#!/bin/bash

# Deploy script for NXT.AI Platform
set -e

ENV=${1:-dev}
FORCE=${2:-false}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Validate environment
if [[ ! "$ENV" =~ ^(dev|stg|prod)$ ]]; then
    log_error "Invalid environment. Use: dev, stg, or prod"
    exit 1
fi

log_info "🚀 Starting deployment to $ENV environment..."

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        log_error "Node.js is required but not installed"
        exit 1
    fi
    
    # Check if Firebase CLI is installed
    if ! command -v firebase &> /dev/null; then
        log_error "Firebase CLI is required but not installed"
        exit 1
    fi
    
    # Check if gcloud is installed
    if ! command -v gcloud &> /dev/null; then
        log_error "Google Cloud SDK is required but not installed"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    npm ci
    log_success "Dependencies installed"
}

# Build packages
build_packages() {
    log_info "Building packages..."
    
    # Build shared package
    log_info "Building shared package..."
    npm run build:shared
    
    # Build web application
    log_info "Building web application..."
    VITE_APP_ENV=$ENV npm run build:web
    
    # Build functions
    log_info "Building Cloud Functions..."
    npm run build:functions
    
    log_success "All packages built successfully"
}

# Deploy to Firebase
deploy_firebase() {
    log_info "Deploying to Firebase..."
    
    # Set Firebase project
    firebase use $ENV
    
    # Deploy with appropriate flags
    if [[ "$FORCE" == "true" ]]; then
        firebase deploy --only hosting,functions,firestore,storage --force
    else
        firebase deploy --only hosting,functions,firestore,storage
    fi
    
    log_success "Firebase deployment completed"
}

# Run post-deployment tests
post_deployment_tests() {
    log_info "Running post-deployment tests..."
    
    # Wait for deployment to propagate
    sleep 10
    
    # Test if hosting is accessible
    PROJECT_ID="nxt-ai-$ENV"
    URL="https://$PROJECT_ID.web.app/"
    
    if curl -f -s "$URL" > /dev/null; then
        log_success "Application is accessible at $URL"
    else
        log_warning "Application may not be fully accessible yet"
    fi
    
    # Test Cloud Functions endpoints
    FUNCTIONS_URL="https://us-central1-$PROJECT_ID.cloudfunctions.net"
    
    # Test basic function health check if available
    if curl -f -s "$FUNCTIONS_URL/health" > /dev/null 2>&1; then
        log_success "Cloud Functions are responsive"
    else
        log_info "Functions deployed to: $FUNCTIONS_URL"
    fi
    
    log_success "Post-deployment tests completed"
}

# Display deployment information
display_info() {
    log_success "🎉 Deployment to $ENV completed successfully!"
    echo ""
    log_info "Deployment Information:"
    echo "  Environment: $ENV"
    echo "  Project ID: nxt-ai-$ENV"
    echo "  Web App: https://nxt-ai-$ENV.web.app/"
    echo "  Firebase Console: https://console.firebase.google.com/project/nxt-ai-$ENV"
    echo ""
    log_info "Next steps:"
    echo "  1. Test the application thoroughly"
    echo "  2. Monitor logs for any issues"
    echo "  3. Update DNS if needed (for production)"
}

# Main deployment process
main() {
    check_prerequisites
    install_dependencies
    build_packages
    deploy_firebase
    post_deployment_tests
    display_info
}

# Handle errors
trap 'log_error "Deployment failed! Check the logs above for details."; exit 1' ERR

# Run main function
main

log_success "Deployment script completed!"