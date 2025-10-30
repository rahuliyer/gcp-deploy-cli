#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init.js';
import { deployCommand } from './commands/deploy.js';
import { listCommand } from './commands/list.js';
import { logsCommand } from './commands/logs.js';
import { removeCommand } from './commands/remove.js';

const program = new Command();

program
  .name('gcp-deploy')
  .description('A Vercel-like CLI tool for deploying Next.js applications to Google Cloud Platform')
  .version('1.0.0');

// Init command
program
  .command('init')
  .description('Initialize a new project with GCP deployment configuration')
  .action(async () => {
    try {
      await initCommand();
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// Deploy command
program
  .command('deploy')
  .description('Deploy application to Cloud Run')
  .option('-p, --production', 'Deploy to production')
  .option('--preview', 'Create a preview deployment')
  .option('-b, --branch <name>', 'Specify branch name for preview deployment')
  .action(async (options) => {
    try {
      await deployCommand(options);
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// List command
program
  .command('list')
  .description('List all deployments')
  .option('--production', 'Show only production deployments')
  .option('--preview', 'Show only preview deployments')
  .action(async (options) => {
    try {
      await listCommand(options);
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// Logs command
program
  .command('logs')
  .description('Stream logs from Cloud Logging')
  .option('-f, --follow', 'Follow log output (stream in real-time)')
  .option('-d, --deployment <id>', 'Specify which deployment to show logs for')
  .action(async (options) => {
    try {
      await logsCommand(options);
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// Remove command
program
  .command('remove <deployment>')
  .description('Delete a deployment')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (deployment, options) => {
    try {
      await removeCommand(deployment, options);
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command is provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
