import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import { nanoid } from 'nanoid';
import { readProjectConfig, isProjectInitialized, addDeployment } from '../lib/config.js';
import { GCPClient } from '../lib/gcp-client.js';

/**
 * Sanitize branch name for Cloud Run service name
 */
function sanitizeBranchName(branch) {
  return branch
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')           // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '')       // Remove leading/trailing hyphens
    .substring(0, 30)
    .replace(/-+$/g, '');          // Remove any trailing hyphens after substring
}

/**
 * Get current git branch
 */
function getCurrentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch (error) {
    return 'main';
  }
}

/**
 * Parse environment variables from .env file
 */
function parseEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return {};
  }

  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};

    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key) {
          let value = valueParts.join('=').trim();
          // Remove quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          envVars[key.trim()] = value;
        }
      }
    });

    return envVars;
  } catch (error) {
    console.warn(chalk.yellow(`Warning: Could not parse .env file: ${error.message}`));
    return {};
  }
}

/**
 * Build Docker image
 */
async function buildDockerImage(imageName, spinner) {
  spinner.start('Building Docker image for Cloud Run (amd64)...');

  try {
    // Build for AMD64/x86_64 platform (required by Cloud Run)
    execSync(`docker build --platform linux/amd64 -t ${imageName} .`, {
      stdio: 'pipe',
      encoding: 'utf8'
    });
    spinner.succeed('Docker image built successfully');
    return true;
  } catch (error) {
    spinner.fail('Docker build failed');
    console.error(chalk.red(error.message));
    return false;
  }
}

/**
 * Push Docker image to Artifact Registry
 */
async function pushDockerImage(imageName, spinner) {
  spinner.start('Pushing image to Artifact Registry...');

  try {
    execSync(`docker push ${imageName}`, {
      stdio: 'pipe',
      encoding: 'utf8'
    });
    spinner.succeed('Image pushed successfully');
    return true;
  } catch (error) {
    spinner.fail('Docker push failed');
    console.error(chalk.red(error.message));
    return false;
  }
}

/**
 * Tag Docker image
 */
function tagDockerImage(sourceName, targetName) {
  try {
    execSync(`docker tag ${sourceName} ${targetName}`, {
      stdio: 'pipe',
      encoding: 'utf8'
    });
    return true;
  } catch (error) {
    console.error(chalk.red(`Failed to tag image: ${error.message}`));
    return false;
  }
}

/**
 * Deploy command handler
 */
export async function deployCommand(options) {
  console.log(chalk.bold.blue('\nGCP Deploy - Deploy Application\n'));

  // Check if project is initialized
  if (!isProjectInitialized()) {
    console.log(chalk.red('Error: Project not initialized.'));
    console.log(chalk.gray('Run'), chalk.cyan('gcp-deploy init'), chalk.gray('first.'));
    return;
  }

  // Read project config
  const config = readProjectConfig();

  // Ensure service name is lowercase for Docker compatibility
  config.serviceName = config.serviceName.toLowerCase();

  // Determine deployment type
  const isProduction = options.production || false;
  const isPreview = options.preview || false;
  const branchName = options.branch || getCurrentBranch();

  let serviceName;
  let deploymentType;

  if (isProduction) {
    serviceName = config.serviceName;
    deploymentType = 'production';
  } else if (isPreview || branchName !== 'main') {
    const sanitizedBranch = sanitizeBranchName(branchName);
    // Generate lowercase-only ID for Docker compatibility
    const uniqueId = nanoid(8).toLowerCase();
    serviceName = `${config.serviceName}-${sanitizedBranch}-${uniqueId}`
      .replace(/-+/g, '-')           // Replace multiple hyphens with single
      .replace(/^-+|-+$/g, '');      // Remove leading/trailing hyphens
    deploymentType = 'preview';
  } else {
    serviceName = config.serviceName;
    deploymentType = 'production';
  }

  console.log(chalk.gray(`Deployment type: ${deploymentType}`));
  console.log(chalk.gray(`Service name: ${serviceName}`));
  console.log(chalk.gray(`Region: ${config.region}\n`));

  const spinner = ora();

  // Pre-flight checks
  spinner.start('Running pre-flight checks...');

  // Check Docker is running
  if (!GCPClient.checkDockerRunning()) {
    spinner.fail('Pre-flight checks failed');
    console.error(chalk.red('Error: Docker is not running.'));
    console.log(chalk.gray('Please start Docker and try again.'));
    return;
  }

  // Check gcloud authentication
  if (!GCPClient.checkGcloudAuth()) {
    spinner.fail('Pre-flight checks failed');
    console.error(chalk.red('Error: gcloud CLI is not authenticated.'));
    console.log(chalk.gray('Run'), chalk.cyan('gcloud auth login'), chalk.gray('to authenticate.'));
    return;
  }

  // Configure Docker authentication
  try {
    GCPClient.configureDockerAuth(config.region);
  } catch (error) {
    spinner.fail('Pre-flight checks failed');
    console.error(chalk.red(`Error: ${error.message}`));
    return;
  }

  spinner.succeed('Pre-flight checks passed');

  // Parse environment variables
  const envPath = path.join(process.cwd(), '.env');
  const envVars = parseEnvFile(envPath);

  if (Object.keys(envVars).length > 0) {
    console.log(chalk.gray(`Loaded ${Object.keys(envVars).length} environment variables from .env\n`));
  }

  // Build image
  const timestamp = Date.now();
  const imageTag = `${config.artifactRegistry}/${serviceName}:${timestamp}`;
  const imageLatest = `${config.artifactRegistry}/${serviceName}:latest`;

  const buildSuccess = await buildDockerImage(imageTag, spinner);
  if (!buildSuccess) {
    console.log(chalk.red('\nDeployment failed.'));
    return;
  }

  // Tag as latest
  tagDockerImage(imageTag, imageLatest);

  // Push image
  const pushSuccess = await pushDockerImage(imageTag, spinner);
  if (!pushSuccess) {
    console.log(chalk.red('\nDeployment failed.'));
    return;
  }

  // Also push latest tag
  await pushDockerImage(imageLatest, spinner);

  // Deploy to Cloud Run using gcloud CLI
  spinner.start('Deploying to Cloud Run...');

  try {
    // Build environment variables string
    const envVarsString = Object.entries(envVars)
      .map(([key, value]) => `${key}=${value}`)
      .join(',');

    // Deploy using gcloud CLI
    const deployCommand = [
      'gcloud run deploy',
      serviceName,
      `--image=${imageTag}`,
      `--region=${config.region}`,
      `--project=${config.projectId}`,
      '--platform=managed',
      '--allow-unauthenticated',
      '--memory=512Mi',
      '--cpu=1',
      '--port=3000',
      envVarsString ? `--set-env-vars="${envVarsString}"` : '',
      '--quiet'
    ].filter(Boolean).join(' ');

    execSync(deployCommand, {
      stdio: 'pipe',
      encoding: 'utf8'
    });

    spinner.succeed('Deployed to Cloud Run');

    // Get service URL using gcloud
    spinner.start('Retrieving service URL...');
    const serviceUrl = execSync(
      `gcloud run services describe ${serviceName} --region=${config.region} --project=${config.projectId} --format="value(status.url)"`,
      { encoding: 'utf8', stdio: 'pipe' }
    ).trim();
    spinner.succeed('Service deployed successfully');

    // Save deployment to history
    addDeployment({
      serviceName,
      type: deploymentType,
      branch: branchName,
      url: serviceUrl,
      image: imageTag,
      region: config.region
    });

    // Success message
    console.log(chalk.green('\n✓ Deployment successful!\n'));
    console.log(chalk.bold('Service URL:'));
    console.log(chalk.cyan(`  ${serviceUrl}\n`));

    if (deploymentType === 'preview') {
      console.log(chalk.gray('This is a preview deployment. To deploy to production, use:'));
      console.log(chalk.cyan('  gcp-deploy deploy --production\n'));
    }

  } catch (error) {
    spinner.fail('Deployment failed');

    // Extract clean error message
    let errorMessage = error.message;
    if (error.stderr) {
      errorMessage = error.stderr;
    }

    console.error(chalk.red(`\nError: ${errorMessage}`));

    // Helpful error messages
    if (error.message.includes('403')) {
      console.log(chalk.yellow('\nMake sure you have the necessary permissions:'));
      console.log(chalk.gray('  - Cloud Run Admin'));
      console.log(chalk.gray('  - Storage Admin (for Artifact Registry)'));
    } else if (error.message.includes('404')) {
      console.log(chalk.yellow('\nMake sure the following APIs are enabled:'));
      console.log(chalk.gray('  - Cloud Run API'));
      console.log(chalk.gray('  - Artifact Registry API'));
      console.log(chalk.gray('  - Cloud Build API'));
      console.log(chalk.gray('\nYou can enable them in the GCP Console or using:'));
      console.log(chalk.cyan('  gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com'));
    }

    console.log(chalk.gray('\nFor more help, visit:'));
    console.log(chalk.cyan('  https://cloud.google.com/run/docs\n'));
  }
}
