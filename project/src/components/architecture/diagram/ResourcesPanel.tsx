import React, { memo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import Button from '../../ui/Button';
import type { ResourceType } from '../../../types';

interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  description?: string;
}

interface ResourcesPanelProps {
  resources: Resource[];
  onAddResource: (resource: Omit<Resource, 'id'>) => void;
  onRemoveResource: (id: string) => void;
}

const ResourcesPanel: React.FC<ResourcesPanelProps> = memo(({ 
  resources, 
  onAddResource, 
  onRemoveResource 
}) => {
  const [newResource, setNewResource] = useState({
    name: '',
    type: '' as ResourceType | '',
    description: ''
  });

  const handleAddResource = () => {
    if (newResource.name && newResource.type) {
      onAddResource({
        name: newResource.name,
        type: newResource.type as ResourceType,
        description: newResource.description
      });
      setNewResource({ name: '', type: '', description: '' });
    }
  };

  const resourceTypes: { value: ResourceType; label: string }[] = [
    { value: 'compute', label: 'Compute' },
    { value: 'storage', label: 'Storage' },
    { value: 'database', label: 'Database' },
    { value: 'network', label: 'Network' },
    { value: 'security', label: 'Security' },
    { value: 'serverless', label: 'Serverless' },
    { value: 'analytics', label: 'Analytics' },
    { value: 'ml', label: 'Machine Learning' },
    { value: 'container', label: 'Container' }
  ];

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">
            Resource Name
          </label>
          <input
            type="text"
            value={newResource.name}
            onChange={(e) => setNewResource({ ...newResource, name: e.target.value })}
            placeholder="e.g., WebApp, SQL Database"
            className="w-full px-2 py-1.5 text-xs bg-background-secondary border border-blue-500/30 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500/60 rounded-lg"
          />
        </div>
        
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">
            Resource Type
          </label>
          <select
            value={newResource.type}
            onChange={(e) => setNewResource({ ...newResource, type: e.target.value as ResourceType })}
            className="w-full px-2 py-1.5 text-xs bg-background-secondary border border-blue-500/30 text-text-primary focus:outline-none focus:border-blue-500/60 rounded-lg"
          >
            <option value="">Select resource type</option>
            {resourceTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">
            Description (Optional)
          </label>
          <textarea
            value={newResource.description}
            onChange={(e) => setNewResource({ ...newResource, description: e.target.value })}
            placeholder="Brief description of this resource"
            rows={2}
            className="w-full px-2 py-1.5 text-xs bg-background-secondary border border-blue-500/30 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500/60 rounded-lg resize-none"
          />
        </div>
        
        <Button
          onClick={handleAddResource}
          className="w-full"
          size="sm"
          disabled={!newResource.name || !newResource.type}
        >
          Add Resource
        </Button>
      </div>
      
      <div>
        <h4 className="text-xs font-medium text-text-secondary mb-2">Added Resources</h4>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {resources.map((resource) => (
            <div 
              key={resource.id} 
              className="flex items-center justify-between p-2 bg-background-secondary border border-blue-500/20 rounded-lg"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-text-primary text-xs truncate">
                  {resource.name}
                </div>
                <div className="text-xs text-text-tertiary">
                  ({resourceTypes.find(t => t.value === resource.type)?.label || resource.type})
                </div>
              </div>
              <button
                onClick={() => onRemoveResource(resource.id)}
                className="p-1 text-red-400 hover:text-red-300 transition-colors flex-shrink-0 ml-2"
                title="Remove resource"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          
          {resources.length === 0 && (
            <div className="text-xs text-text-tertiary text-center py-4">
              No resources added yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

ResourcesPanel.displayName = 'ResourcesPanel';

export default ResourcesPanel;