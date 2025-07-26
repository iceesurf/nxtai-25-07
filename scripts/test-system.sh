#!/bin/bash

# System validation script for NXT.AI Platform
set -e

ENV=${1:-dev}

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

PROJECT_ID="nxt-ai-$ENV"
BASE_URL="https://$PROJECT_ID.web.app"
FUNCTIONS_URL="https://us-central1-$PROJECT_ID.cloudfunctions.net"

log_info "🧪 Starting system validation for $ENV environment..."

# Test web application
test_web_app() {
    log_info "Testing web application..."
    
    # Test if main page loads
    if curl -f -s "$BASE_URL" > /dev/null; then
        log_success "Web application is accessible"
    else
        log_error "Web application is not accessible at $BASE_URL"
        return 1
    fi
    
    # Test if assets load (check for CSS)
    if curl -f -s "$BASE_URL" | grep -q "stylesheet"; then
        log_success "Web application assets are loading"
    else
        log_warning "Web application assets may not be loading correctly"
    fi
    
    # Test SPA routing (should return index.html for any route)
    if curl -f -s "$BASE_URL/dashboard" > /dev/null; then
        log_success "SPA routing is working"
    else
        log_warning "SPA routing may not be configured correctly"
    fi
}

# Test Firebase Functions
test_cloud_functions() {
    log_info "Testing Cloud Functions..."
    
    # List deployed functions
    FUNCTIONS=$(gcloud functions list --project="$PROJECT_ID" --format="value(name)" 2>/dev/null || echo "")
    
    if [[ -n "$FUNCTIONS" ]]; then
        log_success "Cloud Functions are deployed:"
        echo "$FUNCTIONS" | while read -r func; do
            echo "  - $func"
        done
    else
        log_warning "No Cloud Functions found or unable to list functions"
    fi
    
    # Test webhook endpoints (these will return 403/405 without proper auth, which is expected)
    log_info "Testing webhook endpoints availability..."
    
    # Test Dialogflow webhook
    DIALOGFLOW_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FUNCTIONS_URL/dialogflow" || echo "000")
    if [[ "$DIALOGFLOW_STATUS" =~ ^(200|405|403)$ ]]; then
        log_success "Dialogflow webhook is accessible (HTTP $DIALOGFLOW_STATUS)"
    else
        log_warning "Dialogflow webhook may not be accessible (HTTP $DIALOGFLOW_STATUS)"
    fi
    
    # Test WhatsApp webhook
    WHATSAPP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FUNCTIONS_URL/whatsapp" || echo "000")
    if [[ "$WHATSAPP_STATUS" =~ ^(200|405|403)$ ]]; then
        log_success "WhatsApp webhook is accessible (HTTP $WHATSAPP_STATUS)"
    else
        log_warning "WhatsApp webhook may not be accessible (HTTP $WHATSAPP_STATUS)"
    fi
}

# Test Firestore
test_firestore() {
    log_info "Testing Firestore..."
    
    # Check if Firestore is enabled
    if gcloud firestore databases list --project="$PROJECT_ID" --format="value(name)" 2>/dev/null | grep -q "default"; then
        log_success "Firestore database is active"
    else
        log_error "Firestore database is not found"
        return 1
    fi
    
    # Test security rules deployment
    if [[ -f "firestore.rules" ]]; then
        log_success "Firestore security rules file found"
    else
        log_warning "Firestore security rules file not found"
    fi
}

# Test BigQuery
test_bigquery() {
    log_info "Testing BigQuery..."
    
    # Check if dataset exists
    if bq ls -d --project_id="$PROJECT_ID" 2>/dev/null | grep -q "dialogflow_analytics"; then
        log_success "BigQuery dataset 'dialogflow_analytics' exists"
    else
        log_warning "BigQuery dataset 'dialogflow_analytics' not found"
    fi
    
    # List tables in dataset
    TABLES=$(bq ls --project_id="$PROJECT_ID" dialogflow_analytics 2>/dev/null || echo "")
    if [[ -n "$TABLES" ]]; then
        log_success "BigQuery tables found in dataset"
    else
        log_info "No tables found in BigQuery dataset (this is normal for new deployments)"
    fi
}

# Test IAM and Security
test_iam_security() {
    log_info "Testing IAM and Security..."
    
    # Check if service accounts exist
    SA_COUNT=$(gcloud iam service-accounts list --project="$PROJECT_ID" --format="value(email)" 2>/dev/null | wc -l || echo "0")
    if [[ "$SA_COUNT" -gt 0 ]]; then
        log_success "Service accounts are configured ($SA_COUNT found)"
    else
        log_warning "No custom service accounts found"
    fi
    
    # Check if APIs are enabled
    ENABLED_APIS=$(gcloud services list --enabled --project="$PROJECT_ID" --format="value(config.name)" 2>/dev/null | grep -E "(dialogflow|firebase|functions)" | wc -l || echo "0")
    if [[ "$ENABLED_APIS" -gt 0 ]]; then
        log_success "Required APIs are enabled ($ENABLED_APIS found)"
    else
        log_warning "Some required APIs may not be enabled"
    fi
}

# Test monitoring and logging
test_monitoring() {
    log_info "Testing monitoring and logging..."
    
    # Check if Cloud Logging is accessible
    if gcloud logging logs list --project="$PROJECT_ID" --limit=1 &>/dev/null; then
        log_success "Cloud Logging is accessible"
    else
        log_warning "Cloud Logging may not be accessible"
    fi
    
    # Check if Cloud Monitoring is enabled
    if gcloud services list --enabled --project="$PROJECT_ID" --filter="config.name:monitoring.googleapis.com" --format="value(config.name)" 2>/dev/null | grep -q "monitoring"; then
        log_success "Cloud Monitoring is enabled"
    else
        log_warning "Cloud Monitoring may not be enabled"
    fi
}

# Performance tests
run_performance_tests() {
    log_info "Running basic performance tests..."
    
    # Test web app load time
    START_TIME=$(date +%s%N)
    if curl -f -s "$BASE_URL" > /dev/null; then
        END_TIME=$(date +%s%N)
        LOAD_TIME=$(( (END_TIME - START_TIME) / 1000000 ))
        
        if [[ "$LOAD_TIME" -lt 3000 ]]; then
            log_success "Web app load time: ${LOAD_TIME}ms (Good)"
        elif [[ "$LOAD_TIME" -lt 5000 ]]; then
            log_warning "Web app load time: ${LOAD_TIME}ms (Acceptable)"
        else
            log_warning "Web app load time: ${LOAD_TIME}ms (Slow)"
        fi
    else
        log_error "Could not measure web app load time"
    fi
}

# Generate test report
generate_report() {
    log_info "Generating test report..."
    
    REPORT_FILE="test-report-$ENV-$(date +%Y%m%d-%H%M%S).txt"
    
    {
        echo "NXT.AI System Validation Report"
        echo "==============================="
        echo "Environment: $ENV"
        echo "Project ID: $PROJECT_ID"
        echo "Date: $(date)"
        echo "Base URL: $BASE_URL"
        echo ""
        echo "Test Summary:"
        echo "- Web Application: $(test_web_app >/dev/null 2>&1 && echo "✅ PASS" || echo "❌ FAIL")"
        echo "- Cloud Functions: $(test_cloud_functions >/dev/null 2>&1 && echo "✅ PASS" || echo "⚠️ PARTIAL")"
        echo "- Firestore: $(test_firestore >/dev/null 2>&1 && echo "✅ PASS" || echo "❌ FAIL")"
        echo "- BigQuery: $(test_bigquery >/dev/null 2>&1 && echo "✅ PASS" || echo "⚠️ PARTIAL")"
        echo "- IAM & Security: $(test_iam_security >/dev/null 2>&1 && echo "✅ PASS" || echo "⚠️ PARTIAL")"
        echo "- Monitoring: $(test_monitoring >/dev/null 2>&1 && echo "✅ PASS" || echo "⚠️ PARTIAL")"
        echo ""
        echo "Recommendations:"
        echo "- Monitor application logs for any errors"
        echo "- Set up alerting for critical metrics"
        echo "- Configure backup policies"
        echo "- Review security settings regularly"
    } > "$REPORT_FILE"
    
    log_success "Test report saved to: $REPORT_FILE"
}

# Display system information
display_system_info() {
    log_success "🎉 System validation completed!"
    echo ""
    log_info "System Information:"
    echo "  Environment: $ENV"
    echo "  Project ID: $PROJECT_ID"
    echo "  Web App: $BASE_URL"
    echo "  Functions: $FUNCTIONS_URL"
    echo ""
    log_info "Useful Links:"
    echo "  Firebase Console: https://console.firebase.google.com/project/$PROJECT_ID"
    echo "  GCP Console: https://console.cloud.google.com/home/dashboard?project=$PROJECT_ID"
    echo "  Cloud Logging: https://console.cloud.google.com/logs?project=$PROJECT_ID"
    echo ""
}

# Main validation process
main() {
    # Set gcloud project
    gcloud config set project "$PROJECT_ID" 2>/dev/null || log_warning "Could not set gcloud project"
    
    # Run all tests
    test_web_app
    test_cloud_functions
    test_firestore
    test_bigquery
    test_iam_security
    test_monitoring
    run_performance_tests
    generate_report
    display_system_info
}

# Handle errors
trap 'log_error "System validation encountered errors. Check the output above for details."; exit 1' ERR

# Run main function
main

log_success "System validation completed!"