import React, { memo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import Button from '../../ui/Button';
import type { ConnectionType } from '../../../types';

interface Connection {
  id: string;
  source: string;
  target: string;
  type: ConnectionType;
  label?: string;
}

interface Resource {
  id: string;
  name: string;
}

interface ConnectionsPanelProps {
  connections: Connection[];
  resources: Resource[];
  onAddConnection: (connection: Omit<Connection, 'id'>) => void;
  onRemoveConnection: (id: string) => void;
}

const ConnectionsPanel: React.FC<ConnectionsPanelProps> = memo(({ 
  connections, 
  resources, 
  onAddConnection, 
  onRemoveConnection 
}) => {
  const [newConnection, setNewConnection] = useState({
    source: '',
    target: '',
    type: '' as ConnectionType | '',
    label: ''
  });

  const handleAddConnection = () => {
    if (newConnection.source && newConnection.target && newConnection.type) {
      onAddConnection({
        source: newConnection.source,
        target: newConnection.target,
        type: newConnection.type as ConnectionType,
        label: newConnection.label
      });
      setNewConnection({ source: '', target: '', type: '', label: '' });
    }
  };

  const connectionTypes: { value: ConnectionType; label: string }[] = [
    { value: 'HTTP/HTTPS', label: 'HTTP/HTTPS' },
    { value: 'TCP/IP', label: 'TCP/IP' },
    { value: 'Message Queue', label: 'Message Queue' },
    { value: 'Event', label: 'Event' },
    { value: 'Database', label: 'Database' },
    { value: 'API', label: 'API' },
    { value: 'WebSocket', label: 'WebSocket' }
  ];

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">
            Source Resource
          </label>
          <select
            value={newConnection.source}
            onChange={(e) => setNewConnection({ ...newConnection, source: e.target.value })}
            className="w-full px-2 py-1.5 text-xs bg-background-secondary border border-blue-500/30 text-text-primary focus:outline-none focus:border-blue-500/60 rounded-lg"
          >
            <option value="">Select source resource</option>
            {resources.map((resource) => (
              <option key={resource.id} value={resource.name}>
                {resource.name}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">
            Target Resource
          </label>
          <select
            value={newConnection.target}
            onChange={(e) => setNewConnection({ ...newConnection, target: e.target.value })}
            className="w-full px-2 py-1.5 text-xs bg-background-secondary border border-blue-500/30 text-text-primary focus:outline-none focus:border-blue-500/60 rounded-lg"
          >
            <option value="">Select target resource</option>
            {resources.map((resource) => (
              <option key={resource.id} value={resource.name}>
                {resource.name}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">
            Connection Type
          </label>
          <select
            value={newConnection.type}
            onChange={(e) => setNewConnection({ ...newConnection, type: e.target.value as ConnectionType })}
            className="w-full px-2 py-1.5 text-xs bg-background-secondary border border-blue-500/30 text-text-primary focus:outline-none focus:border-blue-500/60 rounded-lg"
          >
            <option value="">Select connection type</option>
            {connectionTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">
            Label (Optional)
          </label>
          <input
            type="text"
            value={newConnection.label}
            onChange={(e) => setNewConnection({ ...newConnection, label: e.target.value })}
            placeholder="e.g., HTTP, TCP/IP"
            className="w-full px-2 py-1.5 text-xs bg-background-secondary border border-blue-500/30 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500/60 rounded-lg"
          />
        </div>
        
        <Button
          onClick={handleAddConnection}
          className="w-full"
          size="sm"
          disabled={!newConnection.source || !newConnection.target || !newConnection.type}
        >
          Add Connection
        </Button>
      </div>
      
      <div>
        <h4 className="text-xs font-medium text-text-secondary mb-2">Added Connections</h4>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {connections.map((connection) => (
            <div 
              key={connection.id} 
              className="flex items-center justify-between p-2 bg-background-secondary border border-blue-500/20 rounded-lg"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-text-primary text-xs truncate">
                  {connection.source} → {connection.target}
                </div>
                <div className="text-xs text-text-tertiary">
                  ({connection.type})
                </div>
              </div>
              <button
                onClick={() => onRemoveConnection(connection.id)}
                className="p-1 text-red-400 hover:text-red-300 transition-colors flex-shrink-0 ml-2"
                title="Remove connection"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          
          {connections.length === 0 && (
            <div className="text-xs text-text-tertiary text-center py-4">
              No connections added yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

ConnectionsPanel.displayName = 'ConnectionsPanel';

export default ConnectionsPanel;