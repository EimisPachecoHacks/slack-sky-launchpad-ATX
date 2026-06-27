import React, { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  ConnectionMode,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ServiceNode from './ServiceNode';
import type { Architecture } from '../../../types';

interface ReactFlowDiagramProps {
  architecture: Architecture;
  className?: string;
}

const ReactFlowDiagram: React.FC<ReactFlowDiagramProps> = ({ architecture, className = '' }) => {
  // Convert architecture nodes to React Flow nodes
  const initialNodes: Node[] = useMemo(() => {
    const flowNodes = architecture.diagram.nodes.map((node) => ({
      id: node.id,
      type: 'serviceNode',
      position: { x: node.x, y: node.y },
      data: {
        label: node.label,
        subLabel: node.subLabel,
        cost: node.cost,
        description: node.description,
        type: node.type,
        provider: node.provider || architecture.provider,
        icon: node.icon,
      },
    }));

    console.log(`📊 Diagram loaded: ${flowNodes.length} nodes, ${architecture.diagram.edges.length} connections`);
    return flowNodes;
  }, [architecture]);

  // Convert architecture edges to React Flow edges
  const initialEdges: Edge[] = useMemo(() => {
    return architecture.diagram.edges.map((edge, index) => {
      // Use different colors for better visibility
      const colors = [
        '#3b82f6', // Blue
        '#10b981', // Green
        '#8b5cf6', // Purple
        '#f59e0b', // Amber
        '#ec4899', // Pink
        '#06b6d4', // Cyan
      ];
      const edgeColor = colors[index % colors.length];

      return {
        id: edge.id,
        source: edge.from,
        target: edge.to,
        label: edge.type,
        type: 'smoothstep',
        animated: true,
        style: {
          stroke: edgeColor,
          strokeWidth: 2,
          strokeDasharray: '5,5', // Dashed line for better distinction
        },
        labelStyle: {
          fill: '#e2e8f0',
          fontSize: 10,
          fontWeight: 600,
        },
        labelBgStyle: {
          fill: '#1e293b',
          fillOpacity: 0.8,
          rx: 4,
          ry: 4,
        },
      };
    });
  }, [architecture]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Custom node types
  const nodeTypes = useMemo(() => ({
    serviceNode: ServiceNode,
  }), []);

  return (
    <div className={`${className} rounded-lg`} style={{ height: '100%', background: 'linear-gradient(to bottom, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98))' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{
          padding: 0.15,
          includeHiddenNodes: false,
        }}
        minZoom={0.5}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 1.2 }}
        className="react-flow-dark"
        style={{ background: 'rgba(30, 58, 138, 0.1)' }}
      >
        {/* Soft blue transparent grid effect */}
        <Background
          variant={BackgroundVariant.Lines}
          gap={40}
          size={1}
          color="#3b82f6"
          style={{
            opacity: 0.12,
          }}
        />
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.5}
          color="#60a5fa"
          style={{
            opacity: 0.15,
          }}
        />
        <Controls
          className="bg-gray-800/90 border border-gray-700 rounded-lg shadow-lg"
          style={{
            button: {
              backgroundColor: '#1e293b',
              color: '#94a3b8',
              borderBottom: '1px solid #334155',
            },
          }}
        />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as any;
            switch (data?.type) {
              case 'compute': return '#3b82f6';
              case 'storage': return '#a855f7';
              case 'database': return '#22c55e';
              case 'network': return '#f97316';
              case 'serverless': return '#eab308';
              case 'security': return '#ef4444';
              default: return '#6b7280';
            }
          }}
          className="bg-gray-800 border border-gray-700"
          maskColor="rgba(15, 23, 42, 0.8)"
        />
      </ReactFlow>
    </div>
  );
};

export default ReactFlowDiagram;
