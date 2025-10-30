# Architecture Documentation

## System Overview

GCP Deploy CLI is a command-line tool that simplifies deploying Next.js applications to Google Cloud Run. It provides a Vercel-like experience with zero-configuration deployments, preview deployments, and built-in monitoring.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User's Machine                          │
│                                                                 │
│  ┌────────────┐      ┌──────────────┐      ┌───────────────┐  │
│  │  CLI Tool  │─────▶│    Docker    │─────▶│ gcloud CLI    │  │
│  │ (Node.js)  │      │    Engine    │      │               │  │
│  └────────────┘      └──────────────┘      └───────────────┘  │
│         │                                            │          │
└─────────┼────────────────────────────────────────────┼──────────┘
          │                                            │
          ▼                                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Google Cloud Platform                        │
│                                                                 │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │  Artifact       │  │   Cloud Run      │  │   Cloud       │ │
│  │  Registry       │  │   Services       │  │   Logging     │ │
│  │  (Images)       │◀─│  (Containers)    │─▶│   (Logs)      │ │
│  └─────────────────┘  └──────────────────┘  └───────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. CLI Entry Point (`src/index.js`)

**Responsibilities**:
- Parse command-line arguments using Commander.js
- Route to appropriate command handlers
- Global error handling
- Display help and version information

**Flow**:
```
User Command → Commander.js → Command Handler → Exit
```

### 2. Command Modules

Located in `src/commands/`:

#### `init.js`
**Purpose**: Initialize project with GCP configuration

**Process Flow**:
```
1. Check if already initialized
2. Verify Next.js project (package.json)
3. Interactive prompts (project ID, region, service name)
4. Generate configuration files:
   - gcp-deploy.json
   - Dockerfile
   - cloudbuild.yaml
   - .gcloudignore
5. Update/create next.config.js
```

#### `deploy.js`
**Purpose**: Build and deploy application to Cloud Run

**Process Flow**:
```
1. Read project config
2. Determine deployment type (production/preview)
3. Pre-flight checks:
   - Docker running?
   - gcloud authenticated?
   - Configure Docker auth
4. Parse .env file
5. Build Docker image
6. Tag and push to Artifact Registry
7. Deploy/update Cloud Run service
8. Configure public IAM policy
9. Save deployment to history
10. Display service URL
```

**Preview Deployment Logic**:
```
if production flag:
    serviceName = config.serviceName
else if preview flag OR branch != main:
    serviceName = {serviceName}-{branch}-{uniqueId}
else:
    serviceName = config.serviceName (default to production)
```

#### `list.js`
**Purpose**: List all deployments

**Process Flow**:
```
1. Fetch all Cloud Run services
2. Filter by service name pattern
3. Match with local deployment history
4. Categorize (production/preview)
5. Apply filters (--production, --preview)
6. Display formatted list
```

#### `logs.js`
**Purpose**: Stream logs from Cloud Logging

**Process Flow**:
```
1. Determine service name (default: production)
2. Connect to Cloud Logging API
3. If follow mode:
   - Poll for new entries every 2 seconds
   - Handle Ctrl+C gracefully
4. If one-time:
   - Fetch recent 100 entries
   - Display and exit
5. Format with color-coded severity
```

#### `remove.js`
**Purpose**: Delete a deployment

**Process Flow**:
```
1. Validate deployment name
2. Check if production (warn user)
3. Show deployment info
4. Confirm deletion (unless --yes)
5. Delete Cloud Run service
6. Remove from local history
```

### 3. Library Modules

Located in `src/lib/`:

#### `config.js`
**Purpose**: Configuration management

**Functions**:
- `readGlobalConfig()` - Read from `~/.gcp-deploy/config.json`
- `writeGlobalConfig(config)` - Write global config
- `readProjectConfig()` - Read from `./gcp-deploy.json`
- `writeProjectConfig(config)` - Write project config
- `isProjectInitialized()` - Check if project has config
- `readDeploymentHistory()` - Read from `.gcp-deploy-history.json`
- `writeDeploymentHistory(history)` - Write deployment history
- `addDeployment(deployment)` - Add to history
- `removeDeployment(serviceName)` - Remove from history
- `getDeployment(serviceName)` - Get deployment by name
- `validateProjectConfig(config)` - Validate required fields

**Storage Locations**:
```
~/.gcp-deploy/
  └── config.json (global settings)

./my-project/
  ├── gcp-deploy.json (project config)
  └── .gcp-deploy-history.json (deployment history)
```

#### `gcp-client.js`
**Purpose**: Wrapper around Google Cloud SDKs

**Key Methods**:

| Method | Purpose | GCP Service |
|--------|---------|-------------|
| `deployToCloudRun()` | Create new service | Cloud Run API |
| `updateCloudRunService()` | Update existing service | Cloud Run API |
| `getService()` | Get service details | Cloud Run API |
| `listServices()` | List all services | Cloud Run API |
| `deleteService()` | Delete a service | Cloud Run API |
| `makeServicePublic()` | Set IAM policy | gcloud CLI |
| `streamLogs()` | Stream logs | Cloud Logging API |

**Static Utility Methods**:
- `checkGcloudAuth()` - Verify gcloud authentication
- `configureDockerAuth()` - Configure Docker credentials
- `checkDockerRunning()` - Verify Docker is running
- `getServiceUrl()` - Extract URL from service object

## Deployment Workflow

### Production Deployment

```
┌─────────────────┐
│ gcp-deploy      │
│ deploy -p       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Pre-flight      │
│ Checks          │
│ - Docker?       │
│ - gcloud auth?  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Build Docker    │
│ Image           │
│ - Multi-stage   │
│ - Standalone    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Push to         │
│ Artifact        │
│ Registry        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Deploy to       │
│ Cloud Run       │
│ - Create/Update │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Configure IAM   │
│ (Public Access) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Return URL      │
└─────────────────┘
```

### Preview Deployment Strategy

**Naming Convention**:
```
{serviceName}-{sanitized-branch}-{8-char-random-id}
```

**Example**:
```
Branch: feature/user-auth
Service: my-app-feature-user-auth-a1b2c3d4
URL: https://my-app-feature-user-auth-a1b2c3d4-xxx.run.app
```

**Benefits**:
- Isolated testing environments
- Multiple preview deployments per project
- Easy cleanup
- No production impact

**Lifecycle**:
```
1. Developer creates branch: feature/xyz
2. Run: gcp-deploy deploy --preview
3. Service created: my-app-feature-xyz-{id}
4. Test at preview URL
5. Merge to main
6. Remove: gcp-deploy remove my-app-feature-xyz-{id}
```

## Data Flow

### Configuration Data Flow

```
User Input (Prompts)
    │
    ▼
Project Config (gcp-deploy.json)
    │
    ├──▶ init.js (read/write)
    ├──▶ deploy.js (read)
    ├──▶ list.js (read)
    ├──▶ logs.js (read)
    └──▶ remove.js (read)
```

### Deployment Data Flow

```
.env File
    │
    ▼
Environment Variables
    │
    ├──▶ Docker Build (build args)
    └──▶ Cloud Run (runtime env)

Source Code
    │
    ▼
Docker Image
    │
    ├──▶ Local Build
    └──▶ Artifact Registry
        │
        ▼
    Cloud Run Service
        │
        └──▶ Public URL
```

### Log Data Flow

```
Cloud Run Container
    │
    ▼
Cloud Logging (stdout/stderr)
    │
    ▼
Logging API
    │
    ▼
CLI (formatted output)
    │
    └──▶ User Terminal (color-coded)
```

## Docker Build Strategy

### Multi-Stage Build

```dockerfile
Stage 1: base
└── Node 18 Alpine

Stage 2: deps
├── Copy package files
└── Install dependencies

Stage 3: builder
├── Copy dependencies from deps
├── Copy source code
└── Run next build

Stage 4: runner (final)
├── Copy public files
├── Copy standalone output
├── Run as non-root user
└── Expose port 3000
```

**Benefits**:
- Smaller final image size
- Layer caching for faster builds
- Security (non-root user)
- Optimized for production

### Standalone Output Mode

Next.js standalone output (`next.config.js`):
```javascript
{
  output: 'standalone'
}
```

**Benefits**:
- Only includes necessary files
- Smaller deployment size
- Faster cold starts
- Self-contained server

## Cloud Run Configuration

### Service Specification

```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: {serviceName}
  annotations:
    run.googleapis.com/ingress: all
spec:
  template:
    spec:
      containers:
      - image: {imageUrl}
        ports:
        - containerPort: 3000
        env: [{env vars}]
        resources:
          limits:
            memory: 512Mi
            cpu: 1000m
  traffic:
  - percent: 100
    latestRevision: true
```

**Key Settings**:
- **Memory**: 512Mi (adjustable)
- **CPU**: 1 vCPU (1000m)
- **Concurrency**: Default (80 requests)
- **Min instances**: 0 (scale to zero)
- **Max instances**: Default (100)
- **Timeout**: Default (300s)

## Error Handling Strategy

### Levels of Error Handling

1. **Pre-flight Checks** (before deployment):
   - Docker running
   - gcloud authenticated
   - Project initialized
   - Valid configuration

2. **Runtime Errors** (during deployment):
   - Docker build failures
   - Push failures
   - API errors (403, 404, 5xx)
   - Network errors

3. **User-Friendly Messages**:
   - Clear error description
   - Helpful suggestions
   - Links to documentation
   - Common solutions

### Error Categories

| Error Type | Detection | Solution Provided |
|------------|-----------|-------------------|
| Docker not running | `docker info` fails | Start Docker Desktop |
| Not authenticated | `gcloud auth list` empty | Run `gcloud auth login` |
| API disabled | 404 from GCP API | Enable API command |
| Permission denied | 403 from GCP API | Required IAM roles |
| Build failure | Docker build exit code | Check Dockerfile/logs |

## Cost Estimation

### Component Costs

**Artifact Registry**:
- Storage: $0.10/GB/month
- Average image: 200-500 MB
- 10 images: ~$0.50/month

**Cloud Run**:
- Based on actual usage
- Scales to zero when idle
- Pay only for requests and compute time

**Example Monthly Costs**:

```
Low Traffic (10k requests):
- Free tier covers it
- Cost: $0

Medium Traffic (100k requests):
- Requests: ~$0.04
- CPU time: ~$3-5
- Memory: ~$2-3
- Total: ~$5-8/month

High Traffic (1M requests):
- Requests: ~$0.40
- CPU time: ~$30-40
- Memory: ~$20-30
- Total: ~$50-70/month
```

**Preview Deployments**:
- Each preview service costs the same as production
- Recommendation: Clean up after merging
- Cost control: Set max instances per service

## Security Considerations

### Authentication
- Uses gcloud CLI credentials
- Application Default Credentials (ADC)
- No API keys stored in code

### Docker Security
- Non-root user in container
- Minimal base image (Alpine)
- No unnecessary packages
- .gcloudignore to exclude secrets

### IAM
- Services public by default (configurable)
- Least privilege principle recommended
- Service-specific IAM policies

### Environment Variables
- .env excluded from Docker build
- Passed securely to Cloud Run
- Not logged or exposed in images

## Scalability

### Horizontal Scaling
- Cloud Run auto-scales based on traffic
- Each instance handles ~80 concurrent requests
- Max instances configurable

### Limitations
- Single region per deployment
- No global load balancing (built-in)
- CDN requires separate setup

### Performance Optimization
- Container image caching
- Artifact Registry in same region
- Standalone Next.js output
- Multi-stage Docker builds

## Future Enhancements

Potential features for future versions:

1. **Custom Domains**
   - Automatic SSL certificate provisioning
   - Domain mapping via Cloud Run

2. **Multi-Region Deployments**
   - Deploy to multiple regions
   - Global load balancing

3. **Automatic Rollbacks**
   - Health check monitoring
   - Auto-rollback on errors

4. **CI/CD Integration**
   - GitHub Actions workflow generation
   - GitLab CI templates

5. **Enhanced Monitoring**
   - Built-in metrics dashboard
   - Performance insights
   - Cost tracking

6. **Database Integration**
   - Cloud SQL setup
   - Connection pooling
   - Migration management

7. **CDN Setup**
   - Cloud CDN configuration
   - Static asset optimization

## References

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Knative Serving Spec](https://github.com/knative/specs/blob/main/specs/serving/overview.md)
- [Next.js Standalone Output](https://nextjs.org/docs/advanced-features/output-file-tracing)
- [Docker Multi-Stage Builds](https://docs.docker.com/build/building/multi-stage/)
