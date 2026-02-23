#!/bin/bash
set -e

PROJECT_ID="epsilonai-29b8c"
SERVICE_NAME="scan-service"
REGION="us-central1"
REPO_NAME="epsilonai"
IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}"

echo ""
echo "  Deploying epsilonAI scan service to Cloud Run"
echo "  Project: $PROJECT_ID"
echo "  Region:  $REGION"
echo "  Image:   $IMAGE_URI"
echo ""

# Ensure Artifact Registry repo exists
if ! gcloud artifacts repositories describe "$REPO_NAME" --project "$PROJECT_ID" --location "$REGION" >/dev/null 2>&1; then
  echo "→ Creating Artifact Registry repo '$REPO_NAME'..."
  gcloud artifacts repositories create "$REPO_NAME" \
    --project "$PROJECT_ID" \
    --location "$REGION" \
    --repository-format docker \
    --description "epsilonAI container images"
fi

# Build and push the container image
echo "→ Building container image..."
gcloud builds submit \
  --project "$PROJECT_ID" \
  --tag "$IMAGE_URI" \
  .

# Deploy to Cloud Run
echo "→ Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --image "$IMAGE_URI" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --memory 4Gi \
  --cpu 2 \
  --no-cpu-throttling \
  --timeout 600 \
  --max-instances 5 \
  --min-instances 0 \
  --set-env-vars "NODE_ENV=production,CODEQL_BIN=/opt/codeql/codeql"

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
