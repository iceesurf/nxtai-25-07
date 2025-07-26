#!/bin/bash

# GCP Setup script for NXT.AI Platform
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

# Check if user is logged in to gcloud
check_gcloud_auth() {
    log_info "Checking gcloud authentication..."
    
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
        log_error "Please login to gcloud first: gcloud auth login"
        exit 1
    fi
    
    log_success "gcloud authentication verified"
}

# Create GCP projects
create_projects() {
    log_info "Creating GCP projects..."
    
    PROJECTS=("nxt-ai-dev" "nxt-ai-stg" "nxt-ai-prod")
    NAMES=("NXT AI Development" "NXT AI Staging" "NXT AI Production")
    
    for i in "${!PROJECTS[@]}"; do
        PROJECT_ID="${PROJECTS[$i]}"
        PROJECT_NAME="${NAMES[$i]}"
        
        log_info "Creating project: $PROJECT_ID"
        
        if gcloud projects describe "$PROJECT_ID" &>/dev/null; then
            log_warning "Project $PROJECT_ID already exists, skipping..."
        else
            gcloud projects create "$PROJECT_ID" --name="$PROJECT_NAME"
            log_success "Project $PROJECT_ID created"
        fi
    done
}

# Enable required APIs
enable_apis() {
    log_info "Enabling required APIs..."
    
    PROJECTS=("nxt-ai-dev" "nxt-ai-stg" "nxt-ai-prod")
    APIS=(
        "dialogflow.googleapis.com"
        "speech.googleapis.com"
        "texttospeech.googleapis.com"
        "translate.googleapis.com"
        "language.googleapis.com"
        "cloudfunctions.googleapis.com"
        "firestore.googleapis.com"
        "firebase.googleapis.com"
        "firebasehosting.googleapis.com"
        "pubsub.googleapis.com"
        "cloudscheduler.googleapis.com"
        "bigquery.googleapis.com"
        "monitoring.googleapis.com"
        "logging.googleapis.com"
        "secretmanager.googleapis.com"
        "cloudresourcemanager.googleapis.com"
        "iam.googleapis.com"
        "compute.googleapis.com"
        "cloudbuild.googleapis.com"
        "artifactregistry.googleapis.com"
    )
    
    for PROJECT_ID in "${PROJECTS[@]}"; do
        log_info "Enabling APIs for project: $PROJECT_ID"
        gcloud config set project "$PROJECT_ID"
        
        for API in "${APIS[@]}"; do
            log_info "Enabling $API..."
            gcloud services enable "$API" --quiet
        done
        
        log_success "APIs enabled for $PROJECT_ID"
    done
}

# Set up billing (you'll need to do this manually in the console)
setup_billing_reminder() {
    log_warning "⚠️  IMPORTANT: Billing Setup Required"
    echo ""
    echo "Please complete the following steps manually:"
    echo "1. Go to https://console.cloud.google.com/billing"
    echo "2. Create or select a billing account"
    echo "3. Link the following projects to billing:"
    echo "   - nxt-ai-dev"
    echo "   - nxt-ai-stg" 
    echo "   - nxt-ai-prod"
    echo ""
    echo "You can also use the CLI commands:"
    echo "  gcloud beta billing accounts list"
    echo "  gcloud beta billing projects link PROJECT_ID --billing-account=BILLING_ACCOUNT_ID"
    echo ""
}

# Create service accounts
create_service_accounts() {
    log_info "Creating service accounts..."
    
    PROJECTS=("nxt-ai-dev" "nxt-ai-stg" "nxt-ai-prod")
    
    for PROJECT_ID in "${PROJECTS[@]}"; do
        log_info "Creating service accounts for: $PROJECT_ID"
        gcloud config set project "$PROJECT_ID"
        
        # Dialogflow service account
        SA_NAME="dialogflow-webhook"
        SA_DISPLAY_NAME="Dialogflow Webhook Service Account"
        
        if gcloud iam service-accounts describe "${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" &>/dev/null; then
            log_warning "Service account $SA_NAME already exists in $PROJECT_ID"
        else
            gcloud iam service-accounts create "$SA_NAME" \
                --display-name="$SA_DISPLAY_NAME" \
                --description="Service account for Dialogflow webhooks"
            
            # Grant necessary roles
            gcloud projects add-iam-policy-binding "$PROJECT_ID" \
                --member="serviceAccount:${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
                --role="roles/dialogflow.client"
            
            gcloud projects add-iam-policy-binding "$PROJECT_ID" \
                --member="serviceAccount:${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
                --role="roles/firestore.user"
            
            log_success "Service account $SA_NAME created for $PROJECT_ID"
        fi
        
        # BigQuery service account
        SA_NAME="bigquery-analytics"
        SA_DISPLAY_NAME="BigQuery Analytics Service Account"
        
        if gcloud iam service-accounts describe "${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" &>/dev/null; then
            log_warning "Service account $SA_NAME already exists in $PROJECT_ID"
        else
            gcloud iam service-accounts create "$SA_NAME" \
                --display-name="$SA_DISPLAY_NAME" \
                --description="Service account for BigQuery analytics"
            
            # Grant necessary roles
            gcloud projects add-iam-policy-binding "$PROJECT_ID" \
                --member="serviceAccount:${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
                --role="roles/bigquery.dataEditor"
            
            gcloud projects add-iam-policy-binding "$PROJECT_ID" \
                --member="serviceAccount:${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
                --role="roles/bigquery.jobUser"
            
            log_success "Service account $SA_NAME created for $PROJECT_ID"
        fi
    done
}

# Create BigQuery datasets
create_bigquery_datasets() {
    log_info "Creating BigQuery datasets..."
    
    PROJECTS=("nxt-ai-dev" "nxt-ai-stg" "nxt-ai-prod")
    
    for PROJECT_ID in "${PROJECTS[@]}"; do
        log_info "Creating BigQuery dataset for: $PROJECT_ID"
        gcloud config set project "$PROJECT_ID"
        
        # Create dataset
        DATASET_ID="dialogflow_analytics"
        LOCATION="us-central1"
        
        if bq ls -d --project_id="$PROJECT_ID" | grep -q "$DATASET_ID"; then
            log_warning "Dataset $DATASET_ID already exists in $PROJECT_ID"
        else
            bq mk --dataset --location="$LOCATION" --project_id="$PROJECT_ID" "$DATASET_ID"
            log_success "Dataset $DATASET_ID created in $PROJECT_ID"
        fi
    done
}

# Setup Firebase projects (requires manual step)
setup_firebase_reminder() {
    log_warning "⚠️  Firebase Setup Required"
    echo ""
    echo "Please complete Firebase setup manually:"
    echo "1. Go to https://console.firebase.google.com"
    echo "2. For each GCP project (nxt-ai-dev, nxt-ai-stg, nxt-ai-prod):"
    echo "   - Click 'Add Project'"
    echo "   - Select the existing GCP project"
    echo "   - Enable Google Analytics (recommended for production only)"
    echo "   - Complete the setup wizard"
    echo ""
    echo "After Firebase setup is complete, run:"
    echo "  firebase login"
    echo "  firebase projects:list"
    echo ""
}

# Display summary
display_summary() {
    log_success "🎉 GCP setup completed successfully!"
    echo ""
    log_info "Created Projects:"
    echo "  - nxt-ai-dev (Development)"
    echo "  - nxt-ai-stg (Staging)"
    echo "  - nxt-ai-prod (Production)"
    echo ""
    log_info "Next Steps:"
    echo "  1. Set up billing for all projects"
    echo "  2. Complete Firebase setup"
    echo "  3. Configure Dialogflow CX agents"
    echo "  4. Set up monitoring and alerts"
    echo ""
    log_info "Useful Commands:"
    echo "  gcloud projects list"
    echo "  gcloud config set project PROJECT_ID"
    echo "  firebase projects:list"
    echo "  firebase use PROJECT_ID"
}

# Main setup process
main() {
    log_info "🚀 Starting GCP setup for NXT.AI Platform..."
    
    check_gcloud_auth
    create_projects
    enable_apis
    create_service_accounts
    create_bigquery_datasets
    setup_billing_reminder
    setup_firebase_reminder
    display_summary
}

# Handle errors
trap 'log_error "GCP setup failed! Check the logs above for details."; exit 1' ERR

# Run main function
main

log_success "GCP setup script completed!"