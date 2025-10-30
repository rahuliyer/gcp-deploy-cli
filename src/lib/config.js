import fs from 'fs';
import path from 'path';
import os from 'os';

const GLOBAL_CONFIG_DIR = path.join(os.homedir(), '.gcp-deploy');
const GLOBAL_CONFIG_FILE = path.join(GLOBAL_CONFIG_DIR, 'config.json');
const PROJECT_CONFIG_FILE = 'gcp-deploy.json';
const DEPLOYMENT_HISTORY_FILE = '.gcp-deploy-history.json';

/**
 * Ensure global config directory exists
 */
function ensureGlobalConfigDir() {
  if (!fs.existsSync(GLOBAL_CONFIG_DIR)) {
    fs.mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
  }
}

/**
 * Read global configuration
 */
export function readGlobalConfig() {
  ensureGlobalConfigDir();

  if (!fs.existsSync(GLOBAL_CONFIG_FILE)) {
    return {};
  }

  try {
    const data = fs.readFileSync(GLOBAL_CONFIG_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading global config: ${error.message}`);
    return {};
  }
}

/**
 * Write global configuration
 */
export function writeGlobalConfig(config) {
  ensureGlobalConfigDir();

  try {
    fs.writeFileSync(GLOBAL_CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error(`Error writing global config: ${error.message}`);
    return false;
  }
}

/**
 * Read project configuration
 */
export function readProjectConfig(projectDir = process.cwd()) {
  const configPath = path.join(projectDir, PROJECT_CONFIG_FILE);

  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const data = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    throw new Error(`Error reading project config: ${error.message}`);
  }
}

/**
 * Write project configuration
 */
export function writeProjectConfig(config, projectDir = process.cwd()) {
  const configPath = path.join(projectDir, PROJECT_CONFIG_FILE);

  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    throw new Error(`Error writing project config: ${error.message}`);
  }
}

/**
 * Check if project is initialized
 */
export function isProjectInitialized(projectDir = process.cwd()) {
  const configPath = path.join(projectDir, PROJECT_CONFIG_FILE);
  return fs.existsSync(configPath);
}

/**
 * Read deployment history
 */
export function readDeploymentHistory(projectDir = process.cwd()) {
  const historyPath = path.join(projectDir, DEPLOYMENT_HISTORY_FILE);

  if (!fs.existsSync(historyPath)) {
    return { deployments: [] };
  }

  try {
    const data = fs.readFileSync(historyPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading deployment history: ${error.message}`);
    return { deployments: [] };
  }
}

/**
 * Write deployment history
 */
export function writeDeploymentHistory(history, projectDir = process.cwd()) {
  const historyPath = path.join(projectDir, DEPLOYMENT_HISTORY_FILE);

  try {
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
    return true;
  } catch (error) {
    console.error(`Error writing deployment history: ${error.message}`);
    return false;
  }
}

/**
 * Add deployment to history
 */
export function addDeployment(deployment, projectDir = process.cwd()) {
  const history = readDeploymentHistory(projectDir);
  history.deployments.push({
    ...deployment,
    timestamp: new Date().toISOString()
  });
  writeDeploymentHistory(history, projectDir);
}

/**
 * Remove deployment from history
 */
export function removeDeployment(serviceName, projectDir = process.cwd()) {
  const history = readDeploymentHistory(projectDir);
  history.deployments = history.deployments.filter(d => d.serviceName !== serviceName);
  writeDeploymentHistory(history, projectDir);
}

/**
 * Get deployment by service name
 */
export function getDeployment(serviceName, projectDir = process.cwd()) {
  const history = readDeploymentHistory(projectDir);
  return history.deployments.find(d => d.serviceName === serviceName);
}

/**
 * Validate project configuration
 */
export function validateProjectConfig(config) {
  const required = ['projectId', 'region', 'serviceName'];
  const missing = required.filter(field => !config[field]);

  if (missing.length > 0) {
    throw new Error(`Missing required configuration fields: ${missing.join(', ')}`);
  }

  return true;
}
