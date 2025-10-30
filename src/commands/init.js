import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import { writeProjectConfig, isProjectInitialized } from '../lib/config.js';

/**
 * Check if the current directory is a Next.js project
 */
function isNextJsProject() {
  const packageJsonPath = path.join(process.cwd(), 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson.dependencies?.next || packageJson.devDependencies?.next;
  } catch (error) {
    return false;
  }
}

/**
 * Generate Dockerfile for Next.js
 */
function generateDockerfile() {
  return `# Detect package manager
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN \\
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \\
  elif [ -f package-lock.json ]; then npm ci; \\
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \\
  else echo "Lockfile not found." && exit 1; \\
  fi

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED=1

RUN \\
  if [ -f yarn.lock ]; then yarn build; \\
  elif [ -f package-lock.json ]; then npm run build; \\
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run build; \\
  else echo "Lockfile not found." && exit 1; \\
  fi

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
`;
}

/**
 * Generate cloudbuild.yaml
 */
function generateCloudBuild(projectId, region, serviceName) {
  const artifactRegistry = `${region}-docker.pkg.dev/${projectId}/cloud-run-source-deploy`;

  return `steps:
  # Build the container image
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - '${artifactRegistry}/${serviceName}:$SHORT_SHA'
      - '-t'
      - '${artifactRegistry}/${serviceName}:latest'
      - '.'

  # Push the container image to Artifact Registry
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - '--all-tags'
      - '${artifactRegistry}/${serviceName}'

  # Deploy to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - '${serviceName}'
      - '--image'
      - '${artifactRegistry}/${serviceName}:$SHORT_SHA'
      - '--region'
      - '${region}'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'

images:
  - '${artifactRegistry}/${serviceName}:$SHORT_SHA'
  - '${artifactRegistry}/${serviceName}:latest'

options:
  logging: CLOUD_LOGGING_ONLY
`;
}

/**
 * Generate .gcloudignore
 */
function generateGcloudIgnore() {
  return `# This file specifies files that are *not* uploaded to Google Cloud
# using gcloud. It follows the same syntax as .gitignore, with the addition of
# "#!include" directives (which insert the entries of the given .gitignore-style
# file at that point).

.gcloudignore
.git
.gitignore

node_modules/
.next/
.env
.env.*
!.env.example

*.md
.vscode/
.idea/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

.DS_Store
*.swp
*.swo
*~

coverage/
.nyc_output/
`;
}

/**
 * Update next.config.js to enable standalone output
 */
function updateNextConfig() {
  const nextConfigPath = path.join(process.cwd(), 'next.config.js');
  const nextConfigMjsPath = path.join(process.cwd(), 'next.config.mjs');

  let configPath = null;
  if (fs.existsSync(nextConfigPath)) {
    configPath = nextConfigPath;
  } else if (fs.existsSync(nextConfigMjsPath)) {
    configPath = nextConfigMjsPath;
  }

  if (configPath) {
    const content = fs.readFileSync(configPath, 'utf8');

    // Check if standalone output is already configured
    if (content.includes('output:') && content.includes('standalone')) {
      return false; // Already configured
    }

    console.log(chalk.yellow('\nNote: You need to add the following to your next.config.js:'));
    console.log(chalk.cyan('  output: "standalone"'));
    console.log(chalk.gray('This is required for Docker deployment.\n'));
    return true;
  } else {
    // Create a basic next.config.js
    const basicConfig = `/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
}

module.exports = nextConfig
`;
    fs.writeFileSync(nextConfigPath, basicConfig);
    console.log(chalk.green('Created next.config.js with standalone output mode'));
    return false;
  }
}

/**
 * Check if gcloud is authenticated
 */
function checkGcloudAuth() {
  try {
    const output = execSync('gcloud auth list --filter=status:ACTIVE --format="value(account)"', {
      encoding: 'utf8',
      stdio: 'pipe'
    }).trim();
    return output.length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Get current gcloud project
 */
function getCurrentProject() {
  try {
    return execSync('gcloud config get-value project', {
      encoding: 'utf8',
      stdio: 'pipe'
    }).trim();
  } catch (error) {
    return null;
  }
}

/**
 * Authenticate with gcloud
 */
async function authenticateGcloud() {
  console.log(chalk.yellow('\nYou need to authenticate with Google Cloud.'));
  console.log(chalk.gray('This will open a browser window for authentication.\n'));

  const { proceed } = await prompts({
    type: 'confirm',
    name: 'proceed',
    message: 'Do you want to login now?',
    initial: true
  });

  if (!proceed) {
    console.log(chalk.red('\nAuthentication is required to continue.'));
    return false;
  }

  try {
    console.log(chalk.gray('Opening browser for authentication...'));
    execSync('gcloud auth login', { stdio: 'inherit' });

    console.log(chalk.gray('Setting up application default credentials...'));
    execSync('gcloud auth application-default login', { stdio: 'inherit' });

    return true;
  } catch (error) {
    console.log(chalk.red('\nAuthentication failed.'));
    return false;
  }
}

/**
 * Init command handler
 */
export async function initCommand() {
  console.log(chalk.bold.blue('\nGCP Deploy - Initialize Project\n'));

  // Check if gcloud is installed
  try {
    execSync('gcloud --version', { stdio: 'pipe' });
  } catch (error) {
    console.log(chalk.red('Error: gcloud CLI is not installed.'));
    console.log(chalk.gray('Install it from: https://cloud.google.com/sdk/docs/install'));
    return;
  }

  // Check if authenticated
  if (!checkGcloudAuth()) {
    const authenticated = await authenticateGcloud();
    if (!authenticated) {
      return;
    }
  } else {
    const account = execSync('gcloud auth list --filter=status:ACTIVE --format="value(account)"', {
      encoding: 'utf8',
      stdio: 'pipe'
    }).trim();
    console.log(chalk.green(`✓ Authenticated as: ${account}\n`));
  }

  // Check if already initialized
  if (isProjectInitialized()) {
    console.log(chalk.yellow('Project is already initialized!'));
    const { overwrite } = await prompts({
      type: 'confirm',
      name: 'overwrite',
      message: 'Do you want to overwrite the existing configuration?',
      initial: false
    });

    if (!overwrite) {
      console.log(chalk.gray('Initialization cancelled.'));
      return;
    }
  }

  // Check if it's a Next.js project
  if (!isNextJsProject()) {
    console.log(chalk.red('Error: This does not appear to be a Next.js project.'));
    console.log(chalk.gray('Make sure you have Next.js listed in your package.json dependencies.'));
    return;
  }

  // Get current project or prompt for new one
  const currentProject = getCurrentProject();
  let defaultProjectId = currentProject && currentProject !== '(unset)' ? currentProject : '';

  // Interactive prompts
  const response = await prompts([
    {
      type: 'text',
      name: 'projectId',
      message: 'GCP Project ID:',
      initial: defaultProjectId,
      validate: value => value.length > 0 ? true : 'Project ID is required'
    },
    {
      type: 'select',
      name: 'region',
      message: 'Select a region:',
      choices: [
        { title: 'us-central1 (Iowa)', value: 'us-central1' },
        { title: 'us-east1 (South Carolina)', value: 'us-east1' },
        { title: 'us-west1 (Oregon)', value: 'us-west1' },
        { title: 'europe-west1 (Belgium)', value: 'europe-west1' },
        { title: 'asia-east1 (Taiwan)', value: 'asia-east1' }
      ],
      initial: 0
    },
    {
      type: 'text',
      name: 'serviceName',
      message: 'Service name:',
      initial: path.basename(process.cwd()).toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      validate: value => {
        if (value.length === 0) return 'Service name is required';
        if (!/^[a-z0-9-]+$/.test(value)) return 'Service name must be lowercase alphanumeric with hyphens';
        return true;
      },
      format: value => value.toLowerCase()
    }
  ]);

  if (!response.projectId || !response.region || !response.serviceName) {
    console.log(chalk.red('\nInitialization cancelled.'));
    return;
  }

  const spinner = ora('Setting up project...').start();

  try {
    // Set the gcloud project
    spinner.start('Setting gcloud project...');
    try {
      execSync(`gcloud config set project ${response.projectId}`, { stdio: 'pipe' });
      spinner.succeed(`Set gcloud project to: ${response.projectId}`);
    } catch (error) {
      spinner.warn('Could not set gcloud project');
      console.log(chalk.yellow('Run this command manually:'));
      console.log(chalk.cyan(`  gcloud config set project ${response.projectId}`));
    }

    // Enable required APIs
    spinner.start('Enabling required Google Cloud APIs...');
    const requiredApis = [
      'run.googleapis.com',
      'artifactregistry.googleapis.com',
      'cloudbuild.googleapis.com',
      'logging.googleapis.com'
    ];

    try {
      execSync(`gcloud services enable ${requiredApis.join(' ')} --project=${response.projectId}`, {
        stdio: 'pipe',
        timeout: 60000 // 60 second timeout
      });
      spinner.succeed('Enabled required APIs (Cloud Run, Artifact Registry, Cloud Build, Logging)');
    } catch (error) {
      spinner.warn('Could not enable APIs automatically');
      console.log(chalk.yellow('Run this command manually:'));
      console.log(chalk.cyan(`  gcloud services enable ${requiredApis.join(' ')}`));
    }

    // Create Artifact Registry repository if it doesn't exist
    spinner.start('Setting up Artifact Registry repository...');
    try {
      // Check if repository exists
      const repoName = 'cloud-run-source-deploy';
      try {
        execSync(`gcloud artifacts repositories describe ${repoName} --location=${response.region} --project=${response.projectId}`, {
          stdio: 'pipe'
        });
        spinner.succeed('Artifact Registry repository already exists');
      } catch (error) {
        // Repository doesn't exist, create it
        execSync(`gcloud artifacts repositories create ${repoName} \
          --repository-format=docker \
          --location=${response.region} \
          --description="Docker repository for Cloud Run deployments" \
          --project=${response.projectId}`, {
          stdio: 'pipe'
        });
        spinner.succeed('Created Artifact Registry repository');
      }
    } catch (error) {
      spinner.warn('Could not create Artifact Registry repository');
      console.log(chalk.yellow('Run this command manually:'));
      console.log(chalk.cyan(`  gcloud artifacts repositories create cloud-run-source-deploy \\`));
      console.log(chalk.cyan(`    --repository-format=docker \\`));
      console.log(chalk.cyan(`    --location=${response.region} \\`));
      console.log(chalk.cyan(`    --description="Docker repository for Cloud Run"`));
    }
    // Create configuration
    const config = {
      projectId: response.projectId,
      region: response.region,
      serviceName: response.serviceName,
      artifactRegistry: `${response.region}-docker.pkg.dev/${response.projectId}/cloud-run-source-deploy`,
      version: '1.0'
    };

    // Write project config
    writeProjectConfig(config);
    spinner.succeed('Created gcp-deploy.json');

    // Configure Docker authentication
    spinner.start('Configuring Docker authentication...');
    try {
      execSync(`gcloud auth configure-docker ${response.region}-docker.pkg.dev --quiet`, {
        stdio: 'pipe'
      });
      spinner.succeed('Docker authentication configured');
    } catch (error) {
      spinner.warn('Could not configure Docker authentication automatically');
      console.log(chalk.yellow('Run this command manually:'));
      console.log(chalk.cyan(`  gcloud auth configure-docker ${response.region}-docker.pkg.dev`));
    }

    // Generate Dockerfile
    spinner.start('Generating Dockerfile...');
    fs.writeFileSync(path.join(process.cwd(), 'Dockerfile'), generateDockerfile());
    spinner.succeed('Created Dockerfile');

    // Generate cloudbuild.yaml
    spinner.start('Generating cloudbuild.yaml...');
    fs.writeFileSync(
      path.join(process.cwd(), 'cloudbuild.yaml'),
      generateCloudBuild(response.projectId, response.region, response.serviceName)
    );
    spinner.succeed('Created cloudbuild.yaml');

    // Generate .gcloudignore
    spinner.start('Generating .gcloudignore...');
    fs.writeFileSync(path.join(process.cwd(), '.gcloudignore'), generateGcloudIgnore());
    spinner.succeed('Created .gcloudignore');

    // Update next.config.js
    spinner.start('Checking Next.js configuration...');
    updateNextConfig();
    spinner.succeed('Next.js configuration checked');

    console.log(chalk.green('\n✓ Project initialized successfully!\n'));
    console.log(chalk.bold('Ready to deploy!'));
    console.log(chalk.gray('  Run'), chalk.cyan('gcp-deploy deploy --production'), chalk.gray('to deploy your app'));
    console.log();

  } catch (error) {
    spinner.fail('Initialization failed');
    console.error(chalk.red(`Error: ${error.message}`));
  }
}
