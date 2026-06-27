import React from 'react';
import { Cloud, Database, Server } from 'lucide-react';
import Card from '../ui/Card';
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {providers.map((provider) => (
          <div
            key={provider.id}
            className={`${provider.id}-game-home`}
          >
            <div 
              className="game-card-wrapper"
              onClick={() => onSelect(provider.id as CloudProvider)}
            >
              <div className={`game-card-h ${selectedProvider === provider.id ? 'selected' : ''}`}>
                <div className={`provider-icon bg-gradient-to-br ${provider.color}`}>
                  {provider.icon}
                </div>
                <h3 className="text-xl font-bold mb-2">{provider.name}</h3>
                <p className="text-gray-400">{provider.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProviderSelector;