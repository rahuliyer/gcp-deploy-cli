import chalk from 'chalk';
import prompts from 'prompts';
import ora from 'ora';
import { readProjectConfig, isProjectInitialized, removeDeployment, getDeployment } from '../lib/config.js';
import { GCPClient } from '../lib/gcp-client.js';

/**
 * Remove command handler
 */
export async function removeCommand(deploymentName, options) {
  console.log(chalk.bold.blue('\nGCP Deploy - Remove Deployment\n'));

  // Check if project is initialized
  if (!isProjectInitialized()) {
    console.log(chalk.red('Error: Project not initialized.'));
    console.log(chalk.gray('Run'), chalk.cyan('gcp-deploy init'), chalk.gray('first.'));
    return;
  }

  // Check if deployment name is provided
  if (!deploymentName) {
    console.log(chalk.red('Error: Deployment name is required.'));
    console.log(chalk.gray('Usage:'), chalk.cyan('gcp-deploy remove <deployment-name>'));
    console.log(chalk.gray('\nTo see all deployments, run:'), chalk.cyan('gcp-deploy list'));
    console.log();
    return;
  }

  // Read project config
  const config = readProjectConfig();

  // Check if trying to remove production deployment
  if (deploymentName === config.serviceName) {
    console.log(chalk.yellow('Warning: This is the production deployment!'));
  }

  // Get deployment info
  const deployment = getDeployment(deploymentName);
  if (deployment) {
    console.log(chalk.gray(`Service: ${deploymentName}`));
    console.log(chalk.gray(`Type: ${deployment.type}`));
    console.log(chalk.gray(`Branch: ${deployment.branch}`));
    console.log(chalk.gray(`URL: ${deployment.url || 'N/A'}\n`));
  } else {
    console.log(chalk.gray(`Service: ${deploymentName}`));
    console.log(chalk.yellow('Note: Deployment not found in local history, but may exist in Cloud Run.\n'));
  }

  // Confirmation
  if (!options.yes) {
    const { confirmed } = await prompts({
      type: 'confirm',
      name: 'confirmed',
      message: 'Are you sure you want to delete this deployment?',
      initial: false
    });

    if (!confirmed) {
      console.log(chalk.gray('Deletion cancelled.'));
      return;
    }
  }

  const spinner = ora('Deleting Cloud Run service...').start();

  try {
    const gcpClient = new GCPClient(config.projectId, config.region);

    // Check if service exists
    const service = await gcpClient.getService(deploymentName);

    if (!service) {
      spinner.warn('Service not found in Cloud Run');
      console.log(chalk.yellow('\nThe service does not exist in Cloud Run.'));

      // Remove from local history anyway
      removeDeployment(deploymentName);
      console.log(chalk.gray('Removed from local deployment history.\n'));
      return;
    }

    // Delete service
    await gcpClient.deleteService(deploymentName);
    spinner.succeed('Cloud Run service deleted');

    // Remove from local history
    removeDeployment(deploymentName);

    console.log(chalk.green('\n✓ Deployment removed successfully!\n'));

  } catch (error) {
    spinner.fail('Failed to delete deployment');
    console.error(chalk.red(`\nError: ${error.message}`));

    if (error.message.includes('403')) {
      console.log(chalk.yellow('\nMake sure you have the necessary permissions:'));
      console.log(chalk.gray('  - Cloud Run Admin'));
    } else if (error.message.includes('404')) {
      console.log(chalk.yellow('\nThe service may have already been deleted.'));

      // Remove from local history anyway
      removeDeployment(deploymentName);
      console.log(chalk.gray('Removed from local deployment history.'));
    }

    console.log();
  }
}
