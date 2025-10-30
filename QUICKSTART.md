# Quick Start Guide

Get started with GCP Deploy CLI in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- Docker installed and running
- gcloud CLI installed
- GCP project with billing enabled

## 1. Install the CLI

```bash
cd gcp-deploy-cli
npm install
npm link
```

Verify installation:
```bash
gcp-deploy --version
```

## 2. Setup GCP

```bash
# Login to GCP
gcloud auth login
gcloud auth application-default login

# Set your project
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  logging.googleapis.com

# Create Artifact Registry repository
gcloud artifacts repositories create cloud-run-source-deploy \
  --repository-format=docker \
  --location=us-central1 \
  --description="Docker repository for Cloud Run"
```

## 3. Deploy Your First App

```bash
# Go to your Next.js project
cd my-nextjs-app

# Initialize GCP Deploy
gcp-deploy init

# Deploy to production
gcp-deploy deploy --production
```

## 4. Common Commands

```bash
# Create preview deployment
gcp-deploy deploy --preview

# List all deployments
gcp-deploy list

# View logs
gcp-deploy logs --follow

# Remove a deployment
gcp-deploy remove <service-name>
```

## Next Steps

- Read the [README.md](README.md) for detailed documentation
- Check out [EXAMPLES.md](EXAMPLES.md) for real-world scenarios
- Review [ARCHITECTURE.md](ARCHITECTURE.md) for system details

## Need Help?

- Docker not running? Start Docker Desktop
- gcloud not authenticated? Run `gcloud auth login`
- APIs not enabled? See setup commands above
- Build failing? Check your Next.js app has a build script in package.json

## Complete Example Session

```bash
# 1. Setup (one time)
npm install && npm link
gcloud auth login
gcloud config set project my-project-123
gcloud services enable run.googleapis.com artifactregistry.googleapis.com

# 2. Initialize your Next.js app
cd ~/my-nextjs-app
gcp-deploy init
# Follow prompts...

# 3. Deploy
gcp-deploy deploy --production
# Wait for deployment...
# ✓ Deployment successful!
# Service URL: https://my-app-xyz.run.app

# 4. Create a preview
git checkout -b feature/new-ui
# Make changes...
gcp-deploy deploy --preview
# Preview URL: https://my-app-feature-new-ui-abc123.run.app

# 5. Monitor
gcp-deploy logs --follow
# Press Ctrl+C to stop

# 6. List all deployments
gcp-deploy list

# 7. Clean up preview
gcp-deploy remove my-app-feature-new-ui-abc123
```

That's it! You're now deploying Next.js apps to GCP like a pro.
