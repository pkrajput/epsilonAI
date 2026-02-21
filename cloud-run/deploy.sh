#!/bin/bash
set -e

PROJECT_ID="epsilonai-29b8c"
SERVICE_NAME="scan-service"
REGION="us-central1"

echo ""
echo "  Deploying epsilonAI scan service to Cloud Run"
echo "  Project: $PROJECT_ID"
echo "  Region:  $REGION"
echo ""

# Build and push the container image
echo "→ Building container image..."
gcloud builds submit \
  --project "$PROJECT_ID" \
  --tag "gcr.io/$PROJECT_ID/$SERVICE_NAME" \
  .

# Deploy to Cloud Run
echo "→ Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --image "gcr.io/$PROJECT_ID/$SERVICE_NAME" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --memory 4Gi \
  --cpu 2 \
  --timeout 600 \
  --max-instances 5 \
  --min-instances 0 \
  --set-env-vars "NODE_ENV=production"

# Get the service URL
URL=$(gcloud run services describe "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --platform managed \
  --region "$REGION" \
  --format "value(status.url)")

echo ""
echo "  ✓ Deployed successfully!"
echo "  Service URL: $URL"
echo ""
echo "  Next step: update SCAN_API in index.html to:"
echo "  var SCAN_API = '$URL';"
echo ""
