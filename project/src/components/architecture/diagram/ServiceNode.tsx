import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Cloud, Database, Server, Cpu, HardDrive, Network, Shield, Zap } from 'lucide-react';

interface ServiceNodeData {
  label: string;
  subLabel: string;
  cost: number;
  description: string;
  type: string;
  provider: string;
  icon?: string;
}

const ServiceNode: React.FC<NodeProps<ServiceNodeData>> = ({ data, selected }) => {
  const getIcon = () => {
    const iconClass = "w-6 h-6 text-white";

    // Map service types to icons
    switch (data.type) {
      case 'compute':
        return <Cpu className={iconClass} />;
      case 'storage':
        return <HardDrive className={iconClass} />;
      case 'database':
        return <Database className={iconClass} />;
      case 'network':
        return <Network className={iconClass} />;
      case 'serverless':
        return <Zap className={iconClass} />;
      case 'security':
        return <Shield className={iconClass} />;
      default:
        return <Server className={iconClass} />;
    }
  };

  const getTypeColor = () => {
    switch (data.type) {
      case 'compute':
        return 'from-blue-500 to-blue-600';
      case 'storage':
        return 'from-purple-500 to-purple-600';
      case 'database':
        return 'from-green-500 to-green-600';
      case 'network':
        return 'from-orange-500 to-orange-600';
      case 'serverless':
        return 'from-yellow-500 to-yellow-600';
      case 'security':
        return 'from-red-500 to-red-600';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  return (
    <div
      className={`
        relative bg-gradient-to-br from-gray-800 to-gray-900
        rounded-lg border-2 transition-all duration-200
        min-w-[280px] max-w-[320px]
        ${selected
          ? 'border-blue-400 shadow-lg shadow-blue-500/50 scale-105'
          : 'border-gray-700 hover:border-gray-600'
        }
      `}
    >
      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-blue-500 !border-2 !border-white"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-blue-500 !border-2 !border-white"
      />

      {/* Node Content */}
      <div className="p-3">
        {/* Icon and Title Row */}
        <div className="flex items-start space-x-3 mb-2">
          <div className={`flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br ${getTypeColor()} flex items-center justify-center`}>
            {getIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white text-sm leading-tight truncate">
              {data.label}
            </h3>
            <p className="text-xs text-gray-400 capitalize">
              {data.subLabel}
            </p>
          </div>
        </div>

        {/* Cost Badge */}
        <div className="mb-2">
          <span className="text-sm font-bold text-orange-400">
            ${data.cost}/mo
          </span>
        </div>

        {/* Description */}
        <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">
          {data.description}
        </p>
      </div>

      {/* Connection Handles */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-blue-500 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-blue-500 !border-2 !border-white"
      />
    </div>
  );
};

export default memo(ServiceNode);
