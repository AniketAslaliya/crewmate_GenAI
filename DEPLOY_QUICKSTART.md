# 🚀 Quick Deploy Commands - Legal SahAI Backend to Cloud Run

## One-Time Setup (First Deployment)

```powershell
# 1. Install gcloud CLI (if not installed)
# Download from: https://cloud.google.com/sdk/docs/install

# 2. Initialize and authenticate
gcloud init
gcloud auth login

# 3. Set your project
gcloud config set project YOUR_PROJECT_ID

# 4. Enable required APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com containerregistry.googleapis.com

# 5. Configure Docker
gcloud auth configure-docker
```

## Deploy with PowerShell Script (Recommended)

```powershell
# Navigate to backend folder
cd d:\Gen-Ai\backend

# Run deployment (interactive)
.\deploy-cloudrun.ps1

# Or with parameters
.\deploy-cloudrun.ps1 -ProjectId "your-project-id" -Region "us-central1" -MinInstances 1 -MaxInstances 10
```

## Quick Manual Deploy

```powershell
cd d:\Gen-Ai\backend

# Set variables
$PROJECT_ID = "your-project-id"
$SERVICE = "legal-sahai-backend"
$REGION = "us-central1"
$IMAGE = "gcr.io/$PROJECT_ID/$SERVICE:latest"

# Build, push, and deploy in one go
gcloud builds submit --tag $IMAGE
gcloud run deploy $SERVICE --image $IMAGE --region $REGION --platform managed --allow-unauthenticated --port 5000 --min-instances 1 --max-instances 10 --cpu 2 --memory 2Gi
```

## Environment Variables Setup

```powershell
# Set environment variables
gcloud run services update legal-sahai-backend `
  --update-env-vars="NODE_ENV=production,PORT=5000,MONGODB_URI=your-mongodb-uri" `
  --region=us-central1

# Or use Secret Manager (recommended for sensitive data)
echo "your-secret-value" | gcloud secrets create SECRET_NAME --data-file=-
gcloud run services update legal-sahai-backend `
  --update-secrets="SECRET_NAME=SECRET_NAME:latest" `
  --region=us-central1
```

## Traffic Management

```powershell
# Deploy without traffic (for testing)
gcloud run deploy legal-sahai-backend --no-traffic --tag=candidate --region=us-central1

# Gradually migrate traffic
gcloud run services update-traffic legal-sahai-backend --to-revisions=LATEST=10 --region=us-central1  # 10%
gcloud run services update-traffic legal-sahai-backend --to-revisions=LATEST=50 --region=us-central1  # 50%
gcloud run services update-traffic legal-sahai-backend --to-latest --region=us-central1              # 100%

# Rollback
gcloud run services update-traffic legal-sahai-backend --to-revisions=REVISION_NAME=100 --region=us-central1
```

## Monitoring

```powershell
# View service details
gcloud run services describe legal-sahai-backend --region=us-central1

# View logs (real-time)
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=legal-sahai-backend"

# View recent logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=legal-sahai-backend" --limit=50

# Get service URL
gcloud run services describe legal-sahai-backend --region=us-central1 --format="value(status.url)"
```

## Scaling Configuration

```powershell
# Update autoscaling
gcloud run services update legal-sahai-backend `
  --min-instances=2 `
  --max-instances=20 `
  --concurrency=80 `
  --cpu=4 `
  --memory=4Gi `
  --timeout=300 `
  --region=us-central1
```

## Troubleshooting

```powershell
# List all revisions
gcloud run revisions list --service=legal-sahai-backend --region=us-central1

# Describe specific revision
gcloud run revisions describe REVISION_NAME --region=us-central1

# Delete old revisions (keeps last 10 by default)
gcloud run revisions delete REVISION_NAME --region=us-central1

# Check service status
gcloud run services describe legal-sahai-backend --region=us-central1 --format="value(status.conditions)"
```

## Cost Management

```powershell
# Set min instances to 0 for cost savings (cold starts)
gcloud run services update legal-sahai-backend --min-instances=0 --region=us-central1

# Set min instances to 1+ for no cold starts (higher cost)
gcloud run services update legal-sahai-backend --min-instances=2 --region=us-central1

# Check current pricing
# Visit: https://cloud.google.com/run/pricing
```

## CI/CD Integration

```powershell
# Manual trigger with Cloud Build
gcloud builds submit --config=cloudbuild.yaml --region=us-central1

# Connect GitHub repo for automatic builds
# Visit: https://console.cloud.google.com/cloud-build/triggers
```

---

## 📊 Expected Results

After successful deployment:

- ✅ Service URL: `https://legal-sahai-backend-xxxxx.run.app`
- ✅ Autoscaling: 1-10 instances based on load
- ✅ Zero downtime: Traffic splitting enabled
- ✅ HTTPS: Automatic SSL certificate
- ✅ Monitoring: Logs and metrics in GCP Console

## 🆘 Need Help?

Full documentation: `GCP_DEPLOY_README.md`

Common issues:
- **Permission denied**: Run `gcloud auth login` and check IAM roles
- **Build failed**: Check `Dockerfile` and ensure all dependencies are in `package.json`
- **Container won't start**: Verify `PORT` environment variable and server listens on `0.0.0.0`
- **High costs**: Reduce `min-instances` to 0 or lower `max-instances`
