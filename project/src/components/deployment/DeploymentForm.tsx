import React, { useState, useEffect } from 'react';
import { Github, GitBranch, ExternalLink, Cloud, AlertCircle } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Architecture, DeploymentConfig } from '../../types';
import { env } from '../../config/env';

interface DeploymentFormProps {
  architecture: Architecture;
  onDeploy: (config: DeploymentConfig) => void;
}

interface SavedCredential {
  id: string;
  provider: string;
  accountId: string;
  accountName?: string;
  roleArn?: string;
  isDefault: boolean;
}

const regionsByProvider: Record<string, string[]> = {
  aws: ['us-east-1', 'us-east-2', 'us-west-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'ap-northeast-1', 'ap-southeast-1'],
  azure: ['westus', 'westus2', 'eastus', 'eastus2', 'westeurope', 'northeurope', 'southeastasia', 'eastasia'],
  gcp: ['us-central1', 'us-west1', 'us-east1', 'us-east4', 'europe-west1', 'europe-west4', 'asia-east1', 'asia-southeast1']
};

const DeploymentForm: React.FC<DeploymentFormProps> = ({ architecture, onDeploy }) => {
  const providerRegions = regionsByProvider[architecture.provider] || regionsByProvider.aws;
  const [region, setRegion] = useState(providerRegions[0]);
  const [githubRepo, setGithubRepo] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [availableAccounts, setAvailableAccounts] = useState<SavedCredential[]>([]);

  const regions = regionsByProvider;

  useEffect(() => {
    const loadCredentials = async () => {
      try {
        // First check localStorage
        const saved = localStorage.getItem('cloudCredentials');
        let localCreds: SavedCredential[] = [];
        if (saved) {
          const allCredentials: SavedCredential[] = JSON.parse(saved);
          localCreds = allCredentials.filter(
            (cred) => cred.provider === architecture.provider
          );
        }

        // Also check server-side credentials
        let serverCreds: SavedCredential[] = [];
        try {
          const res = await fetch(`${env.apiUrl}/api/credentials/list`);
          const data = await res.json();
          if (data.accounts) {
            serverCreds = data.accounts.filter(
              (a: SavedCredential) => a.provider === architecture.provider
            );
          }
        } catch {
          console.warn('Could not check server credentials');
        }

        // Merge: prefer local, add server-side accounts not already present
        const localIds = new Set(localCreds.map(c => c.id));
        const merged = [...localCreds, ...serverCreds.filter(s => !localIds.has(s.id))];
        setAvailableAccounts(merged);

        const defaultAccount = merged.find((cred) => cred.isDefault);
        if (defaultAccount) {
          setSelectedAccount(defaultAccount.id);
        } else if (merged.length > 0) {
          setSelectedAccount(merged[0].id);
        }
      } catch (error) {
        console.error('Error loading cloud credentials:', error);
      }
    };

    loadCredentials();
  }, [architecture.provider]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    onDeploy({
      provider: architecture.provider,
      region,
      architecture,
      githubRepo: githubRepo.trim() !== '' ? githubRepo : undefined,
      accountId: selectedAccount
    });
  };

  return (
    <div className={`${architecture.provider}-theme max-w-3xl mx-auto`}>
      <div className="component-glass-card p-8">
      <div className="flex items-center space-x-4 mb-6">
        <div className="w-12 h-12 rounded-full bg-blue-900/30 flex items-center justify-center">
          <ExternalLink className="w-6 h-6 text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold">Deploy Architecture</h2>
      </div>
      
      <p className="text-gray-300 mb-8">
        Configure your deployment settings for the {architecture.provider.toUpperCase()} architecture.
      </p>
      
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Cloud Account Selection */}
          <div>
            <label htmlFor="account" className="block text-sm font-medium text-gray-300 mb-2">
              Cloud Account
            </label>
            {availableAccounts.length > 0 ? (
              <div className="relative">
                <select
                  id="account"
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="w-full component-form-input rounded-lg px-4 py-2 appearance-none"
                  required
                >
                  {availableAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.accountName || `Account ${account.accountId}`}
                      {' - '}
                      {account.accountId}
                      {account.isDefault ? ' (Default)' : ''}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Cloud className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            ) : (
              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-yellow-200 font-medium">No {architecture.provider.toUpperCase()} accounts configured</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Please go to <a href="/settings" className="text-blue-400 hover:underline">Cloud Settings</a> to add your {architecture.provider.toUpperCase()} account credentials before deploying.
                  </p>
                </div>
              </div>
            )}
            <p className="mt-2 text-sm text-gray-500">
              Select the cloud account where you want to deploy your architecture.
            </p>
          </div>

          <div>
            <label htmlFor="region" className="block text-sm font-medium text-gray-300 mb-2">
              Region
            </label>
            <select
              id="region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full component-form-input rounded-lg px-4 py-2"
            >
              {regions[architecture.provider].map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
            <p className="mt-2 text-sm text-gray-500">
              Select the region where you want to deploy your resources.
            </p>
          </div>

          <div>
            <label htmlFor="github" className="block text-sm font-medium text-gray-300 mb-2">
              GitHub Repository (Optional)
            </label>
            <div className="flex items-center space-x-2">
              <div className="bg-gray-800 border border-gray-700 rounded-l-lg px-3 py-2 text-gray-400">
                <Github className="w-5 h-5" />
              </div>
              <input
                id="github"
                type="text"
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
                placeholder="username/repository"
                className="flex-1 component-form-input rounded-lg px-4 py-2"
              />
            </div>
            <p className="mt-2 text-sm text-gray-500">
              The generated infrastructure code will be committed to this repository.
            </p>
          </div>
          
          <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-500/30">
            <div className="flex items-center space-x-2 mb-2">
              <GitBranch className="w-5 h-5 component-text-accent" />
              <h4 className="font-medium">Deployment Steps</h4>
            </div>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-start space-x-2">
                <span className="text-blue-400 text-lg">•</span>
                <span>The infrastructure code will be generated based on your architecture</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-blue-400 text-lg">•</span>
                <span>If a GitHub repository is provided, the code will be committed</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-blue-400 text-lg">•</span>
                <span>The deployment process will be executed using Terraform/CloudFormation</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-blue-400 text-lg">•</span>
                <span>You'll receive status updates and logs during the deployment</span>
              </li>
            </ul>
          </div>
          
          <div className="flex justify-end">
            <Button
              type="submit"
              size="lg"
              className="group component-button-primary"
              disabled={availableAccounts.length === 0}
            >
              Deploy Architecture
              <ExternalLink className="ml-2 w-5 h-5 transform transition-transform group-hover:translate-x-1" />
            </Button>
          </div>
        </div>
      </form>
      </div>
    </div>
  );
};

export default DeploymentForm;