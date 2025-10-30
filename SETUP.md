# Setup Guide

Quick guide to get the GCP Deploy CLI up and running.

## Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Link the CLI Locally (for testing)

```bash
npm link
```

This makes the `gcp-deploy` command available globally on your system.

### 3. Verify Installation

```bash
gcp-deploy --version
# Should output: 1.0.0

gcp-deploy --help
# Should show all available commands
```

## Prerequisites Setup

### 1. Install gcloud CLI

**macOS**:
```bash
brew install google-cloud-sdk
```

**Linux**:
```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

**Windows**:
Download from: https://cloud.google.com/sdk/docs/install

### 2. Authenticate with GCP

```bash
gcloud auth login
gcloud auth application-default login
```

### 3. Set Your GCP Project

```bash
gcloud config set project YOUR_PROJECT_ID
```

### 4. Enable Required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  logging.googleapis.com
```

### 5. Create Artifact Registry Repository

```bash
# Replace with your region and project ID
gcloud artifacts repositories create cloud-run-source-deploy \
  --repository-format=docker \
  --location=us-central1 \
  --description="Docker repository for Cloud Run deployments"
```

### 6. Verify Docker is Running

```bash
docker --version
docker ps
```

If Docker is not running, start Docker Desktop (macOS/Windows) or the Docker daemon (Linux).

## Testing the CLI

### 1. Create a Test Next.js App

```bash
# Create a new Next.js app for testing
npx create-next-app@latest my-test-app
cd my-test-app
```

### 2. Initialize GCP Deploy

```bash
gcp-deploy init
```

Follow the prompts:
- **GCP Project ID**: Your GCP project ID
- **Region**: Choose a region (e.g., us-central1)
- **Service name**: Accept default or enter custom name

### 3. Deploy to Production

```bash
gcp-deploy deploy --production
```

This will:
1. Build a Docker image
2. Push to Artifact Registry
3. Deploy to Cloud Run
4. Display the service URL

### 4. Test Other Commands

```bash
# List deployments
gcp-deploy list

# View logs
gcp-deploy logs --follow

# Create a preview deployment
git checkout -b test-feature
gcp-deploy deploy --preview

# Remove preview deployment
gcp-deploy list --preview  # Get the service name
gcp-deploy remove <service-name>
```

## Troubleshooting Setup

### Issue: "gcp-deploy: command not found"

**Solution**: Run `npm link` again or check your PATH:
```bash
npm link
echo $PATH  # Should include npm global bin directory
```

### Issue: "Docker daemon is not running"

**Solution**: Start Docker:
- macOS/Windows: Open Docker Desktop
- Linux: `sudo systemctl start docker`

### Issue: "gcloud: command not found"

**Solution**: Install gcloud CLI and restart your terminal.

### Issue: "API has not been used in project"

**Solution**: Enable the required APIs:
```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com
```

### Issue: "Permission denied" errors

**Solution**: Make sure your GCP account has the required roles:
```bash
# Check your current account
gcloud auth list

# Add required roles (ask your GCP admin or use Owner role for testing)
```

## Uninstalling

To remove the global link:

```bash
npm unlink -g gcp-deploy-cli
```

## Publishing to npm (Future)

When ready to publish:

1. Update package.json with your details
2. Create npm account: https://www.npmjs.com/signup
3. Login: `npm login`
4. Publish: `npm publish`

Then users can install with:
```bash
npm install -g gcp-deploy-cli
```

## Next Steps

1. Read [README.md](README.md) for detailed usage
2. Check [EXAMPLES.md](EXAMPLES.md) for real-world scenarios
3. Review [ARCHITECTURE.md](ARCHITECTURE.md) to understand the system

## Support

- Issues with the CLI? Check the troubleshooting section
- Issues with GCP? Check [Cloud Run Documentation](https://cloud.google.com/run/docs)
- Issues with Next.js? Check [Next.js Documentation](https://nextjs.org/docs)
