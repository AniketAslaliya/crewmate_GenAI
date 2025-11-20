# PowerShell script to deploy Legal SahAI Backend to Google Cloud Run
# This script provides a zero-downtime deployment with traffic splitting

param(
    [Parameter(Mandatory=$false)]
    [string]$ProjectId = "",
    
    [Parameter(Mandatory=$false)]
    [string]$Region = "us-central1",
    
    [Parameter(Mandatory=$false)]
    [string]$ServiceName = "legal-sahai-backend",
    
    [Parameter(Mandatory=$false)]
    [int]$MinInstances = 1,
    
    [Parameter(Mandatory=$false)]
    [int]$MaxInstances = 10,
    
    [Parameter(Mandatory=$false)]
    [switch]$AutoMigrateTraffic = $false
)

# Color output functions
function Write-Success { param($Message) Write-Host $Message -ForegroundColor Green }
function Write-Info { param($Message) Write-Host $Message -ForegroundColor Cyan }
function Write-Warning { param($Message) Write-Host $Message -ForegroundColor Yellow }
function Write-Error { param($Message) Write-Host $Message -ForegroundColor Red }

Write-Info "========================================="
Write-Info "Legal SahAI Backend - Cloud Run Deployment"
Write-Info "========================================="
Write-Host ""

# Check if gcloud is installed
try {
    $null = Get-Command gcloud -ErrorAction Stop
} catch {
    Write-Error "Error: gcloud CLI is not installed or not in PATH"
    Write-Info "Please install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
}

# Get or verify project ID
if ([string]::IsNullOrEmpty($ProjectId)) {
    $ProjectId = gcloud config get-value project 2>$null
    if ([string]::IsNullOrEmpty($ProjectId)) {
        Write-Error "Error: No GCP project ID specified and no default project set"
        Write-Info "Please run: gcloud config set project YOUR_PROJECT_ID"
        exit 1
    }
}

Write-Info "Using GCP Project: $ProjectId"
Write-Info "Region: $Region"
Write-Info "Service Name: $ServiceName"
Write-Host ""

# Confirm deployment
Write-Warning "This will deploy the backend to Cloud Run. Continue? (Y/N)"
$confirmation = Read-Host
if ($confirmation -ne 'Y' -and $confirmation -ne 'y') {
    Write-Info "Deployment cancelled."
    exit 0
}

Write-Host ""
Write-Info "Step 1/5: Building Docker image..."
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$imageTag = "gcr.io/$ProjectId/${ServiceName}:$timestamp"
$imageLatest = "gcr.io/$ProjectId/${ServiceName}:latest"

docker build -t $imageTag -t $imageLatest -f Dockerfile .
if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker build failed!"
    exit 1
}
Write-Success "✓ Docker image built successfully"

Write-Host ""
Write-Info "Step 2/5: Pushing image to Google Container Registry..."
docker push $imageTag
if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker push failed!"
    exit 1
}
docker push $imageLatest
Write-Success "✓ Image pushed to GCR"

Write-Host ""
Write-Info "Step 3/5: Deploying to Cloud Run..."

# Check if service exists
$serviceExists = gcloud run services describe $ServiceName --region=$Region --project=$ProjectId 2>$null

if ($serviceExists) {
    Write-Info "Updating existing service (no traffic to new revision)..."
    gcloud run deploy $ServiceName `
        --image=$imageTag `
        --region=$Region `
        --platform=managed `
        --allow-unauthenticated `
        --port=5000 `
        --min-instances=$MinInstances `
        --max-instances=$MaxInstances `
        --cpu=2 `
        --memory=2Gi `
        --timeout=300 `
        --concurrency=80 `
        --no-traffic `
        --tag=candidate `
        --project=$ProjectId
} else {
    Write-Info "Creating new service (will receive traffic immediately)..."
    gcloud run deploy $ServiceName `
        --image=$imageTag `
        --region=$Region `
        --platform=managed `
        --allow-unauthenticated `
        --port=5000 `
        --min-instances=$MinInstances `
        --max-instances=$MaxInstances `
        --cpu=2 `
        --memory=2Gi `
        --timeout=300 `
        --concurrency=80 `
        --project=$ProjectId
}

if ($LASTEXITCODE -ne 0) {
    Write-Error "Cloud Run deployment failed!"
    exit 1
}
Write-Success "✓ New revision deployed (tagged as 'candidate')"

Write-Host ""
Write-Info "Step 4/5: Getting candidate URL..."
$candidateUrl = gcloud run services describe $ServiceName `
    --region=$Region `
    --platform=managed `
    --format="value(status.traffic[0].url)" `
    --project=$ProjectId 2>$null

if ([string]::IsNullOrEmpty($candidateUrl)) {
    # Fallback: construct URL manually
    $candidateUrl = "https://candidate---$ServiceName-$(gcloud run services describe $ServiceName --region=$Region --format='value(status.url)' --project=$ProjectId 2>$null | Select-String -Pattern 'https://(.+)' | ForEach-Object { $_.Matches.Groups[1].Value })"
}

Write-Success "✓ Candidate revision URL: $candidateUrl"
Write-Info "Test the candidate revision before migrating traffic"

Write-Host ""
if ($AutoMigrateTraffic) {
    Write-Info "Step 5/5: Migrating 100% traffic to new revision..."
    gcloud run services update-traffic $ServiceName `
        --to-latest `
        --region=$Region `
        --project=$ProjectId
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Traffic migration failed!"
        exit 1
    }
    Write-Success "✓ Traffic migrated to new revision"
} else {
    Write-Warning "Step 5/5: Manual traffic migration required"
    Write-Info "To gradually migrate traffic, use:"
    Write-Host ""
    Write-Host "  # Migrate 10% traffic to test" -ForegroundColor Yellow
    Write-Host "  gcloud run services update-traffic $ServiceName --to-revisions=LATEST=10 --region=$Region --project=$ProjectId" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  # Migrate 50% traffic" -ForegroundColor Yellow
    Write-Host "  gcloud run services update-traffic $ServiceName --to-revisions=LATEST=50 --region=$Region --project=$ProjectId" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  # Migrate 100% traffic" -ForegroundColor Yellow
    Write-Host "  gcloud run services update-traffic $ServiceName --to-latest --region=$Region --project=$ProjectId" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host ""
Write-Success "========================================="
Write-Success "Deployment Complete!"
Write-Success "========================================="
Write-Info "Service URL: $(gcloud run services describe $ServiceName --region=$Region --format='value(status.url)' --project=$ProjectId 2>$null)"
Write-Host ""
Write-Info "To view logs:"
Write-Host "  gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=$ServiceName' --limit=50 --format=json --project=$ProjectId" -ForegroundColor Yellow
Write-Host ""
Write-Info "To rollback if needed:"
Write-Host "  gcloud run services update-traffic $ServiceName --to-revisions=PREVIOUS_REVISION=100 --region=$Region --project=$ProjectId" -ForegroundColor Yellow
