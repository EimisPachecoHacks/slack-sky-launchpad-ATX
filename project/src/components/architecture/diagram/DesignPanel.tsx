import React, { memo, useState, useMemo } from 'react';
import ResourcesPanel from './ResourcesPanel';
import ConnectionsPanel from './ConnectionsPanel';
import GuidePanel from './GuidePanel';
import { useArchitectureStore } from '../../../store';
import type { ResourceType, ConnectionType } from '../../../types';

interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  description?: string;
}

interface Connection {
  id: string;
  source: string;
  target: string;
  type: ConnectionType;
  label?: string;
}

interface DesignPanelProps {
  className?: string;
}

const DesignPanel: React.FC<DesignPanelProps> = memo(({ className = '' }) => {
  const [activeTab, setActiveTab] = useState<'resources' | 'connections' | 'guide'>('resources');
  const { current: architecture, addNode, removeNode } = useArchitectureStore();

  // Convert architecture nodes to resources
  const addedResources = useMemo(() => {
    if (!architecture) return [];
    return architecture.diagram.nodes.map(node => ({
      id: node.id,
      name: node.label,
      type: node.type as ResourceType,
      description: node.description
    }));
  }, [architecture]);

  // Convert architecture edges to connections
  const addedConnections = useMemo(() => {
    if (!architecture) return [];
    return architecture.diagram.edges.map(edge => ({
      id: edge.id,
      source: edge.from,
      target: edge.to,
      type: edge.type as ConnectionType,
      label: edge.type
    }));
  }, [architecture]);

  const handleAddResource = (resource: Omit<Resource, 'id'>) => {
    if (!architecture) return;

    const newNode = {
      id: `node-${Date.now()}`,
      x: 300,
      y: 200,
      width: 200,
      height: 100,
      label: resource.name,
      subLabel: resource.type,
      icon: resource.type === 'compute' ? '💻' :
            resource.type === 'storage' ? '💾' :
            resource.type === 'database' ? '🗄️' :
            resource.type === 'network' ? '🌐' : '⚙️',
      cost: 0,
      description: resource.description || '',
      isDragging: false,
      type: resource.type,
      provider: architecture.provider
    };

    addNode(newNode);
  };

  const handleRemoveResource = (id: string) => {
    removeNode(id);
  };

  const handleAddConnection = (connection: Omit<Connection, 'id'>) => {
    // This would use addEdge from the store
    // For now, connections are managed through the diagram
  };

  const handleRemoveConnection = (id: string) => {
    // This would use removeEdge from the store
    // For now, connections are managed through the diagram
  };

  const tabs = [
    { id: 'resources', label: '📦 Resources', component: ResourcesPanel },
    { id: 'connections', label: '🔗 Connections', component: ConnectionsPanel },
    { id: 'guide', label: '📋 Guide', component: GuidePanel }
  ];

  return (
    <div className={`${className} component-glass-card p-3 h-auto xl:h-[640px] overflow-hidden`}>
      <div className="h-full flex flex-col">
        {/* Tab Navigation */}
        <div className="flex mb-3 bg-background-secondary rounded-lg p-1">
          {tabs.map((tab) => (
            <button 
              key={tab.id}
              className={`flex-1 py-2 px-2 rounded-md text-xs font-medium transition-all duration-300 ${
                activeTab === tab.id 
                  ? 'component-button-primary text-white shadow-lg' 
                  : 'text-text-tertiary hover:text-text-primary hover:bg-blue-500/20'
              }`}
              onClick={() => setActiveTab(tab.id as any)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'resources' && (
            <ResourcesPanel
              resources={addedResources}
              onAddResource={handleAddResource}
              onRemoveResource={handleRemoveResource}
            />
          )}
          
          {activeTab === 'connections' && (
            <ConnectionsPanel
              connections={addedConnections}
              resources={addedResources}
              onAddConnection={handleAddConnection}
              onRemoveConnection={handleRemoveConnection}
            />
          )}
          
          {activeTab === 'guide' && <GuidePanel />}
        </div>
      </div>
    </div>
  );
});

DesignPanel.displayName = 'DesignPanel';

export default DesignPanel;