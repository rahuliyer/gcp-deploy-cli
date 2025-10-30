import chalk from 'chalk';
import ora from 'ora';
import { readProjectConfig, isProjectInitialized, getDeployment } from '../lib/config.js';
import { GCPClient } from '../lib/gcp-client.js';

/**
 * Get color for log severity
 */
function getSeverityColor(severity) {
  switch (severity?.toUpperCase()) {
    case 'DEBUG':
      return chalk.gray;
    case 'INFO':
      return chalk.blue;
    case 'WARNING':
      return chalk.yellow;
    case 'ERROR':
      return chalk.red;
    case 'CRITICAL':
      return chalk.red.bold;
    default:
      return chalk.white;
  }
}

/**
 * Format log entry for display
 */
function formatLogEntry(entry) {
  const timestamp = entry.metadata?.timestamp || new Date();
  const severity = entry.metadata?.severity || 'INFO';
  const message = entry.data?.message || entry.data?.textPayload || JSON.stringify(entry.data);

  const timeStr = new Date(timestamp).toLocaleTimeString();
  const colorFn = getSeverityColor(severity);

  return `${chalk.gray(timeStr)} ${colorFn(severity.padEnd(8))} ${message}`;
}

/**
 * Logs command handler
 */
export async function logsCommand(options) {
  console.log(chalk.bold.blue('\nGCP Deploy - Stream Logs\n'));

  // Check if project is initialized
  if (!isProjectInitialized()) {
    console.log(chalk.red('Error: Project not initialized.'));
    console.log(chalk.gray('Run'), chalk.cyan('gcp-deploy init'), chalk.gray('first.'));
    return;
  }

  // Read project config
  const config = readProjectConfig();

  // Determine which deployment to show logs for
  let serviceName;

  if (options.deployment) {
    serviceName = options.deployment;
    console.log(chalk.gray(`Showing logs for: ${serviceName}`));
  } else {
    // Default to production deployment
    serviceName = config.serviceName;
    console.log(chalk.gray(`Showing logs for production deployment: ${serviceName}`));
  }

  // Check if deployment exists in history
  const deployment = getDeployment(serviceName);
  if (!deployment && !options.deployment) {
    console.log(chalk.yellow('\nNo production deployment found.'));
    console.log(chalk.gray('Specify a deployment with --deployment <service-name>\n'));
    return;
  }

  const follow = options.follow || false;

  if (follow) {
    console.log(chalk.gray('Following logs (Ctrl+C to stop)...\n'));
  } else {
    console.log(chalk.gray('Fetching recent logs...\n'));
  }

  const spinner = ora('Connecting to Cloud Logging...').start();

  try {
    const gcpClient = new GCPClient(config.projectId, config.region);

    // Stream logs
    const cleanup = await gcpClient.streamLogs(
      serviceName,
      (entry) => {
        spinner.stop();
        console.log(formatLogEntry(entry));
      },
      follow
    );

    if (!follow) {
      spinner.succeed('Logs fetched');
      console.log();
    } else {
      spinner.succeed('Connected to Cloud Logging');

      // Handle Ctrl+C gracefully
      process.on('SIGINT', () => {
        console.log(chalk.yellow('\n\nStopping log stream...'));
        if (cleanup) cleanup();
        process.exit(0);
      });

      // Keep the process running
      await new Promise(() => {}); // Never resolves
    }

  } catch (error) {
    spinner.fail('Failed to fetch logs');
    console.error(chalk.red(`\nError: ${error.message}`));

    if (error.message.includes('403')) {
      console.log(chalk.yellow('\nMake sure you have the necessary permissions:'));
      console.log(chalk.gray('  - Logs Viewer'));
    } else if (error.message.includes('404')) {
      console.log(chalk.yellow('\nMake sure the Cloud Logging API is enabled:'));
      console.log(chalk.cyan('  gcloud services enable logging.googleapis.com'));
    }

    console.log();
  }
}
