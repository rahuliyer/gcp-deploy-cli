import chalk from 'chalk';
import ora from 'ora';
import { readProjectConfig, isProjectInitialized, readDeploymentHistory } from '../lib/config.js';
import { GCPClient } from '../lib/gcp-client.js';

/**
 * Format date for display
 */
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleString();
}

/**
 * List command handler
 */
export async function listCommand(options) {
  console.log(chalk.bold.blue('\nGCP Deploy - List Deployments\n'));

  // Check if project is initialized
  if (!isProjectInitialized()) {
    console.log(chalk.red('Error: Project not initialized.'));
    console.log(chalk.gray('Run'), chalk.cyan('gcp-deploy init'), chalk.gray('first.'));
    return;
  }

  // Read project config
  const config = readProjectConfig();

  const spinner = ora('Fetching deployments...').start();

  try {
    const gcpClient = new GCPClient(config.projectId, config.region);

    // Get all services from Cloud Run
    const services = await gcpClient.listServices();

    // Read local deployment history
    const history = readDeploymentHistory();

    spinner.succeed('Deployments fetched');

    // Filter services that match our service name pattern
    const relevantServices = services.filter(service => {
      const name = service.metadata?.name || '';
      return name === config.serviceName || name.startsWith(`${config.serviceName}-`);
    });

    if (relevantServices.length === 0) {
      console.log(chalk.yellow('No deployments found.\n'));
      return;
    }

    // Separate production and preview deployments
    const productionDeployments = [];
    const previewDeployments = [];

    for (const service of relevantServices) {
      const serviceName = service.metadata?.name || '';
      const url = GCPClient.getServiceUrl(service);
      const updatedAt = service.metadata?.updateTime || service.metadata?.creationTimestamp;

      // Find in history
      const historyEntry = history.deployments.find(d => d.serviceName === serviceName);

      const deployment = {
        serviceName,
        url,
        updatedAt,
        type: historyEntry?.type || (serviceName === config.serviceName ? 'production' : 'preview'),
        branch: historyEntry?.branch || 'unknown',
        image: service.spec?.template?.spec?.containers?.[0]?.image || 'N/A'
      };

      if (deployment.type === 'production') {
        productionDeployments.push(deployment);
      } else {
        previewDeployments.push(deployment);
      }
    }

    // Apply filters
    const showProduction = options.production || (!options.production && !options.preview);
    const showPreview = options.preview || (!options.production && !options.preview);

    // Display production deployments
    if (showProduction && productionDeployments.length > 0) {
      console.log(chalk.bold.green('Production Deployments:\n'));

      productionDeployments.forEach(deployment => {
        console.log(chalk.bold(`  ${deployment.serviceName}`));
        console.log(chalk.gray(`    URL:        ${deployment.url || 'N/A'}`));
        console.log(chalk.gray(`    Updated:    ${formatDate(deployment.updatedAt)}`));
        console.log(chalk.gray(`    Branch:     ${deployment.branch}`));
        console.log();
      });
    }

    // Display preview deployments
    if (showPreview && previewDeployments.length > 0) {
      console.log(chalk.bold.cyan('Preview Deployments:\n'));

      previewDeployments.forEach(deployment => {
        console.log(chalk.bold(`  ${deployment.serviceName}`));
        console.log(chalk.gray(`    URL:        ${deployment.url || 'N/A'}`));
        console.log(chalk.gray(`    Updated:    ${formatDate(deployment.updatedAt)}`));
        console.log(chalk.gray(`    Branch:     ${deployment.branch}`));
        console.log();
      });
    }

    // Summary
    const totalCount =
      (showProduction ? productionDeployments.length : 0) +
      (showPreview ? previewDeployments.length : 0);

    console.log(chalk.gray(`Total: ${totalCount} deployment(s)\n`));

  } catch (error) {
    spinner.fail('Failed to fetch deployments');
    console.error(chalk.red(`\nError: ${error.message}`));

    if (error.message.includes('403')) {
      console.log(chalk.yellow('\nMake sure you have the necessary permissions:'));
      console.log(chalk.gray('  - Cloud Run Viewer'));
    } else if (error.message.includes('404')) {
      console.log(chalk.yellow('\nMake sure the Cloud Run API is enabled:'));
      console.log(chalk.cyan('  gcloud services enable run.googleapis.com'));
    }

    console.log();
  }
}
