import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useArchitectureStore, useUIStore, usePerformanceStore } from '../store';
import type { DiagramNode, DiagramEdge, Position, RenderContext } from '../types';

interface UseCanvasOptions {
  width?: number;
  height?: number;
  backgroundColor?: string;
  gridSize?: number;
  enableGrid?: boolean;
  enableSnap?: boolean;
}

interface CanvasHookReturn {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  isReady: boolean;
  redraw: () => void;
  getMousePosition: (event: MouseEvent | React.MouseEvent) => Position;
  snapToGrid: (position: Position) => Position;
  getNodeAtPosition: (position: Position) => DiagramNode | null;
  isPositionInNode: (position: Position, node: DiagramNode) => boolean;
}

export const useCanvas = (options: UseCanvasOptions = {}): CanvasHookReturn => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>();
  const [isReady, setIsReady] = useState(false);

  const { current: architecture } = useArchitectureStore();
  const { viewport, showGrid, snapToGrid: snapEnabled } = useUIStore();
  const { updateMetrics, optimizations } = usePerformanceStore();

  const {
    width = 800,
    height = 600,
    backgroundColor = 'transparent',
    gridSize = 20,
    enableGrid = showGrid,
    enableSnap = snapEnabled
  } = options;

  // Memoized render context
  const renderContext = useMemo((): RenderContext | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    return {
      canvas,
      ctx,
      config: {
        width,
        height,
        backgroundColor,
        gridSize,
        zoom: {
          min: 0.1,
          max: 5,
          step: 0.1
        },
        pan: {
          enabled: true,
          sensitivity: 1
        }
      },
      viewport
    };
  }, [width, height, backgroundColor, gridSize, viewport]);

  // Performance tracking
  const startRenderTime = useRef<number>(0);
  
  const trackPerformance = useCallback((nodeCount: number, edgeCount: number) => {
    const renderTime = performance.now() - startRenderTime.current;
    updateMetrics({
      renderTime,
      nodeCount,
      edgeCount
    });
  }, [updateMetrics]);

  // Grid drawing utilities
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    if (!enableGrid) return;

    ctx.save();
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.2)';
    ctx.lineWidth = 0.5;
    
    const { zoom, pan } = viewport;
    const scaledGridSize = gridSize * zoom;
    const offsetX = (pan.x % scaledGridSize) - scaledGridSize;
    const offsetY = (pan.y % scaledGridSize) - scaledGridSize;

    // Draw vertical lines
    for (let x = offsetX; x < canvas.width; x += scaledGridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // Draw horizontal lines
    for (let y = offsetY; y < canvas.height; y += scaledGridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    
    ctx.restore();
  }, [enableGrid, gridSize, viewport]);

  // Node drawing utilities
  const drawNode = useCallback((ctx: CanvasRenderingContext2D, node: DiagramNode, isSelected: boolean = false) => {
    const { zoom, pan } = viewport;
    const x = (node.x + pan.x) * zoom;
    const y = (node.y + pan.y) * zoom;
    const width = node.width * zoom;
    const height = node.height * zoom;

    // Skip drawing if node is outside viewport (optimization)
    const canvas = ctx.canvas;
    if (x + width < 0 || x > canvas.width || y + height < 0 || y > canvas.height) {
      return;
    }

    ctx.save();

    // Node background
    ctx.fillStyle = isSelected 
      ? 'rgba(59, 130, 246, 0.3)' 
      : 'rgba(0, 0, 0, 0.4)';
    ctx.strokeStyle = isSelected 
      ? '#3b82f6' 
      : 'rgba(59, 130, 246, 0.6)';
    ctx.lineWidth = isSelected ? 3 : 2;

    // Draw rounded rectangle with fallback for older browsers
    const radius = 12 * zoom;
    ctx.beginPath();
    
    // Use roundRect if available, otherwise use manual path
    if (ctx.roundRect) {
      ctx.roundRect(x, y, width, height, radius);
    } else {
      // Fallback for browsers that don't support roundRect
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    }
    
    ctx.fill();
    ctx.stroke();

    // Draw icon
    const fontSize = Math.max(12, 24 * zoom);
    ctx.font = `${fontSize}px Arial`;
    ctx.fillStyle = 'white';
    ctx.textAlign = 'left';
    ctx.fillText(node.icon, x + 15 * zoom, y + 35 * zoom);

    // Draw title
    const titleFontSize = Math.max(10, 14 * zoom);
    ctx.font = `bold ${titleFontSize}px Arial`;
    ctx.fillStyle = 'white';
    ctx.fillText(node.label, x + 50 * zoom, y + 25 * zoom);

    // Draw subtitle
    const subtitleFontSize = Math.max(8, 12 * zoom);
    ctx.font = `${subtitleFontSize}px Arial`;
    ctx.fillStyle = 'rgba(147, 197, 253, 0.8)';
    ctx.fillText(node.subLabel, x + 50 * zoom, y + 42 * zoom);

    // Draw cost
    const costFontSize = Math.max(8, 12 * zoom);
    ctx.font = `bold ${costFontSize}px Arial`;
    ctx.fillStyle = '#3b82f6';
    ctx.fillText(`$${node.cost}/mo`, x + 15 * zoom, y + 65 * zoom);

    // Draw description
    const descFontSize = Math.max(6, 10 * zoom);
    ctx.font = `${descFontSize}px Arial`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText(node.description, x + 15 * zoom, y + 82 * zoom);

    ctx.restore();
  }, [viewport]);

  // Edge drawing utilities
  const drawEdge = useCallback((ctx: CanvasRenderingContext2D, edge: DiagramEdge, nodes: DiagramNode[]) => {
    const fromNode = nodes.find(n => n.id === edge.from);
    const toNode = nodes.find(n => n.id === edge.to);
    
    if (!fromNode || !toNode) return;

    const { zoom, pan } = viewport;
    
    const fromX = (fromNode.x + fromNode.width / 2 + pan.x) * zoom;
    const fromY = (fromNode.y + fromNode.height / 2 + pan.y) * zoom;
    const toX = (toNode.x + toNode.width / 2 + pan.x) * zoom;
    const toY = (toNode.y + toNode.height / 2 + pan.y) * zoom;

    ctx.save();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3 * zoom;

    // Draw curved line
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    
    const controlX1 = fromX + (toX - fromX) * 0.3;
    const controlY1 = fromY;
    const controlX2 = fromX + (toX - fromX) * 0.7;
    const controlY2 = toY;
    
    ctx.bezierCurveTo(controlX1, controlY1, controlX2, controlY2, toX, toY);
    ctx.stroke();

    // Draw arrow head
    const angle = Math.atan2(toY - controlY2, toX - controlX2);
    const arrowLength = 15 * zoom;
    const arrowAngle = Math.PI / 6;
    
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - arrowLength * Math.cos(angle - arrowAngle),
      toY - arrowLength * Math.sin(angle - arrowAngle)
    );
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - arrowLength * Math.cos(angle + arrowAngle),
      toY - arrowLength * Math.sin(angle + arrowAngle)
    );
    ctx.stroke();

    ctx.restore();
  }, [viewport]);

  // Main drawing function
  const redraw = useCallback(() => {
    const context = renderContext;
    if (!context || !architecture) {
      console.log('⏸️ [CANVAS] Redraw skipped:', { hasContext: !!context, hasArchitecture: !!architecture });
      return;
    }

    const { canvas, ctx } = context;
    startRenderTime.current = performance.now();
    console.log('🎨 [CANVAS] Drawing architecture:', {
      nodes: architecture.diagram.nodes.length,
      edges: architecture.diagram.edges.length
    });

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set background
    if (backgroundColor !== 'transparent') {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw grid
    drawGrid(ctx, canvas);

    const nodes = architecture.diagram.nodes;
    const edges = architecture.diagram.edges;

    // Apply virtualization if enabled
    const visibleNodes = optimizations.useVirtualization 
      ? nodes.filter((node, index) => index < optimizations.maxRenderNodes)
      : nodes;

    // Draw edges first (behind nodes)
    edges.forEach(edge => drawEdge(ctx, edge, visibleNodes));

    // Draw nodes
    const { selectedNodes } = useUIStore.getState();
    visibleNodes.forEach(node => {
      const isSelected = selectedNodes.includes(node.id);
      drawNode(ctx, node, isSelected);
    });

    // Track performance
    trackPerformance(visibleNodes.length, edges.length);
  }, [renderContext, architecture, drawGrid, drawEdge, drawNode, optimizations, trackPerformance]);

  // Debounced redraw for performance
  const debouncedRedraw = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(redraw);
  }, [redraw]);

  // Utility functions
  const getMousePosition = useCallback((event: MouseEvent | React.MouseEvent): Position => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const { zoom, pan } = viewport;
    
    return {
      x: (event.clientX - rect.left) / zoom - pan.x,
      y: (event.clientY - rect.top) / zoom - pan.y
    };
  }, [viewport]);

  const snapToGrid = useCallback((position: Position): Position => {
    if (!enableSnap) return position;
    
    return {
      x: Math.round(position.x / gridSize) * gridSize,
      y: Math.round(position.y / gridSize) * gridSize
    };
  }, [enableSnap, gridSize]);

  const isPositionInNode = useCallback((position: Position, node: DiagramNode): boolean => {
    return position.x >= node.x && 
           position.x <= node.x + node.width &&
           position.y >= node.y && 
           position.y <= node.y + node.height;
  }, []);

  const getNodeAtPosition = useCallback((position: Position): DiagramNode | null => {
    if (!architecture) return null;
    
    return architecture.diagram.nodes.find(node => isPositionInNode(position, node)) || null;
  }, [architecture, isPositionInNode]);

  // Canvas setup and resize handling
  useEffect(() => {
    console.log('🎨 [CANVAS] Setup effect running...');
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (!canvas || !container) {
      console.warn('⚠️ [CANVAS] Missing refs:', { canvas: !!canvas, container: !!container });
      return;
    }

    console.log('✅ [CANVAS] Refs available, setting up canvas...');

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      console.log('📐 [CANVAS] Resizing:', { width: rect.width, height: rect.height });
      canvas.width = rect.width;
      canvas.height = rect.height;
      debouncedRedraw();
    };

    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(container);

    // Initial resize
    resizeCanvas();
    setIsReady(true);
    console.log('✅ [CANVAS] Canvas is ready!');

    return () => {
      console.log('🧹 [CANVAS] Cleanup');
      resizeObserver.disconnect();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [debouncedRedraw]);

  // Redraw when architecture or viewport changes
  useEffect(() => {
    if (isReady) {
      debouncedRedraw();
    }
  }, [architecture, viewport, showGrid, isReady, debouncedRedraw]);

  return {
    canvasRef,
    containerRef,
    isReady,
    redraw: debouncedRedraw,
    getMousePosition,
    snapToGrid,
    getNodeAtPosition,
    isPositionInNode
  };
};

// Hook for canvas interactions (drag, select, etc.)
export const useCanvasInteractions = () => {
  const architectureStore = useArchitectureStore();
  const uiStore = useUIStore();
  
  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>, canvas: CanvasHookReturn) => {
    const position = canvas.getMousePosition(event);
    const node = canvas.getNodeAtPosition(position);

    if (node) {
      // Start dragging
      uiStore.setDragState({
        isDragging: true,
        nodeId: node.id,
        offset: {
          x: position.x - node.x,
          y: position.y - node.y
        },
        startPosition: position
      });

      // Select node
      if (event.ctrlKey || event.metaKey) {
        uiStore.addSelectedNode(node.id);
      } else {
        uiStore.setSelectedNodes([node.id]);
      }
    } else {
      // Clear selection
      uiStore.clearSelection();
    }
  }, [architectureStore, uiStore]);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>, canvas: CanvasHookReturn) => {
    const { dragState } = uiStore;
    
    if (dragState.isDragging && dragState.nodeId) {
      const position = canvas.getMousePosition(event);
      const snappedPosition = canvas.snapToGrid({
        x: position.x - dragState.offset.x,
        y: position.y - dragState.offset.y
      });

      architectureStore.updateNode(dragState.nodeId, {
        x: Math.max(0, snappedPosition.x),
        y: Math.max(0, snappedPosition.y)
      });
    }
  }, [architectureStore, uiStore]);

  const handleMouseUp = useCallback(() => {
    uiStore.setDragState({
      isDragging: false,
      nodeId: null,
      offset: { x: 0, y: 0 },
      startPosition: { x: 0, y: 0 }
    });
  }, [uiStore]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp
  };
};