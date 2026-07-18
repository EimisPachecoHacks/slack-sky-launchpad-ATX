import React, { useState, useEffect, useRef } from 'react';
import { Cloud, Settings, Check, AlertCircle, Trash2, Plus, Upload, FileKey } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import GlowingCardWrapper from '../ui/GlowingCardWrapper';
import { env } from '../../config/env';
import type { CloudProvider, ProviderCredentials, AWSCredentials, AzureCredentials, GCPCredentials } from '../../types';

const CloudSettings: React.FC = () => {
  const [savedCredentials, setSavedCredentials] = useState<ProviderCredentials[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<CloudProvider | null>(null);
  const [validating, setValidating] = useState(false);
  const [credentialFile, setCredentialFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [serverCredsExist, setServerCredsExist] = useState<Record<string, boolean>>({});

  // Form states for each provider
  const [awsForm, setAwsForm] = useState({
    accountId: '',
    accountName: '',
    roleArn: '',
    externalId: '',
    region: 'us-east-1',
  });

  const [azureForm, setAzureForm] = useState({
    accountId: '',
    accountName: '',
    tenantId: '',
    clientId: '',
    subscriptionId: '',
    region: 'eastus',
  });

  const [gcpForm, setGcpForm] = useState({
    accountId: '',
    accountName: '',
    projectId: '',
    serviceAccountEmail: '',
    region: 'us-central1',
  });

  const [alicloudForm, setAlicloudForm] = useState({
    accountName: '',
    region: 'ap-southeast-1',
  });

  // Load saved credentials from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('cloudCredentials');
    if (stored) {
      try {
        setSavedCredentials(JSON.parse(stored));
      } catch (error) {
        console.error('Error loading credentials:', error);
      }
    }
  }, []);

  const checkServerCredentials = async (provider: string) => {
    try {
      const res = await fetch(`${env.apiUrl}/api/credentials/check/${provider}`);
      const data = await res.json();
      setServerCredsExist(prev => ({ ...prev, [provider]: data.exists }));
    } catch {
      setServerCredsExist(prev => ({ ...prev, [provider]: false }));
    }
  };

  const handleSaveCredentials = async () => {
    if (!selectedProvider) return;

    setValidating(true);
    setUploadStatus('');

    try {
      // Upload credential file to backend if provided
      if (credentialFile) {
        setUploadStatus('Uploading credential file...');
        const formData = new FormData();
        formData.append('file', credentialFile);
        formData.append('provider', selectedProvider);
        if (selectedProvider === 'gcp') {
          formData.append('project_id', gcpForm.projectId || gcpForm.accountId);
        }

        const response = await fetch(`${env.apiUrl}/api/credentials/upload`, {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();
        if (!result.success) {
          setUploadStatus(`Error: ${result.error || 'Upload failed'}`);
          setValidating(false);
          return;
        }
        setUploadStatus('Credential file stored securely on server');
      }

      // Save metadata to localStorage for the frontend
      const newCredential: ProviderCredentials = {
        id: Date.now().toString(),
        provider: selectedProvider,
        isDefault: savedCredentials.length === 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastValidated: new Date().toISOString(),
        status: 'active',
        ...(selectedProvider === 'aws' && {
          accountId: awsForm.accountId,
          accountName: awsForm.accountName,
          roleArn: awsForm.roleArn,
          externalId: awsForm.externalId,
          region: awsForm.region,
        } as AWSCredentials),
        ...(selectedProvider === 'azure' && {
          accountId: azureForm.accountId,
          accountName: azureForm.accountName,
          tenantId: azureForm.tenantId,
          clientId: azureForm.clientId,
          subscriptionId: azureForm.subscriptionId,
          region: azureForm.region,
        } as AzureCredentials),
        ...(selectedProvider === 'gcp' && {
          accountId: gcpForm.accountId,
          accountName: gcpForm.accountName,
          projectId: gcpForm.projectId,
          serviceAccountEmail: gcpForm.serviceAccountEmail,
          region: gcpForm.region,
        } as GCPCredentials),
        ...(selectedProvider === 'alicloud' && {
          accountName: alicloudForm.accountName,
          region: alicloudForm.region,
        }),
      } as ProviderCredentials;

      const updated = [...savedCredentials, newCredential];
      setSavedCredentials(updated);
      localStorage.setItem('cloudCredentials', JSON.stringify(updated));

      setShowForm(false);
      setSelectedProvider(null);
      setValidating(false);
      setCredentialFile(null);
      setUploadStatus('');
      resetForms();
    } catch (err) {
      setUploadStatus(`Error: ${err instanceof Error ? err.message : 'Connection failed'}`);
      setValidating(false);
    }
  };

  const resetForms = () => {
    setAwsForm({
      accountId: '',
      accountName: '',
      roleArn: '',
      externalId: '',
      region: 'us-east-1',
    });
    setAzureForm({
      accountId: '',
      accountName: '',
      tenantId: '',
      clientId: '',
      subscriptionId: '',
      region: 'eastus',
    });
    setGcpForm({
      accountId: '',
      accountName: '',
      projectId: '',
      serviceAccountEmail: '',
      region: 'us-central1',
    });
    setAlicloudForm({
      accountName: '',
      region: 'ap-southeast-1',
    });
  };

  const handleDeleteCredential = (id: string) => {
    const updated = savedCredentials.filter(cred => cred.id !== id);
    setSavedCredentials(updated);
    localStorage.setItem('cloudCredentials', JSON.stringify(updated));
  };

  const handleSetDefault = (id: string) => {
    const updated = savedCredentials.map(cred => ({
      ...cred,
      isDefault: cred.id === id,
    }));
    setSavedCredentials(updated);
    localStorage.setItem('cloudCredentials', JSON.stringify(updated));
  };

  const getProviderColor = (provider: CloudProvider) => {
    switch (provider) {
      case 'aws': return 'from-orange-500 to-yellow-500';
      case 'azure': return 'from-blue-500 to-blue-700';
      case 'gcp': return 'from-green-500 to-teal-500';
      case 'alicloud': return 'from-orange-400 to-red-500';
    }
  };

  const getProviderName = (provider: CloudProvider) => {
    switch (provider) {
      case 'aws': return 'Amazon Web Services';
      case 'azure': return 'Microsoft Azure';
      case 'gcp': return 'Google Cloud Platform';
      case 'alicloud': return 'Alibaba Cloud';
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16 relative overflow-hidden">
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex items-center space-x-4 mb-8">
          <Settings className="w-10 h-10 text-blue-400" />
          <div>
            <h1 className="text-4xl font-bold">Cloud Provider Settings</h1>
            <p className="text-text-secondary mt-2">Configure your cloud provider credentials to deploy architectures</p>
          </div>
        </div>

        {/* Saved Credentials List */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Connected Accounts</h2>
          {savedCredentials.length === 0 ? (
            <Card variant="glass" className="p-8 text-center">
              <Cloud className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-text-secondary text-lg">No cloud accounts configured yet</p>
              <p className="text-text-secondary text-sm mt-2">Add your first cloud provider to start deploying architectures</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {savedCredentials.map((credential) => (
                <GlowingCardWrapper key={credential.id}>
                  <Card variant="glass" className="p-6" hover={true}>
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${getProviderColor(credential.provider)} flex items-center justify-center`}>
                        <Cloud className="w-6 h-6 text-white" />
                      </div>
                      {credential.isDefault && (
                        <span className="px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded text-xs text-blue-400">
                          Default
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-bold mb-1">{credential.accountName || 'Unnamed Account'}</h3>
                    <p className="text-sm text-text-secondary mb-2">{getProviderName(credential.provider)}</p>
                    <p className="text-xs text-text-secondary mb-1">Account: {credential.accountId}</p>
                    {credential.region && (
                      <p className="text-xs text-text-secondary mb-4">Region: {credential.region}</p>
                    )}

                    <div className="flex items-center space-x-2 mb-4">
                      {credential.status === 'active' ? (
                        <>
                          <Check className="w-4 h-4 text-green-400" />
                          <span className="text-xs text-green-400">Active</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-red-400" />
                          <span className="text-xs text-red-400">Invalid</span>
                        </>
                      )}
                    </div>

                    <div className="flex space-x-2">
                      {!credential.isDefault && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSetDefault(credential.id)}
                          className="flex-1"
                        >
                          Set Default
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteCredential(credential.id)}
                        icon={<Trash2 className="w-4 h-4" />}
                        className="text-red-400 border-red-400 hover:bg-red-400/10"
                      >
                        {credential.isDefault ? 'Remove' : ''}
                      </Button>
                    </div>
                  </Card>
                </GlowingCardWrapper>
              ))}
            </div>
          )}
        </div>

        {/* Add New Credential Button */}
        {!showForm && (
          <Button
            onClick={() => setShowForm(true)}
            icon={<Plus className="w-5 h-5" />}
            size="lg"
          >
            Add Cloud Provider
          </Button>
        )}

        {/* Provider Selection */}
        {showForm && !selectedProvider && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold mb-6 text-center">Select Cloud Provider</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
              {(['aws', 'azure', 'gcp', 'alicloud'] as CloudProvider[]).map((provider) => (
                <div
                  key={provider}
                  className={`${provider}-game-home`}
                  onClick={() => { setSelectedProvider(provider); checkServerCredentials(provider); }}
                >
                  <div className="game-card-wrapper">
                    <div className="game-card-h">
                      <div className={`provider-icon bg-gradient-to-br ${getProviderColor(provider)}`}>
                        <Cloud className="w-10 h-10 text-white" />
                      </div>
                      <h3 className="text-xl font-bold mb-2">{provider.toUpperCase()}</h3>
                      <p className="text-gray-400">{getProviderName(provider)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AWS Form */}
        {showForm && selectedProvider === 'aws' && (
          <div className="mt-8">
            <Card variant="glass" className="p-8">
              <h2 className="text-2xl font-bold mb-6">Configure AWS Account</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Account Name (Optional)</label>
                  <input
                    type="text"
                    value={awsForm.accountName}
                    onChange={(e) => setAwsForm({ ...awsForm, accountName: e.target.value })}
                    className="w-full px-4 py-2 bg-black/20 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="e.g., Production AWS Account"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">AWS Account ID *</label>
                  <input
                    type="text"
                    value={awsForm.accountId}
                    onChange={(e) => setAwsForm({ ...awsForm, accountId: e.target.value })}
                    className="w-full px-4 py-2 bg-black/20 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="123456789012"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">IAM Role ARN *</label>
                  <input
                    type="text"
                    value={awsForm.roleArn}
                    onChange={(e) => setAwsForm({ ...awsForm, roleArn: e.target.value })}
                    className="w-full px-4 py-2 bg-black/20 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="arn:aws:iam::123456789012:role/YourRoleName"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">External ID (Optional)</label>
                  <input
                    type="text"
                    value={awsForm.externalId}
                    onChange={(e) => setAwsForm({ ...awsForm, externalId: e.target.value })}
                    className="w-full px-4 py-2 bg-black/20 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="External ID for cross-account access"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Default Region *</label>
                  <select
                    value={awsForm.region}
                    onChange={(e) => setAwsForm({ ...awsForm, region: e.target.value })}
                    className="w-full px-4 py-2 bg-black/20 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="us-east-1">US East (N. Virginia)</option>
                    <option value="us-west-2">US West (Oregon)</option>
                    <option value="eu-west-1">EU (Ireland)</option>
                    <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                  </select>
                </div>

                <div className="mt-6">
                  <label className="block text-sm font-medium mb-2">
                    <FileKey className="w-4 h-4 inline mr-1" />
                    AWS Access Keys File (.csv) {serverCredsExist['aws'] ? '(already stored on server)' : '*'}
                  </label>
                  {serverCredsExist['aws'] && !credentialFile && (
                    <div className="flex items-center space-x-2 mb-3 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <Check className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-green-400">Credentials already stored securely on server. Upload new file to replace.</span>
                    </div>
                  )}
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
                      credentialFile
                        ? 'border-green-500 bg-green-500/10'
                        : serverCredsExist['aws']
                        ? 'border-green-700 hover:border-blue-500 hover:bg-blue-500/5'
                        : 'border-gray-700 hover:border-blue-500 hover:bg-blue-500/5'
                    }`}
                    onClick={() => document.getElementById('aws-cred-file')?.click()}
                  >
                    {credentialFile ? (
                      <div className="flex items-center justify-center space-x-2">
                        <Check className="w-5 h-5 text-green-400" />
                        <span className="text-green-400 font-medium">{credentialFile.name}</span>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-400">Click to upload your AWS Access Keys CSV</p>
                        <p className="text-xs text-gray-500 mt-1">Downloaded from IAM → Users → Security credentials → Create access key</p>
                      </div>
                    )}
                  </div>
                  <input
                    id="aws-cred-file"
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setCredentialFile(e.target.files[0]);
                    }}
                  />
                </div>

                {uploadStatus && (
                  <div className={`mt-3 text-sm ${uploadStatus.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>
                    {uploadStatus}
                  </div>
                )}

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mt-6">
                  <h4 className="font-bold mb-2 text-blue-400">Setup Instructions:</h4>
                  <ol className="text-sm space-y-2 text-text-secondary">
                    <li>1. Log in to your AWS Console</li>
                    <li>2. Navigate to IAM → Users → Your User</li>
                    <li>3. Go to Security credentials → Create access key</li>
                    <li>4. Download the CSV file and upload it above</li>
                    <li>5. Fill in the Account ID and Role ARN fields</li>
                  </ol>
                </div>

                <div className="flex space-x-4 mt-6">
                  <Button
                    onClick={handleSaveCredentials}
                    disabled={!awsForm.accountId || (!credentialFile && !serverCredsExist['aws']) || validating}
                    icon={validating ? undefined : <Check className="w-5 h-5" />}
                  >
                    {validating ? 'Validating...' : 'Save Configuration'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      setSelectedProvider(null);
                      resetForms();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Azure Form */}
        {showForm && selectedProvider === 'azure' && (
          <div className="mt-8">
            <Card variant="glass" className="p-8">
              <h2 className="text-2xl font-bold mb-6">Configure Azure Account</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Account Name (Optional)</label>
                  <input
                    type="text"
                    value={azureForm.accountName}
                    onChange={(e) => setAzureForm({ ...azureForm, accountName: e.target.value })}
                    className="w-full px-4 py-2 bg-black/20 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="e.g., Production Azure Account"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Subscription ID *</label>
                  <input
                    type="text"
                    value={azureForm.accountId}
                    onChange={(e) => setAzureForm({ ...azureForm, accountId: e.target.value, subscriptionId: e.target.value })}
                    className="w-full px-4 py-2 bg-black/20 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Tenant ID *</label>
                  <input
                    type="text"
                    value={azureForm.tenantId}
                    onChange={(e) => setAzureForm({ ...azureForm, tenantId: e.target.value })}
                    className="w-full px-4 py-2 bg-black/20 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Client ID (Application ID) *</label>
                  <input
                    type="text"
                    value={azureForm.clientId}
                    onChange={(e) => setAzureForm({ ...azureForm, clientId: e.target.value })}
                    className="w-full px-4 py-2 bg-black/20 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Default Region *</label>
                  <select
                    value={azureForm.region}
                    onChange={(e) => setAzureForm({ ...azureForm, region: e.target.value })}
                    className="w-full px-4 py-2 bg-black/20 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="eastus">East US</option>
                    <option value="westus">West US</option>
                    <option value="westeurope">West Europe</option>
                    <option value="southeastasia">Southeast Asia</option>
                  </select>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mt-6">
                  <h4 className="font-bold mb-2 text-blue-400">Setup Instructions:</h4>
                  <ol className="text-sm space-y-2 text-text-secondary">
                    <li>1. Log in to Azure Portal</li>
                    <li>2. Navigate to Azure Active Directory</li>
                    <li>3. Create or select an App Registration</li>
                    <li>4. Copy the Application (client) ID and Directory (tenant) ID</li>
                    <li>5. Assign appropriate roles to the service principal</li>
                  </ol>
                </div>

                <div className="flex space-x-4 mt-6">
                  <Button
                    onClick={handleSaveCredentials}
                    disabled={!azureForm.accountId || !azureForm.tenantId || !azureForm.clientId || validating}
                    icon={validating ? undefined : <Check className="w-5 h-5" />}
                  >
                    {validating ? 'Validating...' : 'Save Configuration'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      setSelectedProvider(null);
                      resetForms();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* GCP Form */}
        {showForm && selectedProvider === 'gcp' && (
          <div className="mt-8">
            <Card variant="glass" className="p-8">
              <h2 className="text-2xl font-bold mb-6">Configure GCP Account</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Account Name (Optional)</label>
                  <input
                    type="text"
                    value={gcpForm.accountName}
                    onChange={(e) => setGcpForm({ ...gcpForm, accountName: e.target.value })}
                    className="w-full px-4 py-2 bg-black/20 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="e.g., Production GCP Account"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Project ID *</label>
                  <input
                    type="text"
                    value={gcpForm.accountId}
                    onChange={(e) => setGcpForm({ ...gcpForm, accountId: e.target.value, projectId: e.target.value })}
                    className="w-full px-4 py-2 bg-black/20 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="my-project-id"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Service Account Email (Optional)</label>
                  <input
                    type="email"
                    value={gcpForm.serviceAccountEmail}
                    onChange={(e) => setGcpForm({ ...gcpForm, serviceAccountEmail: e.target.value })}
                    className="w-full px-4 py-2 bg-black/20 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="service-account@project.iam.gserviceaccount.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Default Region *</label>
                  <select
                    value={gcpForm.region}
                    onChange={(e) => setGcpForm({ ...gcpForm, region: e.target.value })}
                    className="w-full px-4 py-2 bg-black/20 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="us-central1">US Central 1</option>
                    <option value="us-east1">US East 1</option>
                    <option value="europe-west1">Europe West 1</option>
                    <option value="asia-southeast1">Asia Southeast 1</option>
                  </select>
                </div>

                <div className="mt-6">
                  <label className="block text-sm font-medium mb-2">
                    <FileKey className="w-4 h-4 inline mr-1" />
                    Service Account JSON File {serverCredsExist['gcp'] ? '(already stored on server)' : '*'}
                  </label>
                  {serverCredsExist['gcp'] && !credentialFile && (
                    <div className="flex items-center space-x-2 mb-3 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <Check className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-green-400">Credentials already stored securely on server. Upload new file to replace.</span>
                    </div>
                  )}
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
                      credentialFile
                        ? 'border-green-500 bg-green-500/10'
                        : serverCredsExist['gcp']
                        ? 'border-green-700 hover:border-blue-500 hover:bg-blue-500/5'
                        : 'border-gray-700 hover:border-blue-500 hover:bg-blue-500/5'
                    }`}
                    onClick={() => document.getElementById('gcp-cred-file')?.click()}
                  >
                    {credentialFile ? (
                      <div className="flex items-center justify-center space-x-2">
                        <Check className="w-5 h-5 text-green-400" />
                        <span className="text-green-400 font-medium">{credentialFile.name}</span>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-400">Click to upload your GCP Service Account JSON</p>
                        <p className="text-xs text-gray-500 mt-1">Downloaded from IAM & Admin → Service Accounts → Keys → Add Key</p>
                      </div>
                    )}
                  </div>
                  <input
                    id="gcp-cred-file"
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setCredentialFile(e.target.files[0]);
                        // Auto-fill project ID from JSON filename pattern
                        const file = e.target.files[0];
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          try {
                            const json = JSON.parse(ev.target?.result as string);
                            if (json.project_id && !gcpForm.accountId) {
                              setGcpForm(prev => ({ ...prev, accountId: json.project_id, projectId: json.project_id }));
                            }
                            if (json.client_email && !gcpForm.serviceAccountEmail) {
                              setGcpForm(prev => ({ ...prev, serviceAccountEmail: json.client_email }));
                            }
                          } catch { /* ignore parse errors */ }
                        };
                        reader.readAsText(file);
                      }
                    }}
                  />
                </div>

                {uploadStatus && (
                  <div className={`mt-3 text-sm ${uploadStatus.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>
                    {uploadStatus}
                  </div>
                )}

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mt-6">
                  <h4 className="font-bold mb-2 text-blue-400">Setup Instructions:</h4>
                  <ol className="text-sm space-y-2 text-text-secondary">
                    <li>1. Log in to Google Cloud Console</li>
                    <li>2. Select or create a project</li>
                    <li>3. Navigate to IAM & Admin → Service Accounts</li>
                    <li>4. Create a service account with Editor role</li>
                    <li>5. Go to Keys → Add Key → Create new key → JSON</li>
                    <li>6. Upload the downloaded JSON file above</li>
                  </ol>
                </div>

                <div className="flex space-x-4 mt-6">
                  <Button
                    onClick={handleSaveCredentials}
                    disabled={!gcpForm.accountId || (!credentialFile && !serverCredsExist['gcp']) || validating}
                    icon={validating ? undefined : <Check className="w-5 h-5" />}
                  >
                    {validating ? 'Validating...' : 'Save Configuration'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      setSelectedProvider(null);
                      resetForms();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Alibaba Cloud Form */}
        {showForm && selectedProvider === 'alicloud' && (
          <div className="mt-8">
            <Card variant="glass" className="p-8">
              <h2 className="text-2xl font-bold mb-6">Configure Alibaba Cloud Account</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Account Name (Optional)</label>
                  <input
                    type="text"
                    value={alicloudForm.accountName}
                    onChange={(e) => setAlicloudForm({ ...alicloudForm, accountName: e.target.value })}
                    className="w-full px-4 py-2 bg-black/20 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="e.g., Production Alibaba Cloud"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Default Region *</label>
                  <select
                    value={alicloudForm.region}
                    onChange={(e) => setAlicloudForm({ ...alicloudForm, region: e.target.value })}
                    className="w-full px-4 py-2 bg-black/20 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="ap-southeast-1">Singapore (ap-southeast-1)</option>
                    <option value="ap-southeast-5">Jakarta (ap-southeast-5)</option>
                    <option value="us-west-1">US West (us-west-1)</option>
                    <option value="eu-central-1">Frankfurt (eu-central-1)</option>
                    <option value="cn-hangzhou">China Hangzhou (cn-hangzhou)</option>
                  </select>
                </div>

                <div className="mt-6">
                  <label className="block text-sm font-medium mb-2">
                    <FileKey className="w-4 h-4 inline mr-1" />
                    RAM AccessKey JSON or CSV {serverCredsExist['alicloud'] ? '(already stored on server)' : '*'}
                  </label>
                  {serverCredsExist['alicloud'] && !credentialFile && (
                    <div className="flex items-center space-x-2 mb-3 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <Check className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-green-400">Credentials already stored securely on server. Upload new file to replace.</span>
                    </div>
                  )}
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
                      credentialFile
                        ? 'border-green-500 bg-green-500/10'
                        : serverCredsExist['alicloud']
                        ? 'border-green-700 hover:border-blue-500 hover:bg-blue-500/5'
                        : 'border-gray-700 hover:border-blue-500 hover:bg-blue-500/5'
                    }`}
                    onClick={() => document.getElementById('alicloud-cred-file')?.click()}
                  >
                    {credentialFile ? (
                      <div className="flex items-center justify-center space-x-2">
                        <Check className="w-5 h-5 text-green-400" />
                        <span className="text-green-400 font-medium">{credentialFile.name}</span>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-400">Upload the RAM AccessKey JSON or Alibaba console CSV</p>
                        <p className="text-xs text-gray-500 mt-1">Secrets are encrypted locally and never committed to Git.</p>
                      </div>
                    )}
                  </div>
                  <input
                    id="alicloud-cred-file"
                    type="file"
                    accept=".json,.csv,text/csv,application/json"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setCredentialFile(e.target.files[0]);
                      }
                    }}
                  />
                </div>

                {uploadStatus && (
                  <div className={`mt-3 text-sm ${uploadStatus.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>
                    {uploadStatus}
                  </div>
                )}

                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 mt-6">
                  <h4 className="font-bold mb-2 text-orange-400">Setup Instructions:</h4>
                  <ol className="text-sm space-y-2 text-text-secondary">
                    <li>1. Log in to the Alibaba Cloud Console</li>
                    <li>2. Go to RAM → Users → create a user with programmatic access</li>
                    <li>3. Grant it ECS / VPC / OSS permissions (e.g. AliyunECSFullAccess, AliyunVPCFullAccess, AliyunOSSFullAccess)</li>
                    <li>4. Create an AccessKey for that user</li>
                    <li>5. Download Alibaba's AccessKey CSV, or save the documented JSON format</li>
                    <li>6. Upload the file above; it is encrypted at rest</li>
                  </ol>
                </div>

                <div className="flex space-x-4 mt-6">
                  <Button
                    onClick={handleSaveCredentials}
                    disabled={(!credentialFile && !serverCredsExist['alicloud']) || validating}
                    icon={validating ? undefined : <Check className="w-5 h-5" />}
                  >
                    {validating ? 'Validating...' : 'Save Configuration'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      setSelectedProvider(null);
                      resetForms();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default CloudSettings;
