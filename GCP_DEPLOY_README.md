# Google Cloud Run Deployment Guide

This guide explains how to deploy the Legal SahAI backend to Google Cloud Run with **autoscaling** and **zero-downtime** deployments.

## 🎯 Key Features

- ✅ **Autoscaling**: Automatically scales from 1 to 10 instances based on traffic
- ✅ **Zero Downtime**: Uses traffic splitting for gradual rollouts
- ✅ **High Availability**: Cloud Run manages load balancing and failover
- ✅ **Cost Efficient**: Pay only for actual usage (CPU/memory during requests)
- ✅ **Global CDN**: Automatic HTTPS with Google's global load balancer

## 📋 Prerequisites

1. **Google Cloud Account** with billing enabled
2. **gcloud CLI** installed ([Download](https://cloud.google.com/sdk/docs/install))
3. **Docker** installed and running
4. **PowerShell 5.1+** (Windows) or **PowerShell Core** (cross-platform)

## 🚀 Quick Start

### Step 1: Install and Configure gcloud

```powershell
# Install gcloud CLI (if not already installed)
# Download from: https://cloud.google.com/sdk/docs/install

# Initialize gcloud
gcloud init

# Set your project
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### Step 2: Configure Docker for GCR

```powershell
# Authenticate Docker with Google Container Registry
gcloud auth configure-docker
```

### Step 3: Deploy Using PowerShell Script

```powershell
# Navigate to backend directory
cd d:\Gen-Ai\backend

# Run deployment script (interactive)
.\deploy-cloudrun.ps1

# Or specify parameters
.\deploy-cloudrun.ps1 -ProjectId "your-project-id" -Region "us-central1" -MinInstances 1 -MaxInstances 10

# For automatic traffic migration (use with caution)
.\deploy-cloudrun.ps1 -AutoMigrateTraffic
```

### Step 4: Test and Migrate Traffic

After deployment, the script creates a **candidate** revision without sending traffic to it.

```powershell
# Test the candidate URL (provided by the script)
curl https://candidate---legal-sahai-backend-xxxxx.run.app/api/health

# If tests pass, gradually migrate traffic:

# 10% to new revision
gcloud run services update-traffic legal-sahai-backend --to-revisions=LATEST=10 --region=us-central1

# 50% to new revision
gcloud run services update-traffic legal-sahai-backend --to-revisions=LATEST=50 --region=us-central1

# 100% to new revision (full rollout)
gcloud run services update-traffic legal-sahai-backend --to-latest --region=us-central1
```

## 🔧 Manual Deployment (Without Script)

### Option 1: Using gcloud CLI Directly

```powershell
cd d:\Gen-Ai\backend

# Build and push image
$PROJECT_ID = "your-project-id"
$IMAGE = "gcr.io/$PROJECT_ID/legal-sahai-backend:$(Get-Date -Format 'yyyyMMddHHmmss')"

docker build -t $IMAGE .
docker push $IMAGE

# Deploy to Cloud Run
gcloud run deploy legal-sahai-backend `
  --image=$IMAGE `
  --region=us-central1 `
  --platform=managed `
  --allow-unauthenticated `
  --port=5000 `
  --min-instances=1 `
  --max-instances=10 `
  --cpu=2 `
  --memory=2Gi `
  --timeout=300 `
  --concurrency=80 `
  --no-traffic `
  --tag=candidate
```

### Option 2: Using Cloud Build

```powershell
# Submit build to Cloud Build
gcloud builds submit --config=cloudbuild.yaml --region=us-central1
```

## 🔐 Environment Variables and Secrets

### Set Environment Variables in Cloud Run

```powershell
gcloud run services update legal-sahai-backend `
  --update-env-vars="NODE_ENV=production,PORT=5000" `
  --region=us-central1
```

### Use Secret Manager for Sensitive Data

```powershell
# Create a secret
echo "your-mongodb-connection-string" | gcloud secrets create mongodb-uri --data-file=-

# Grant Cloud Run access to the secret
gcloud secrets add-iam-policy-binding mongodb-uri `
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" `
  --role="roles/secretmanager.secretAccessor"

# Mount secret as environment variable
gcloud run services update legal-sahai-backend `
  --update-secrets="MONGODB_URI=mongodb-uri:latest" `
  --region=us-central1
```

## 📊 Monitoring and Logs

### View Logs

```powershell
# Real-time logs
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=legal-sahai-backend" --format=json

# Recent logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=legal-sahai-backend" --limit=50 --format=json
```

### Monitor Metrics

```powershell
# Open Cloud Console monitoring
gcloud run services describe legal-sahai-backend --region=us-central1 --format="value(status.url)"

# View in GCP Console
# https://console.cloud.google.com/run/detail/REGION/SERVICE_NAME/metrics
```

## 🔄 CI/CD Integration

### GitHub Actions Example

Create `.github/workflows/deploy-cloudrun.yml`:

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches:
      - main
    paths:
      - 'backend/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - id: 'auth'
        uses: 'google-github-actions/auth@v1'
        with:
          credentials_json: '${{ secrets.GCP_SA_KEY }}'
      
      - name: 'Set up Cloud SDK'
        uses: 'google-github-actions/setup-gcloud@v1'
      
      - name: 'Submit to Cloud Build'
        run: |
          gcloud builds submit --config=backend/cloudbuild.yaml --region=us-central1
```

### Automated Traffic Migration with Approval

Modify `cloudbuild.yaml` to add a manual approval step:

```yaml
# Add after deployment step
- name: 'gcr.io/cloud-builders/gcloud'
  entrypoint: 'bash'
  args:
    - '-c'
    - |
      echo "New revision deployed. Approve traffic migration in GCP Console:"
      echo "https://console.cloud.google.com/run/detail/$_REGION/legal-sahai-backend"
```

## 🌍 Multi-Region High Availability

Deploy to multiple regions for higher availability:

```powershell
# Deploy to multiple regions
$regions = @("us-central1", "europe-west1", "asia-east1")

foreach ($region in $regions) {
  gcloud run deploy legal-sahai-backend `
    --image=gcr.io/PROJECT_ID/legal-sahai-backend:latest `
    --region=$region `
    --platform=managed `
    --allow-unauthenticated `
    --min-instances=1 `
    --max-instances=10
}

# Set up Global Load Balancer (requires manual setup in Console)
# Follow: https://cloud.google.com/load-balancing/docs/https/setup-global-ext-https-serverless
```

## 🔧 Autoscaling Configuration

### Adjust Scaling Parameters

```powershell
# Update min/max instances
gcloud run services update legal-sahai-backend `
  --min-instances=2 `
  --max-instances=20 `
  --region=us-central1

# Set CPU allocation (always vs request-based)
gcloud run services update legal-sahai-backend `
  --cpu-throttling `
  --region=us-central1

# Set concurrency (requests per instance)
gcloud run services update legal-sahai-backend `
  --concurrency=100 `
  --region=us-central1
```

### Cost Optimization

```powershell
# For low-traffic services (min 0, scale to zero)
gcloud run services update legal-sahai-backend `
  --min-instances=0 `
  --max-instances=10 `
  --region=us-central1

# For high-availability (keep warm instances)
gcloud run services update legal-sahai-backend `
  --min-instances=2 `
  --max-instances=20 `
  --region=us-central1
```

## 🛡️ Security Best Practices

1. **Use Secret Manager** for all sensitive data (DB passwords, API keys)
2. **Enable IAM Authentication** (remove `--allow-unauthenticated` for internal services)
3. **Use Custom Service Accounts** with least privilege
4. **Enable Cloud Armor** for DDoS protection
5. **Use VPC Connector** for private database access

```powershell
# Create VPC connector for MongoDB Atlas private link
gcloud compute networks vpc-access connectors create mongodb-connector `
  --region=us-central1 `
  --range=10.8.0.0/28

# Update service to use VPC connector
gcloud run services update legal-sahai-backend `
  --vpc-connector=mongodb-connector `
  --region=us-central1
```

## 🔙 Rollback

```powershell
# List revisions
gcloud run revisions list --service=legal-sahai-backend --region=us-central1

# Rollback to previous revision
gcloud run services update-traffic legal-sahai-backend `
  --to-revisions=legal-sahai-backend-00003-xyz=100 `
  --region=us-central1
```

## 💰 Cost Estimation

Cloud Run pricing (as of 2025):
- **CPU**: $0.00002400 per vCPU-second
- **Memory**: $0.00000250 per GiB-second
- **Requests**: $0.40 per million requests
- **Free tier**: 2 million requests/month

Example monthly cost for moderate traffic:
- 1M requests/month
- 500ms average response time
- 2 vCPU, 2GiB memory
- **Estimated cost**: ~$15-25/month

## 📞 Support and Troubleshooting

### Common Issues

**Issue**: "Permission denied" errors
```powershell
# Solution: Enable required APIs and check IAM permissions
gcloud projects add-iam-policy-binding PROJECT_ID `
  --member="user:YOUR_EMAIL" `
  --role="roles/run.admin"
```

**Issue**: Container fails to start
```powershell
# Solution: Check logs
gcloud logging read "resource.type=cloud_run_revision" --limit=50 --format=json

# Check if PORT environment variable is set correctly
gcloud run services describe legal-sahai-backend --region=us-central1 --format="value(spec.template.spec.containers[0].env)"
```

**Issue**: High latency or timeouts
```powershell
# Solution: Increase timeout and resources
gcloud run services update legal-sahai-backend `
  --timeout=600 `
  --cpu=4 `
  --memory=4Gi `
  --region=us-central1
```

## 📚 Additional Resources

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Best Practices for Cloud Run](https://cloud.google.com/run/docs/tips)
- [Cloud Run Pricing](https://cloud.google.com/run/pricing)
- [Monitoring and Logging](https://cloud.google.com/run/docs/logging)

## 🎉 Success Checklist

- [ ] gcloud CLI installed and configured
- [ ] Docker authenticated with GCR
- [ ] Environment variables and secrets configured
- [ ] Deployment script executed successfully
- [ ] Candidate revision tested
- [ ] Traffic gradually migrated
- [ ] Monitoring and alerting configured
- [ ] Backup and rollback plan documented
