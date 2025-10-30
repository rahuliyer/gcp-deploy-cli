import { ServicesClient } from '@google-cloud/run';
import { Logging } from '@google-cloud/logging';
import { execSync } from 'child_process';

/**
 * GCP Client wrapper for Cloud Run and related services
 */
export class GCPClient {
  constructor(projectId, region) {
    this.projectId = projectId;
    this.region = region;
    this.runClient = new ServicesClient();
    this.logging = new Logging({ projectId });
  }

  /**
   * Get the parent path for Cloud Run API
   */
  getParent() {
    return `projects/${this.projectId}/locations/${this.region}`;
  }

  /**
   * Get the service path for Cloud Run API
   */
  getServicePath(serviceName) {
    return `${this.getParent()}/services/${serviceName}`;
  }

  /**
   * Deploy a new Cloud Run service
   */
  async deployToCloudRun(serviceName, imageUrl, envVars = {}) {
    const parent = this.getParent();

    const envVarArray = Object.entries(envVars).map(([name, value]) => ({
      name,
      value
    }));

    const service = {
      template: {
        containers: [
          {
            image: imageUrl,
            ports: [{ containerPort: 3000 }],
            env: envVarArray,
            resources: {
              limits: {
                memory: '512Mi',
                cpu: '1000m'
              }
            }
          }
        ]
      }
    };

    try {
      const [operation] = await this.runClient.createService({
        parent,
        service,
        serviceId: serviceName
      });

      const [response] = await operation.promise();
      return response;
    } catch (error) {
      throw new Error(`Failed to deploy to Cloud Run: ${error.message}`);
    }
  }

  /**
   * Update an existing Cloud Run service
   */
  async updateCloudRunService(serviceName, imageUrl, envVars = {}) {
    const name = this.getServicePath(serviceName);

    const envVarArray = Object.entries(envVars).map(([name, value]) => ({
      name,
      value
    }));

    // First, get the existing service to preserve other settings
    const [existingService] = await this.runClient.getService({ name });

    const service = {
      name: existingService.name,
      template: {
        containers: [
          {
            image: imageUrl,
            ports: [{ containerPort: 3000 }],
            env: envVarArray,
            resources: {
              limits: {
                memory: '512Mi',
                cpu: '1000m'
              }
            }
          }
        ]
      }
    };

    try {
      const [operation] = await this.runClient.updateService({
        service,
        allowMissing: false
      });

      const [response] = await operation.promise();
      return response;
    } catch (error) {
      throw new Error(`Failed to update Cloud Run service: ${error.message}`);
    }
  }

  /**
   * Get a Cloud Run service
   */
  async getService(serviceName) {
    const name = this.getServicePath(serviceName);

    try {
      const [service] = await this.runClient.getService({ name });
      return service;
    } catch (error) {
      if (error.code === 5) { // NOT_FOUND
        return null;
      }
      throw new Error(`Failed to get service: ${error.message}`);
    }
  }

  /**
   * List all Cloud Run services
   */
  async listServices() {
    const parent = this.getParent();

    try {
      const [services] = await this.runClient.listServices({ parent });
      return services;
    } catch (error) {
      throw new Error(`Failed to list services: ${error.message}`);
    }
  }

  /**
   * Delete a Cloud Run service
   */
  async deleteService(serviceName) {
    const name = this.getServicePath(serviceName);

    try {
      const [operation] = await this.runClient.deleteService({ name });
      await operation.promise();
      return true;
    } catch (error) {
      throw new Error(`Failed to delete service: ${error.message}`);
    }
  }

  /**
   * Make a Cloud Run service publicly accessible
   */
  async makeServicePublic(serviceName) {
    try {
      // Use gcloud command to set IAM policy
      const command = `gcloud run services add-iam-policy-binding ${serviceName} \
        --region=${this.region} \
        --member="allUsers" \
        --role="roles/run.invoker" \
        --project=${this.projectId} \
        --quiet`;

      execSync(command, { stdio: 'pipe' });
      return true;
    } catch (error) {
      throw new Error(`Failed to make service public: ${error.message}`);
    }
  }

  /**
   * Stream logs from Cloud Logging
   */
  async streamLogs(serviceName, callback, follow = false) {
    const log = this.logging.log('run.googleapis.com%2Fstdout');

    const filter = `resource.type="cloud_run_revision"
resource.labels.service_name="${serviceName}"
resource.labels.location="${this.region}"`;

    try {
      if (follow) {
        // For follow mode, poll for new entries
        let lastTimestamp = new Date();

        const pollInterval = setInterval(async () => {
          try {
            const [entries] = await log.getEntries({
              filter: `${filter} timestamp>="${lastTimestamp.toISOString()}"`,
              orderBy: 'timestamp asc',
              pageSize: 100
            });

            if (entries.length > 0) {
              entries.forEach(entry => callback(entry));
              lastTimestamp = new Date(entries[entries.length - 1].metadata.timestamp);
            }
          } catch (error) {
            console.error(`Error fetching logs: ${error.message}`);
          }
        }, 2000);

        // Return cleanup function
        return () => clearInterval(pollInterval);
      } else {
        // One-time fetch of recent logs
        const [entries] = await log.getEntries({
          filter,
          orderBy: 'timestamp desc',
          pageSize: 100
        });

        entries.reverse().forEach(entry => callback(entry));
        return null;
      }
    } catch (error) {
      throw new Error(`Failed to stream logs: ${error.message}`);
    }
  }

  /**
   * Check if gcloud is authenticated
   */
  static checkGcloudAuth() {
    try {
      execSync('gcloud auth list --filter=status:ACTIVE --format="value(account)"', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Configure Docker to use gcloud credentials
   */
  static configureDockerAuth(region) {
    try {
      execSync(`gcloud auth configure-docker ${region}-docker.pkg.dev --quiet`, { stdio: 'pipe' });
      return true;
    } catch (error) {
      throw new Error(`Failed to configure Docker authentication: ${error.message}`);
    }
  }

  /**
   * Check if Docker is running
   */
  static checkDockerRunning() {
    try {
      execSync('docker info', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the service URL
   */
  static getServiceUrl(service) {
    return service?.status?.url || service?.status?.address?.url || null;
  }
}
