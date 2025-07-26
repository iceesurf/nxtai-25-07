#!/bin/bash

# Backup script for NXT.AI Production
set -e

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

# Configuration
PROJECT_ID="nxt-ai-prod-1"
BACKUP_BUCKET="gs://nxt-ai-prod-backups"
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_PREFIX="firestore_backup_${DATE}"

log_info "🔄 Starting backup for production database..."

# Check if gcloud is installed and authenticated
if ! command -v gcloud &> /dev/null; then
    log_error "Google Cloud SDK is required but not installed"
    exit 1
fi

# Verify authentication
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    log_error "Not authenticated with Google Cloud. Run 'gcloud auth login'"
    exit 1
fi

# Set project
gcloud config set project $PROJECT_ID

# Create Firestore backup
log_info "Creating Firestore backup..."
gcloud firestore export $BACKUP_BUCKET/$BACKUP_PREFIX

log_success "Firestore backup created: $BACKUP_BUCKET/$BACKUP_PREFIX"

# List recent backups
log_info "Recent backups:"
gsutil ls -l $BACKUP_BUCKET/ | tail -10

# Cleanup old backups (keep last 30 days)
log_info "Cleaning up old backups..."
CUTOFF_DATE=$(date -d "30 days ago" +"%Y%m%d")
gsutil ls $BACKUP_BUCKET/ | while read backup; do
    BACKUP_DATE=$(echo $backup | grep -o '[0-9]\{8\}' | head -1)
    if [[ "$BACKUP_DATE" < "$CUTOFF_DATE" ]]; then
        log_info "Removing old backup: $backup"
        gsutil -m rm -r "$backup"
    fi
done

log_success "🎉 Backup completed successfully!"
log_info "Backup location: $BACKUP_BUCKET/$BACKUP_PREFIX"