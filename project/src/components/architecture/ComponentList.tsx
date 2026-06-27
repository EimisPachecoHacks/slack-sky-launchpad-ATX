import React, { useState } from 'react';
import { FolderSync as Sync, Info, DollarSign, Zap, TrendingUp, ArrowUpDown } from 'lucide-react';
import Card from '../ui/Card';
import { Architecture, ArchitectureComponent, AlternativeComponent } from '../../types';
import Button from '../ui/Button';

interface ComponentListProps {
  architecture: Architecture;
  onReplaceComponent: (originalId: string, alternativeId: string) => void;
}

const ComponentList: React.FC<ComponentListProps> = ({ 
  architecture,
  onReplaceComponent
}) => {
  const [openDetails, setOpenDetails] = useState<string | null>(null);
  const [optimizationMode, setOptimizationMode] = useState<'cost' | 'performance'>('cost');
  
  const toggleDetails = (id: string) => {
    if (openDetails === id) {
      setOpenDetails(null);
    } else {
      setOpenDetails(id);
    }
  };
  
  const findAlternative = (componentId: string): AlternativeComponent | undefined => {
    return (architecture.alternatives || []).find(alt => alt.originalComponentId === componentId);
  };

  // Get optimized components based on selected mode
  const getOptimizedComponents = () => {
    return architecture.components.map(component => {
      const alternative = findAlternative(component.id);
      return {
        ...component,
        alternative,
        isOptimized: optimizationMode === 'cost' ? 
          (alternative && alternative.cost < component.cost) :
          (alternative && alternative.performance > 85)
      };
    });
  };

  const optimizedComponents = getOptimizedComponents();
  const totalCostOptimized = optimizedComponents.reduce((sum, comp) => {
    const alternative = comp.alternative;
    if (optimizationMode === 'cost' && alternative && alternative.cost < comp.cost) {
      return sum + alternative.cost;
    }
    return sum + comp.cost;
  }, 0);

  const totalSavings = optimizedComponents.reduce((sum, comp) => {
    const alternative = comp.alternative;
    if (optimizationMode === 'cost' && alternative && alternative.cost < comp.cost) {
      return sum + (comp.cost - alternative.cost);
    }
    return sum;
  }, 0);

  const handleSwitchOptimization = (componentId: string) => {
    const component = optimizedComponents.find(c => c.id === componentId);
    if (component?.alternative) {
      onReplaceComponent(componentId, component.alternative.id);
    }
  };

  return (
    <div className="w-full">
      <div className={`${architecture.provider}-theme w-full`}>
        <div className="component-glass-card p-6 w-full">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 space-y-4 lg:space-y-0">
          <h3 className="text-2xl font-bold">Architecture Components</h3>
          
          {/* Optimization Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
            <span className="text-sm text-gray-400">Optimization:</span>
            <div className="relative">
              <div className="flex bg-background-secondary backdrop-blur-xl border-2 border-blue-500/30 rounded-xl p-1">
                <button
                  onClick={() => setOptimizationMode('cost')}
                  className={`component-text-accent
                    relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300
                    ${optimizationMode === 'cost'
                      ? 'bg-gradient-to-r from-green-500/20 to-green-600/20 border-2 border-green-500/60 shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                      : 'text-text-tertiary hover:bg-green-500/10'
                    }
                  `}
                >
                  <DollarSign className="w-4 h-4 inline mr-1" />
                  Cost Optimized
                </button>
                <button
                  onClick={() => setOptimizationMode('performance')}
                  className={`component-text-accent
                    relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300
                    ${optimizationMode === 'performance'
                      ? 'bg-gradient-to-r from-blue-500/20 to-blue-600/20 border-2 border-blue-500/60 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                      : 'text-text-tertiary hover:bg-blue-500/10'
                    }
                  `}
                >
                  <Zap className="w-4 h-4 inline mr-1" />
                  Performance Optimized
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Optimization Summary */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-background-secondary backdrop-blur-xl border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <DollarSign className="w-5 h-5 component-text-accent" />
              <span className="text-sm font-medium text-text-secondary">Total Monthly Cost</span>
            </div>
            <div className="text-2xl font-bold text-text-primary">${totalCostOptimized.toFixed(2)}</div>
          </div>
          
          {optimizationMode === 'cost' && totalSavings > 0 && (
            <div className="bg-green-900/20 backdrop-blur-xl border border-green-500/30 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                <span className="text-sm font-medium text-green-300">Monthly Savings</span>
              </div>
              <div className="text-2xl font-bold text-green-400">${totalSavings.toFixed(2)}</div>
            </div>
          )}
          
          <div className={`backdrop-blur-xl border rounded-lg p-4 ${
            optimizationMode === 'cost' 
              ? 'bg-green-900/20 border-green-500/30' 
              : 'bg-blue-900/20 border-blue-500/30'
          }`}>
            <div className="flex items-center space-x-2 mb-2">
              {optimizationMode === 'cost' ? (
                <DollarSign className="w-5 h-5 text-green-400" />
              ) : (
                <Zap className="w-5 h-5 text-blue-400" />
              )}
              <span className="text-sm font-medium text-text-secondary">Optimization Focus</span>
            </div>
            <div className={`text-lg font-bold ${
              optimizationMode === 'cost' ? 'text-green-400' : 'text-blue-400'
            }`}>
              {optimizationMode === 'cost' ? 'Cost Efficiency' : 'High Performance'}
            </div>
          </div>
        </div>
        
        {/* Responsive Table with Better Laptop Support */}
        <div className="w-full overflow-x-auto">
          <div className="min-w-[1200px]"> {/* Minimum width for proper layout */}
            <table className="w-full divide-y divide-gray-700">
              <thead>
                <tr>
                  <th className="px-3 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-[18%]">
                    Component
                  </th>
                  <th className="px-3 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-[22%]">
                    Description
                  </th>
                  <th className="px-3 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-[10%]">
                    Cost
                  </th>
                  <th className="px-3 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-[10%]">
                    Savings
                  </th>
                  <th className="px-3 py-4 text-center text-xs font-medium text-gray-400 uppercase tracking-wider border border-gray-600 w-[25%]">
                    <div className="text-center font-semibold text-sm mb-2">
                      {optimizationMode === 'cost' ? 'Performance Optimized' : 'Cost Optimized'}
                    </div>
                    <div className="grid grid-cols-2 border-t border-gray-600">
                      <div className="text-center py-2 border-r border-gray-600 font-medium text-xs">Cost</div>
                      <div className="text-center py-2 font-medium text-xs">$ Difference</div>
                    </div>
                  </th>
                  <th className="px-3 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-[15%]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {optimizedComponents.map((component) => {
                  const alternative = component.alternative;
                  const currentCost = optimizationMode === 'cost' && alternative && alternative.cost < component.cost 
                    ? alternative.cost 
                    : component.cost;
                  const savings = optimizationMode === 'cost' && alternative && alternative.cost < component.cost 
                    ? component.cost - alternative.cost 
                    : 0;
                  
                  const oppositeCost = optimizationMode === 'cost' 
                    ? (alternative ? component.cost : currentCost)
                    : (alternative ? alternative.cost : currentCost);
                  
                  const costDifference = oppositeCost - currentCost;
                  
                  return (
                    <React.Fragment key={component.id}>
                      <tr className={`${openDetails === component.id ? 'bg-blue-900/10' : 'hover:bg-blue-900/5'} transition-all duration-300`}>
                        <td className="px-3 py-4">
                          <div className="flex items-center space-x-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              component.isOptimized 
                                ? optimizationMode === 'cost'
                                  ? 'bg-green-900/30'
                                  : 'bg-blue-900/30'
                                : 'bg-gray-900/30'
                            }`}>
                              <span className={`text-lg ${
                                component.isOptimized 
                                  ? optimizationMode === 'cost'
                                    ? 'text-green-500'
                                    : 'text-blue-500'
                                  : 'text-gray-500'
                              }`}>
                                {component.name.charAt(0)}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm flex items-center space-x-2">
                                <span className="truncate">
                                  {optimizationMode === 'cost' && alternative && alternative.cost < component.cost 
                                    ? alternative.name 
                                    : component.name}
                                </span>
                                {component.isOptimized && (
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                                    optimizationMode === 'cost'
                                      ? 'bg-green-900/30 text-green-400'
                                      : 'bg-blue-900/30 text-blue-400'
                                  }`}>
                                    {optimizationMode === 'cost' ? 'Cost' : 'Perf'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="text-sm text-gray-300 leading-relaxed line-clamp-2">
                            {optimizationMode === 'cost' && alternative && alternative.cost < component.cost 
                              ? alternative.description 
                              : component.description}
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="text-sm font-medium whitespace-nowrap">${currentCost.toFixed(2)}/mo</div>
                        </td>
                        <td className="px-3 py-4">
                          {savings > 0 ? (
                            <div className="text-green-400 font-medium text-sm whitespace-nowrap">
                              ${savings.toFixed(2)}/mo
                            </div>
                          ) : (
                            <span className="text-gray-500 text-sm">-</span>
                          )}
                        </td>
                        <td className="px-3 py-4 border border-gray-600">
                          <div className="grid grid-cols-2 min-h-[50px]">
                            <div className="text-center py-2 border-r border-gray-600 flex items-center justify-center">
                              <div className="text-sm font-medium text-blue-400 whitespace-nowrap">
                                ${oppositeCost.toFixed(2)}/mo
                              </div>
                            </div>
                            <div className="text-center py-2 flex items-center justify-center">
                              <div className={`text-sm font-medium whitespace-nowrap ${
                                costDifference > 0 
                                  ? 'text-red-400' 
                                  : costDifference < 0
                                    ? 'text-green-400'
                                    : 'text-gray-500'
                              }`}>
                                {costDifference === 0 
                                  ? 'Same'
                                  : `${costDifference > 0 ? '+' : ''}$${Math.abs(costDifference).toFixed(2)}`
                                }
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-4 space-y-2">
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => toggleDetails(component.id)}
                            icon={<Info className="w-4 h-4" />}
                            className="w-full text-xs"
                          >
                            Details
                          </Button>
                          
                          {alternative && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSwitchOptimization(component.id)}
                              icon={<ArrowUpDown className="w-4 h-4" />}
                              className={`w-full text-xs ${
                                optimizationMode === 'cost' 
                                  ? 'border-blue-500/30 text-blue-400 hover:bg-blue-500/10'
                                  : 'border-green-500/30 text-green-400 hover:bg-green-500/10'
                              }`}
                            >
                              Switch
                            </Button>
                          )}
                        </td>
                      </tr>
                      
                      {openDetails === component.id && (
                        <tr className="bg-blue-900/10">
                          <td colSpan={6} className="px-6 py-6">
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                              <div>
                                <h4 className="text-sm font-medium text-gray-400 mb-2">Current Configuration</h4>
                                <p className="text-sm text-gray-300 mb-4">
                                  {optimizationMode === 'cost' && alternative && alternative.cost < component.cost 
                                    ? alternative.description 
                                    : component.description}
                                </p>
                                <div className="bg-black bg-opacity-30 p-4 rounded-lg">
                                  <div className="text-xs font-mono text-gray-300">
                                    <div className="text-blue-400">// Current Configuration</div>
                                    {`{
  "name": "${optimizationMode === 'cost' && alternative && alternative.cost < component.cost ? alternative.name : component.name}",
  "type": "service",
  "provider": "${component.provider}",
  "region": "us-west-2",
  "cost": ${currentCost},
  "optimized_for": "${optimizationMode}",
  "specs": {
    "compute": "${optimizationMode === 'cost' ? '1 vCPU' : '4 vCPU'}",
    "memory": "${optimizationMode === 'cost' ? '2 GB' : '8 GB'}",
    "storage": "100 GB"
  }
}`}
                                  </div>
                                </div>
                              </div>
                              
                              {alternative && (
                                <div>
                                  <h4 className="text-sm font-medium text-gray-400 mb-2">
                                    Alternative Configuration ({optimizationMode === 'cost' ? 'Performance' : 'Cost'} Optimized)
                                  </h4>
                                  <p className="text-sm text-gray-300 mb-4">
                                    {optimizationMode === 'cost' ? component.description : alternative.description}
                                  </p>
                                  <div className="bg-black bg-opacity-30 p-4 rounded-lg">
                                    <div className="text-xs font-mono text-gray-300">
                                      <div className={optimizationMode === 'cost' ? 'text-blue-400' : 'text-green-400'}>
                                        // Alternative Configuration
                                      </div>
                                      {`{
  "name": "${optimizationMode === 'cost' ? component.name : alternative.name}",
  "type": "service",
  "provider": "${component.provider}",
  "region": "us-west-2",
  "cost": ${oppositeCost},
  "performance": ${alternative.performance}%,
  "optimized_for": "${optimizationMode === 'cost' ? 'performance' : 'cost'}",
  "specs": {
    "compute": "${optimizationMode === 'cost' ? '4 vCPU' : '1 vCPU'}",
    "memory": "${optimizationMode === 'cost' ? '8 GB' : '2 GB'}",
    "storage": "100 GB"
  }
}`}
                                    </div>
                                  </div>
                                  
                                  <div className="mt-4">
                                    <h4 className="text-sm font-medium text-gray-400 mb-2">Impact Analysis</h4>
                                    <div className={`p-3 rounded-lg text-sm ${
                                      optimizationMode === 'cost'
                                        ? 'bg-blue-900/20 text-blue-400'
                                        : 'bg-green-900/20 text-green-400'
                                    }`}>
                                      {optimizationMode === 'cost' 
                                        ? `Switching to performance optimization will ${costDifference > 0 ? 'increase' : 'decrease'} cost by $${Math.abs(costDifference).toFixed(2)}/mo but provide ${alternative.performance - 85}% better performance.`
                                        : `Switching to cost optimization will reduce cost by $${Math.abs(costDifference).toFixed(2)}/mo (${(Math.abs(costDifference) / oppositeCost * 100).toFixed(0)}% reduction) with optimized resource allocation.`
                                      }
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default ComponentList;