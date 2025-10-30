# GCP Deploy CLI

A Vercel-like CLI tool for deploying Next.js applications to Google Cloud Platform with zero configuration.

## Features

- **Zero Configuration**: Simple setup with interactive prompts
- **Production & Preview Deployments**: Support for both production and branch-based preview deployments
- **Multi-stage Docker Builds**: Optimized Dockerfile with standalone Next.js output
- **Real-time Logs**: Stream logs from Cloud Logging with color-coded severity levels
- **Environment Variables**: Automatic .env file support
- **Deployment Management**: List, monitor, and remove deployments easily

## Prerequisites

Before using this tool, make sure you have:

1. **Node.js 18+** installed
2. **Docker** installed and running
3. **gcloud CLI** installed
4. **GCP Project** with billing enabled

**That's it!** The `gcp-deploy init` command will automatically:
- ✅ Authenticate with gcloud (if needed)
- ✅ Set your GCP project
- ✅ Enable required APIs (Cloud Run, Artifact Registry, Cloud Build, Logging)
- ✅ Create Artifact Registry repository
- ✅ Configure Docker authentication

### Required IAM Permissions

Your GCP user or service account needs:

- Cloud Run Admin
- Storage Admin (for Artifact Registry)
- Logs Viewer
- Service Usage Admin (to enable APIs automatically)

## Installation

### Local Development

Clone this repository and install dependencies:

```bash
git clone <repository-url>
cd gcp-deploy-cli
npm install
npm link
```

### Global Installation (after publishing)

```bash
npm install -g gcp-deploy-cli
```

## Quick Start

1. **Navigate to your Next.js project**:

```bash
cd my-nextjs-app
```

2. **Initialize GCP Deploy**:

```bash
gcp-deploy init
```

This will automatically:
- Authenticate with gcloud (if not already authenticated)
- Set your GCP project
- Enable required APIs
- Create Artifact Registry repository
- Configure Docker authentication
- Prompt you for GCP project ID, region, and service name
- Generate `gcp-deploy.json` configuration
- Create an optimized `Dockerfile` (Node 20, multi-stage, AMD64 platform)
- Create `cloudbuild.yaml` for Cloud Build
- Create `.gcloudignore` file
- Update/create `next.config.js` with standalone output mode

3. **Deploy to production**:

```bash
gcp-deploy deploy --production
```

4. **Create a preview deployment**:

```bash
gcp-deploy deploy --preview
```

## Commands

### `gcp-deploy init`

Initialize a new project with GCP deployment configuration.

**Interactive Prompts**:
- GCP Project ID
- Region (us-central1, us-east1, etc.)
- Service name

**Generated Files**:
- `gcp-deploy.json` - Project configuration
- `Dockerfile` - Multi-stage Docker build
- `cloudbuild.yaml` - Cloud Build configuration
- `.gcloudignore` - Files to exclude from deployment
- `next.config.js` - Updated with standalone output (if needed)

### `gcp-deploy deploy`

Deploy your application to Cloud Run.

**Options**:
- `-p, --production` - Deploy to production
- `--preview` - Create a preview deployment
- `-b, --branch <name>` - Specify branch name for preview

**Examples**:

```bash
# Deploy to production
gcp-deploy deploy --production

# Create preview deployment
gcp-deploy deploy --preview

# Create preview deployment for specific branch
gcp-deploy deploy --preview --branch feature-xyz
```

**What happens during deployment**:
1. Pre-flight checks (Docker running, gcloud authenticated)
2. Docker authentication with Artifact Registry
3. Load environment variables from `.env`
4. Build Docker image (AMD64 platform for Cloud Run compatibility)
5. Push image to Artifact Registry
6. Deploy to Cloud Run using gcloud CLI
7. Configure public access (--allow-unauthenticated)
8. Display service URL

### `gcp-deploy list`

List all deployments.

**Options**:
- `--production` - Show only production deployments
- `--preview` - Show only preview deployments

**Example**:

```bash
# List all deployments
gcp-deploy list

# List only production deployments
gcp-deploy list --production

# List only preview deployments
gcp-deploy list --preview
```

### `gcp-deploy logs`

Stream logs from Cloud Logging.

**Options**:
- `-f, --follow` - Follow log output (stream in real-time)
- `-d, --deployment <id>` - Specify which deployment to show logs for

**Examples**:

```bash
# Show recent logs for production
gcp-deploy logs

# Follow logs in real-time
gcp-deploy logs --follow

# Show logs for specific deployment
gcp-deploy logs --deployment my-app-feature-xyz-abc123

# Follow logs for specific deployment
gcp-deploy logs --follow --deployment my-app-feature-xyz-abc123
```

**Log Display**:
- Timestamps in local time
- Color-coded severity levels (DEBUG, INFO, WARNING, ERROR, CRITICAL)
- Press Ctrl+C to stop following logs

### `gcp-deploy remove <deployment>`

Delete a deployment.

**Options**:
- `-y, --yes` - Skip confirmation prompt

**Examples**:

```bash
# Remove a preview deployment (with confirmation)
gcp-deploy remove my-app-feature-xyz-abc123

# Remove without confirmation
gcp-deploy remove my-app-feature-xyz-abc123 --yes
```

## Configuration

### Project Configuration (`gcp-deploy.json`)

Created by `gcp-deploy init` in your project root:

```json
{
  "projectId": "my-gcp-project",
  "region": "us-central1",
  "serviceName": "my-app",
  "artifactRegistry": "us-central1-docker.pkg.dev/my-gcp-project/cloud-run-source-deploy",
  "version": "1.0"
}
```

### Global Configuration (`~/.gcp-deploy/config.json`)

Stores global preferences (currently minimal):

```json
{
  "lastUsedProject": "my-gcp-project"
}
```

### Deployment History (`.gcp-deploy-history.json`)

Tracks deployment metadata locally (in your project):

```json
{
  "deployments": [
    {
      "serviceName": "my-app",
      "type": "production",
      "branch": "main",
      "url": "https://my-app-xxx.run.app",
      "image": "us-central1-docker.pkg.dev/...",
      "region": "us-central1",
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

## Environment Variables

Place a `.env` file in your project root:

```env
DATABASE_URL=postgresql://...
API_KEY=your-api-key
NEXT_PUBLIC_API_URL=https://api.example.com
```

These will be automatically loaded and passed to Cloud Run during deployment.

**Note**: The `.env` file is excluded from the Docker build via `.gcloudignore`.

## Docker Configuration

The generated `Dockerfile` uses:

- **Multi-stage build** (deps, builder, runner)
- **Node 20 Alpine** for Next.js compatibility
- **AMD64 platform** for Cloud Run compatibility (works on Apple Silicon Macs)
- **Automatic package manager detection** (npm, yarn, pnpm)
- **Next.js standalone output** for optimized production builds
- **Non-root user** (nextjs:nodejs) for security
- **Port 3000** exposed

## Preview Deployments

Preview deployments use the naming pattern:

```
{serviceName}-{sanitized-branch}-{8-char-id}
```

Examples:
- `my-app-feature-auth-a1b2c3d4`
- `my-app-bugfix-login-x9y8z7w6`

Each preview deployment gets:
- Unique Cloud Run service
- Unique URL
- Independent scaling and configuration

## Troubleshooting

### Docker not running

```
Error: Docker is not running.
Please start Docker and try again.
```

**Solution**: Start Docker Desktop or Docker daemon.

### gcloud not authenticated

```
Error: gcloud CLI is not authenticated.
```

**Solution**: Run `gcp-deploy init` again - it will automatically prompt you to authenticate.

Or manually:
```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
```

### API not enabled

The `gcp-deploy init` command automatically enables all required APIs. If you see this error:

```
Error: ... API has not been used in project ...
```

**Solution**: Run `gcp-deploy init` again to enable APIs automatically.

Or manually:
```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com logging.googleapis.com
```

### Permission denied

```
Error: ... 403 Forbidden ...
```

**Solution**: Make sure your account has the required IAM roles:
- Cloud Run Admin
- Storage Admin
- Logs Viewer

### Build fails with "Lockfile not found"

**Solution**: Make sure you have a lock file committed:
- `package-lock.json` (npm)
- `yarn.lock` (yarn)
- `pnpm-lock.yaml` (pnpm)

### Deployment succeeds but app doesn't work

**Common issues**:
1. Missing `output: "standalone"` in `next.config.js`
2. Environment variables not set correctly
3. Port mismatch (app must listen on port 3000)

Check logs:
```bash
gcp-deploy logs --follow
```

## Cost Estimation

Cloud Run pricing (as of 2024):

- **CPU**: $0.00002400 per vCPU-second
- **Memory**: $0.00000250 per GiB-second
- **Requests**: $0.40 per million requests
- **Free tier**: 2 million requests/month, 360,000 GiB-seconds, 180,000 vCPU-seconds

Artifact Registry:
- **Storage**: $0.10 per GB/month
- **Free tier**: 0.5 GB

**Typical costs for a small app**:
- Low traffic (~10k requests/month): Free tier
- Medium traffic (~100k requests/month): $5-15/month
- High traffic (~1M requests/month): $50-100/month

## Limitations

- **Next.js only**: This tool is optimized for Next.js projects
- **Cloud Run only**: Does not support other GCP compute options
- **Single region**: Each deployment is in one region
- **No custom domains**: You'll need to configure custom domains in GCP Console
- **No automatic rollbacks**: Manual rollback via Cloud Run Console

## Links

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Artifact Registry](https://cloud.google.com/artifact-registry/docs)
- [Cloud Logging](https://cloud.google.com/logging/docs)

## License

MIT
