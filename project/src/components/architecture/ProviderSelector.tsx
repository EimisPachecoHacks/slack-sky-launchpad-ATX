import React from 'react';
import { Cloud, Database, Server } from 'lucide-react';
import { CloudProvider } from '../../types';

interface ProviderSelectorProps {
  selectedProvider: CloudProvider | null;
  onSelect: (provider: CloudProvider) => void;
}

const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  selectedProvider,
  onSelect
}) => {
  const providers = [
    {
      id: 'alicloud',
      name: 'Alibaba Cloud',
      icon: <Cloud className="w-10 h-10 text-orange-400" />,
      description: 'Alibaba Cloud (alicloud)',
      color: 'from-orange-400 to-red-500'
    },
    {
      id: 'aws',
      name: 'AWS',
      icon: <Cloud className="w-10 h-10 text-orange-500" />,
      description: 'Amazon Web Services',
      color: 'from-orange-500 to-yellow-500'
    },
    {
      id: 'azure',
      name: 'Azure',
      icon: <Database className="w-10 h-10 text-blue-500" />,
      description: 'Microsoft Azure',
      color: 'from-blue-500 to-blue-700'
    },
    {
      id: 'gcp',
      name: 'GCP',
      icon: <Server className="w-10 h-10 text-green-500" />,
      description: 'Google Cloud Platform',
      color: 'from-green-500 to-teal-500'
    }
  ];

  return (
    <div className="py-8">
      <h2 className="text-2xl font-bold mb-6 text-center">Select Cloud Provider</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
        {providers.map((provider) => (
          <div
            key={provider.id}
            className={`${provider.id}-game-home`}
          >
            <button
              type="button"
              className="game-card-wrapper w-full text-left"
              onClick={() => onSelect(provider.id as CloudProvider)}
              aria-pressed={selectedProvider === provider.id}
              aria-label={`Select ${provider.name}`}
            >
              <div className={`game-card-h ${selectedProvider === provider.id ? 'selected' : ''}`}>
                <div className={`provider-icon bg-gradient-to-br ${provider.color}`}>
                  {provider.icon}
                </div>
                <h3 className="text-xl font-bold mb-2">{provider.name}</h3>
                <p className="text-gray-400">{provider.description}</p>
              </div>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProviderSelector;
