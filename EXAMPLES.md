# Usage Examples

This document provides real-world usage scenarios and examples for the GCP Deploy CLI.

## Table of Contents

- [Getting Started](#getting-started)
- [Common Workflows](#common-workflows)
- [Troubleshooting Examples](#troubleshooting-examples)
- [Best Practices](#best-practices)
- [Advanced Scenarios](#advanced-scenarios)

## Getting Started

### Example 1: First-Time Setup

You have a Next.js app and want to deploy it to GCP for the first time.

```bash
# Navigate to your Next.js project
cd my-nextjs-app

# Make sure you have a Next.js app
ls package.json  # Should exist with next as a dependency

# Initialize GCP Deploy
gcp-deploy init

# Follow the prompts:
# ✓ GCP Project ID: my-project-123
# ✓ Select a region: us-central1 (Iowa)
# ✓ Service name: my-nextjs-app

# Deploy to production
gcp-deploy deploy --production
```

**Expected Output**:
```
GCP Deploy - Deploy Application

Deployment type: production
Service name: my-nextjs-app
Region: us-central1

✓ Pre-flight checks passed
Loaded 3 environment variables from .env

✓ Docker image built successfully
✓ Image pushed successfully
✓ Deployed to Cloud Run
✓ Public access configured

✓ Deployment successful!

Service URL:
  https://my-nextjs-app-xyz123.run.app
```

### Example 2: Quick Preview Deployment

You're working on a feature branch and want to create a preview deployment.

```bash
# Make sure you're on your feature branch
git checkout feature/new-ui

# Create a preview deployment
gcp-deploy deploy --preview
```

**Expected Output**:
```
Deployment type: preview
Service name: my-nextjs-app-feature-new-ui-a1b2c3d4
Region: us-central1

...

✓ Deployment successful!

Service URL:
  https://my-nextjs-app-feature-new-ui-a1b2c3d4-xyz.run.app

This is a preview deployment. To deploy to production, use:
  gcp-deploy deploy --production
```

## Common Workflows

### Example 3: Feature Development Workflow

Complete workflow from feature development to production.

```bash
# 1. Create and checkout feature branch
git checkout -b feature/user-profile

# 2. Make your changes
# ... edit code ...

# 3. Create preview deployment for testing
gcp-deploy deploy --preview

# 4. Test the preview URL
# Visit: https://my-app-feature-user-profile-xyz.run.app

# 5. Check logs if needed
gcp-deploy logs --deployment my-app-feature-user-profile-xyz123 --follow

# 6. Make more changes if needed
# ... edit code ...

# 7. Update the preview deployment
gcp-deploy deploy --preview

# 8. Once satisfied, merge to main
git checkout main
git merge feature/user-profile

# 9. Deploy to production
gcp-deploy deploy --production

# 10. Clean up the preview deployment
gcp-deploy remove my-app-feature-user-profile-xyz123
```

### Example 4: Monitoring Production

Regular production monitoring workflow.

```bash
# List all deployments
gcp-deploy list

# Check production logs
gcp-deploy logs --follow

# In another terminal, make a request
curl https://my-app-xyz.run.app/api/health

# Watch logs in real-time
# Press Ctrl+C to stop
```

### Example 5: Multiple Preview Deployments

Managing multiple feature branches simultaneously.

```bash
# Developer 1: Working on authentication
git checkout feature/auth
gcp-deploy deploy --preview
# URL: https://my-app-feature-auth-abc123.run.app

# Developer 2: Working on payment
git checkout feature/payment
gcp-deploy deploy --preview
# URL: https://my-app-feature-payment-def456.run.app

# List all deployments to see both
gcp-deploy list --preview

# Output:
# Preview Deployments:
#
#   my-app-feature-auth-abc123
#     URL:        https://my-app-feature-auth-abc123-xyz.run.app
#     Updated:    1/15/2024, 10:30:00 AM
#     Branch:     feature/auth
#
#   my-app-feature-payment-def456
#     URL:        https://my-app-feature-payment-def456-xyz.run.app
#     Updated:    1/15/2024, 11:45:00 AM
#     Branch:     feature/payment
```

## Troubleshooting Examples

### Example 6: Docker Not Running

**Scenario**: You try to deploy but Docker is not running.

```bash
gcp-deploy deploy --production
```

**Error**:
```
✗ Pre-flight checks failed
Error: Docker is not running.
Please start Docker and try again.
```

**Solution**:
```bash
# On macOS/Windows: Start Docker Desktop
# On Linux: Start Docker daemon
sudo systemctl start docker

# Verify Docker is running
docker ps

# Try again
gcp-deploy deploy --production
```

### Example 7: Authentication Issues

**Scenario**: gcloud CLI is not authenticated.

```bash
gcp-deploy deploy --production
```

**Error**:
```
✗ Pre-flight checks failed
Error: gcloud CLI is not authenticated.
Run gcloud auth login to authenticate.
```

**Solution**:
```bash
# Login to gcloud
gcloud auth login

# Set the project
gcloud config set project my-project-123

# Verify authentication
gcloud auth list

# Try again
gcp-deploy deploy --production
```

### Example 8: Missing APIs

**Scenario**: Required GCP APIs are not enabled.

```bash
gcp-deploy deploy --production
```

**Error**:
```
✗ Deployment failed

Error: ... Cloud Run API has not been used in project ...

Make sure the following APIs are enabled:
  - Cloud Run API
  - Artifact Registry API
  - Cloud Build API

You can enable them in the GCP Console or using:
  gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com
```

**Solution**:
```bash
# Enable all required APIs
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  logging.googleapis.com

# Wait a few seconds for APIs to be enabled
sleep 10

# Try again
gcp-deploy deploy --production
```

### Example 9: Build Failures

**Scenario**: Docker build fails due to missing dependencies.

```bash
gcp-deploy deploy --production
```

**Error**:
```
Building Docker image...
✗ Docker build failed
Error: npm ERR! Missing script: "build"
```

**Solution**:
```bash
# Check package.json has a build script
cat package.json | grep -A 2 '"scripts"'

# Should see:
# "scripts": {
#   "build": "next build",
#   ...
# }

# If missing, add it to package.json
# Then commit and try again
git add package.json
git commit -m "Add build script"
gcp-deploy deploy --production
```

### Example 10: Environment Variable Issues

**Scenario**: App deploys but crashes due to missing environment variables.

```bash
gcp-deploy deploy --production
# Deployment succeeds but app crashes

gcp-deploy logs --follow
```

**Logs show**:
```
ERROR    Error: DATABASE_URL is not defined
```

**Solution**:
```bash
# Create .env file
cat > .env << EOF
DATABASE_URL=postgresql://user:pass@host:5432/db
API_KEY=your-api-key-here
NEXT_PUBLIC_API_URL=https://api.example.com
EOF

# Deploy again (will load .env automatically)
gcp-deploy deploy --production

# Verify environment variables were loaded
# Look for: "Loaded 3 environment variables from .env"
```

## Best Practices

### Example 11: Proper .env Management

**Good Practice**:
```bash
# Create .env for local secrets
cat > .env << EOF
DATABASE_URL=postgresql://localhost:5432/myapp
API_KEY=dev-key-123
EOF

# Add .env to .gitignore (already done by gcp-deploy init)
echo ".env" >> .gitignore

# Create .env.example for documentation
cat > .env.example << EOF
DATABASE_URL=postgresql://user:password@host:5432/database
API_KEY=your-api-key
NEXT_PUBLIC_API_URL=https://api.example.com
EOF

# Commit .env.example
git add .env.example
git commit -m "Add environment variable template"
```

### Example 12: Preview Deployment Naming

**Good Practice**: Use descriptive branch names for better preview URLs.

```bash
# ✅ Good: Descriptive branch names
git checkout -b feature/user-authentication
gcp-deploy deploy --preview
# Service: my-app-feature-user-authentication-xyz

git checkout -b bugfix/payment-error
gcp-deploy deploy --preview
# Service: my-app-bugfix-payment-error-abc

# ❌ Bad: Generic branch names
git checkout -b branch1
gcp-deploy deploy --preview
# Service: my-app-branch1-xyz (not descriptive)
```

### Example 13: Regular Cleanup

**Good Practice**: Clean up old preview deployments.

```bash
# List all preview deployments
gcp-deploy list --preview

# Remove merged feature branches
gcp-deploy remove my-app-feature-old-feature-xyz123 --yes
gcp-deploy remove my-app-bugfix-old-bug-abc456 --yes

# Or interactive removal (safer)
gcp-deploy remove my-app-feature-something-xyz
# Confirms before deleting
```

### Example 14: Monitoring After Deployment

**Good Practice**: Always check logs after deploying.

```bash
# Deploy to production
gcp-deploy deploy --production

# Immediately check logs
gcp-deploy logs --follow

# In another terminal, test the deployment
curl https://my-app-xyz.run.app/
curl https://my-app-xyz.run.app/api/health

# Watch logs for any errors
# Press Ctrl+C when satisfied
```

## Advanced Scenarios

### Example 15: Deploying with Different Environment Variables

**Scenario**: Different env vars for preview vs production.

```bash
# For production: use .env
cat > .env << EOF
DATABASE_URL=postgresql://prod-db:5432/prod
API_KEY=prod-key
NEXT_PUBLIC_API_URL=https://api.example.com
EOF

gcp-deploy deploy --production

# For preview: use .env.preview (manual approach)
cat > .env << EOF
DATABASE_URL=postgresql://dev-db:5432/dev
API_KEY=dev-key
NEXT_PUBLIC_API_URL=https://dev-api.example.com
EOF

gcp-deploy deploy --preview

# Restore .env to production values
git checkout .env
```

### Example 16: Debugging Build Issues

**Scenario**: Build works locally but fails in deployment.

```bash
# Test the Docker build locally first
docker build -t my-app-test .

# Run it locally
docker run -p 3000:3000 my-app-test

# Visit http://localhost:3000

# If it works locally, try deploying
gcp-deploy deploy --production

# If deployment fails, check logs
gcp-deploy logs --deployment my-app --follow
```

### Example 17: Rolling Back a Deployment

**Scenario**: Production deployment has a bug, need to rollback.

```bash
# Option 1: Use Cloud Run Console
# Visit Cloud Console → Cloud Run → Select service → Revisions
# Route traffic to previous revision

# Option 2: Redeploy previous version
git checkout <previous-commit>
gcp-deploy deploy --production

# Option 3: Deploy from previous image
# (Manual via Cloud Console or gcloud CLI)
```

### Example 18: Multi-Project Setup

**Scenario**: Deploying the same app to different GCP projects.

```bash
# Development project
cd my-app
gcp-deploy init
# Project ID: my-app-dev
# Service name: my-app

gcp-deploy deploy --production

# Create separate config for staging
cp gcp-deploy.json gcp-deploy.staging.json
# Edit gcp-deploy.staging.json:
# - projectId: my-app-staging
# - serviceName: my-app-staging

# Deploy to staging (manual approach - requires code modification)
# Or use separate directories:

# Production
cd ~/projects/my-app-prod
gcp-deploy init  # my-app-prod project
gcp-deploy deploy --production

# Staging
cd ~/projects/my-app-staging
gcp-deploy init  # my-app-staging project
gcp-deploy deploy --production
```

### Example 19: Continuous Deployment Simulation

**Scenario**: Manual CI/CD workflow.

```bash
#!/bin/bash
# deploy.sh - Simple deployment script

set -e

echo "Starting deployment..."

# Run tests
npm test

# Build and deploy
gcp-deploy deploy --production

# Wait for deployment
sleep 10

# Health check
HEALTH_URL=$(gcp-deploy list --production | grep -o 'https://[^ ]*')
curl -f $HEALTH_URL/api/health || exit 1

echo "Deployment successful and healthy!"
```

Usage:
```bash
chmod +x deploy.sh
./deploy.sh
```

### Example 20: Large-Scale Preview Management

**Scenario**: Managing many preview deployments in a team.

```bash
# Team workflow script
#!/bin/bash
# preview-deploy.sh

BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [ "$BRANCH" = "main" ]; then
  echo "Cannot create preview from main branch"
  exit 1
fi

echo "Creating preview for branch: $BRANCH"
gcp-deploy deploy --preview

echo ""
echo "Preview deployments:"
gcp-deploy list --preview

echo ""
echo "To remove this preview later, run:"
echo "  gcp-deploy list --preview  # Find the service name"
echo "  gcp-deploy remove <service-name>"
```

## Summary of Common Commands

```bash
# Initial setup
gcp-deploy init

# Production deployment
gcp-deploy deploy --production

# Preview deployment
gcp-deploy deploy --preview
gcp-deploy deploy --preview --branch feature-xyz

# List deployments
gcp-deploy list
gcp-deploy list --production
gcp-deploy list --preview

# View logs
gcp-deploy logs
gcp-deploy logs --follow
gcp-deploy logs --deployment my-app-feature-xyz

# Remove deployment
gcp-deploy remove my-app-preview-xyz
gcp-deploy remove my-app-preview-xyz --yes

# Help
gcp-deploy --help
gcp-deploy deploy --help
```

## Tips and Tricks

1. **Alias for quick deployment**:
   ```bash
   alias gdp="gcp-deploy deploy --production"
   alias gdv="gcp-deploy deploy --preview"
   alias gdl="gcp-deploy list"
   ```

2. **Check deployment cost**:
   - Visit GCP Console → Billing
   - Filter by Cloud Run
   - Set up budget alerts

3. **Speed up builds**:
   - Use `.gcloudignore` to exclude large files
   - Docker layer caching works automatically
   - Keep dependencies updated

4. **Monitor performance**:
   - GCP Console → Cloud Run → Service → Metrics
   - View requests, latency, CPU, memory
   - Set up alerts for errors

5. **Custom domains** (manual setup):
   ```bash
   gcloud run services update my-app \
     --region us-central1 \
     --project my-project
   ```
   Then map domain in GCP Console.

## Getting Help

If you encounter issues:

1. Check the [README.md](README.md) for common solutions
2. Check the [ARCHITECTURE.md](ARCHITECTURE.md) for system details
3. View detailed logs: `gcp-deploy logs --follow`
4. Check GCP Console for service status
5. Verify all prerequisites are met

## Contributing Examples

Have a useful example? Please contribute:

1. Add it to this file
2. Follow the existing format
3. Include both the command and expected output
4. Explain the scenario clearly
