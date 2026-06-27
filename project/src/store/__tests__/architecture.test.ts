/**
 * Architecture Store Tests
 * Tests for state management, undo/redo, and architecture operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useArchitectureStore } from '../index';
import type { Architecture, DiagramNode, DiagramEdge } from '../../types';

// Mock architecture data
const createMockArchitecture = (id: string = 'test-arch-1'): Architecture => ({
  id,
  name: 'Test Architecture',
  description: 'Test description',
  diagram: {
    nodes: [],
    edges: [],
  },
  metadata: {
    createdAt: '2024-01-01T00:00:00.000Z',
    lastModified: '2024-01-01T00:00:00.000Z',
    version: '1.0.0',
    tags: ['test'],
  },
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
});

const createMockNode = (id: string = 'node-1'): DiagramNode => ({
  id,
  type: 'compute',
  label: 'Test Node',
  position: { x: 100, y: 100 },
  data: {},
});

const createMockEdge = (id: string = 'edge-1', from: string = 'node-1', to: string = 'node-2'): DiagramEdge => ({
  id,
  from,
  to,
  type: 'data-flow',
});

describe('Architecture Store', () => {
  beforeEach(() => {
    // Reset store before each test
    const store = useArchitectureStore.getState();
    store.setCurrentArchitecture(null);
    store.clearHistory();
    useArchitectureStore.setState({
      current: null,
      list: [],
      history: [],
      historyIndex: -1,
      snapshots: [],
      snapshotIndex: -1,
      loading: false,
      error: null,
      unsavedChanges: false,
    });
  });

  describe('Architecture Management', () => {
    it('should set current architecture', () => {
      const store = useArchitectureStore.getState();
      const arch = createMockArchitecture();

      store.setCurrentArchitecture(arch);

      const state = useArchitectureStore.getState();
      expect(state.current).toEqual(arch);
      expect(state.unsavedChanges).toBe(false);
    });

    it('should create initial snapshot when architecture is loaded', () => {
      const store = useArchitectureStore.getState();
      const arch = createMockArchitecture();

      store.setCurrentArchitecture(arch);

      const state = useArchitectureStore.getState();
      expect(state.snapshots).toHaveLength(1);
      expect(state.snapshotIndex).toBe(0);
      expect(state.snapshots[0]).toEqual(arch);
    });

    it('should update architecture and mark unsaved', () => {
      const store = useArchitectureStore.getState();
      const arch = createMockArchitecture();
      store.setCurrentArchitecture(arch);

      const updates = { name: 'Updated Architecture' };
      store.updateArchitecture(updates);

      const state = useArchitectureStore.getState();
      expect(state.current?.name).toBe('Updated Architecture');
      expect(state.unsavedChanges).toBe(true);
      // Should have created a new snapshot
      expect(state.snapshots.length).toBeGreaterThan(1);
    });

    it('should add architecture to list', () => {
      const store = useArchitectureStore.getState();
      const arch = createMockArchitecture();

      store.addArchitecture(arch);

      const state = useArchitectureStore.getState();
      expect(state.list).toHaveLength(1);
      expect(state.list[0]).toEqual(arch);
    });

    it('should remove architecture from list', () => {
      const store = useArchitectureStore.getState();
      const arch1 = createMockArchitecture('arch-1');
      const arch2 = createMockArchitecture('arch-2');

      store.addArchitecture(arch1);
      store.addArchitecture(arch2);
      store.removeArchitecture('arch-1');

      const state = useArchitectureStore.getState();
      expect(state.list).toHaveLength(1);
      expect(state.list[0].id).toBe('arch-2');
    });

    it('should clear current architecture when removed', () => {
      const store = useArchitectureStore.getState();
      const arch = createMockArchitecture('arch-1');

      store.setCurrentArchitecture(arch);
      store.addArchitecture(arch);
      store.removeArchitecture('arch-1');

      const state = useArchitectureStore.getState();
      expect(state.current).toBeNull();
    });

    it('should duplicate architecture with unique id', () => {
      const store = useArchitectureStore.getState();
      const arch = createMockArchitecture('original');

      store.addArchitecture(arch);
      store.duplicateArchitecture('original');

      const state = useArchitectureStore.getState();
      expect(state.list).toHaveLength(2);
      expect(state.list[1].name).toBe('Test Architecture (Copy)');
      expect(state.list[1].id).toContain('original-copy-');
      expect(state.list[1].id).not.toBe('original');
    });
  });

  describe('Node Operations', () => {
    it('should add node to diagram', () => {
      const store = useArchitectureStore.getState();
      const arch = createMockArchitecture();
      store.setCurrentArchitecture(arch);

      const node = createMockNode();
      store.addNode(node);

      const state = useArchitectureStore.getState();
      expect(state.current?.diagram.nodes).toHaveLength(1);
      expect(state.current?.diagram.nodes[0]).toEqual(node);
      expect(state.unsavedChanges).toBe(true);
    });

    it('should update node in diagram', () => {
      const store = useArchitectureStore.getState();
      const arch = createMockArchitecture();
      const node = createMockNode('node-1');
      arch.diagram.nodes.push(node);
      store.setCurrentArchitecture(arch);

      store.updateNode('node-1', { label: 'Updated Node' });

      const state = useArchitectureStore.getState();
      expect(state.current?.diagram.nodes[0].label).toBe('Updated Node');
      expect(state.unsavedChanges).toBe(true);
    });

    it('should remove node from diagram', () => {
      const store = useArchitectureStore.getState();
      const arch = createMockArchitecture();
      const node1 = createMockNode('node-1');
      const node2 = createMockNode('node-2');
      arch.diagram.nodes.push(node1, node2);
      store.setCurrentArchitecture(arch);

      store.removeNode('node-1');

      const state = useArchitectureStore.getState();
      expect(state.current?.diagram.nodes).toHaveLength(1);
      expect(state.current?.diagram.nodes[0].id).toBe('node-2');
      expect(state.unsavedChanges).toBe(true);
    });

    it('should remove related edges when removing node', () => {
      const store = useArchitectureStore.getState();
      const arch = createMockArchitecture();
      const node1 = createMockNode('node-1');
      const node2 = createMockNode('node-2');
      const edge = createMockEdge('edge-1', 'node-1', 'node-2');
      arch.diagram.nodes.push(node1, node2);
      arch.diagram.edges.push(edge);
      store.setCurrentArchitecture(arch);

      store.removeNode('node-1');

      const state = useArchitectureStore.getState();
      expect(state.current?.diagram.edges).toHaveLength(0);
    });
  });

  describe('Edge Operations', () => {
    it('should add edge to diagram', () => {
      const store = useArchitectureStore.getState();
      const arch = createMockArchitecture();
      store.setCurrentArchitecture(arch);

      const edge = createMockEdge();
      store.addEdge(edge);

      const state = useArchitectureStore.getState();
      expect(state.current?.diagram.edges).toHaveLength(1);
      expect(state.current?.diagram.edges[0]).toEqual(edge);
      expect(state.unsavedChanges).toBe(true);
    });

    it('should remove edge from diagram', () => {
      const store = useArchitectureStore.getState();
      const arch = createMockArchitecture();
      const edge1 = createMockEdge('edge-1');
      const edge2 = createMockEdge('edge-2');
      arch.diagram.edges.push(edge1, edge2);
      store.setCurrentArchitecture(arch);

      store.removeEdge('edge-1');

      const state = useArchitectureStore.getState();
      expect(state.current?.diagram.edges).toHaveLength(1);
      expect(state.current?.diagram.edges[0].id).toBe('edge-2');
      expect(state.unsavedChanges).toBe(true);
    });
  });

  describe('Snapshot-based Undo/Redo', () => {
    it('should take snapshot after update', () => {
      const store = useArchitectureStore.getState();
      const arch = createMockArchitecture();
      store.setCurrentArchitecture(arch);

      // Initial snapshot count should be 1
      expect(useArchitectureStore.getState().snapshots).toHaveLength(1);

      store.updateArchitecture({ name: 'Updated' });

      // Should have created a new snapshot
      const state = useArchitectureStore.getState();
      expect(state.snapshots.length).toBeGreaterThan(1);
      expect(state.snapshotIndex).toBe(state.snapshots.length - 1);
    });

    it('should undo to previous snapshot', () => {
      const store = useArchitectureStore.getState();
      const arch = createMockArchitecture();
      arch.name = 'Original';
      store.setCurrentArchitecture(arch);

      store.updateArchitecture({ name: 'Updated' });

      // Undo should restore original name
      store.undo();

      const state = useArchitectureStore.getState();
      expect(state.current?.name).toBe('Original');
      expect(state.snapshotIndex).toBe(0);
      expect(state.unsavedChanges).toBe(true);
    });

    it('should redo to next snapshot', () => {
      const store = useArchitectureStore.getState();
      const arch = createMockArchitecture();
      arch.name = 'Original';
      store.setCurrentArchitecture(arch);

      store.updateArchitecture({ name: 'Updated' });
      store.undo();
      store.redo();

      const state = useArchitectureStore.getState();
      expect(state.current?.name).toBe('Updated');
      expect(state.unsavedChanges).toBe(true);
    });

    it('should handle multiple undo operations', () => {
      const store = useArchitectureStore.getState();
      const arch = createMockArchitecture();
      arch.name = 'Version 0';
      store.setCurrentArchitecture(arch);

      store.updateArchitecture({ name: 'Version 1' });
      store.updateArchitecture({ name: 'Version 2' });
      store.updateArchitecture({ name: 'Version 3' });

      // Undo three times
      store.undo();
      expect(useArchitectureStore.getState().current?.name).toBe('Version 2');

      store.undo();
      expect(useArchitectureStore.getState().current?.name).toBe('Version 1');

      store.undo();
      expect(useArchitectureStore.getState().current?.name).toBe('Version 0');
    });

    it('should discard future snapshots after new change', () => {
      const store = useArchitectureStore.getState();
      const arch = createMockArchitecture();
      arch.name = 'Original';
      store.setCurrentArchitecture(arch);

      store.updateArchitecture({ name: 'Version 1' });
      store.updateArchitecture({ name: 'Version 2' });

      // Undo once
      store.undo();
      expect(useArchitectureStore.getState().snapshots).toHaveLength(3);

      // Make new change - should discard "Version 2" snapshot
      store.updateArchitecture({ name: 'New Branch' });

      const state = useArchitectureStore.getState();
      // Should have: Original, Version 1, New Branch
      expect(state.snapshots).toHaveLength(3);
      expect(state.snapshots[2].name).toBe('New Branch');
      expect(state.canRedo()).toBe(false);
    });

    it('should check canUndo correctly', () => {
      const store = useArchitectureStore.getState();
      const arch = createMockArchitecture();
      store.setCurrentArchitecture(arch);

      expect(store.canUndo()).toBe(false);

      store.updateArchitecture({ name: 'Updated' });
      expect(store.canUndo()).toBe(true);

      store.undo();
      expect(store.canUndo()).toBe(false);
    });

    it('should check canRedo correctly', () => {
      const store = useArchitectureStore.getState();
      const arch = createMockArchitecture();
      store.setCurrentArchitecture(arch);

      expect(store.canRedo()).toBe(false);

      store.updateArchitecture({ name: 'Updated' });
      expect(store.canRedo()).toBe(false);

      store.undo();
      expect(store.canRedo()).toBe(true);

      store.redo();
      expect(store.canRedo()).toBe(false);
    });

    it('should limit snapshots to 50', () => {
      const store = useArchitectureStore.getState();
      const arch = createMockArchitecture();
      store.setCurrentArchitecture(arch);

      // Create 60 snapshots
      for (let i = 0; i < 60; i++) {
        store.updateArchitecture({ name: `Version ${i}` });
      }

      const state = useArchitectureStore.getState();
      expect(state.snapshots.length).toBeLessThanOrEqual(50);
      expect(state.snapshotIndex).toBe(49);
    });

    it('should deep clone snapshots', () => {
      const store = useArchitectureStore.getState();
      const arch = createMockArchitecture();
      store.setCurrentArchitecture(arch);

      const node = createMockNode();
      store.updateArchitecture({
        diagram: {
          nodes: [node],
          edges: [],
        },
      });

      const snapshotBeforeUndo = JSON.parse(JSON.stringify(useArchitectureStore.getState().snapshots[1]));

      store.undo();

      // Verify snapshot wasn't modified during undo
      const snapshotAfterUndo = useArchitectureStore.getState().snapshots[1];
      expect(snapshotAfterUndo).toEqual(snapshotBeforeUndo);

      // Verify snapshots are independent
      const snapshot = useArchitectureStore.getState().snapshots[0];
      expect(snapshot.name).toBe('Test Architecture');
    });
  });

  describe('History Management', () => {
    it('should push action to history', () => {
      const store = useArchitectureStore.getState();
      const arch = createMockArchitecture();
      store.setCurrentArchitecture(arch);

      const node = createMockNode();
      store.pushToHistory('add_node', node, 'Added test node');

      const state = useArchitectureStore.getState();
      expect(state.history).toHaveLength(1);
      expect(state.history[0].action).toBe('add_node');
      expect(state.history[0].description).toBe('Added test node');
      expect(state.historyIndex).toBe(0);
    });

    it('should limit history to 50 entries', () => {
      const store = useArchitectureStore.getState();
      const arch = createMockArchitecture();
      store.setCurrentArchitecture(arch);

      // Create 60 history entries
      for (let i = 0; i < 60; i++) {
        store.pushToHistory('test_action', {}, `Action ${i}`);
      }

      const state = useArchitectureStore.getState();
      expect(state.history.length).toBeLessThanOrEqual(50);
    });

    it('should clear history', () => {
      const store = useArchitectureStore.getState();
      const arch = createMockArchitecture();
      store.setCurrentArchitecture(arch);

      store.pushToHistory('test', {}, 'Test');
      store.clearHistory();

      const state = useArchitectureStore.getState();
      expect(state.history).toHaveLength(0);
      expect(state.historyIndex).toBe(-1);
      expect(state.snapshots).toHaveLength(0);
      expect(state.snapshotIndex).toBe(-1);
    });
  });

  describe('Utility Actions', () => {
    it('should set loading state', () => {
      const store = useArchitectureStore.getState();

      store.setLoading(true);
      expect(useArchitectureStore.getState().loading).toBe(true);

      store.setLoading(false);
      expect(useArchitectureStore.getState().loading).toBe(false);
    });

    it('should set error state', () => {
      const store = useArchitectureStore.getState();

      store.setError('Test error');
      expect(useArchitectureStore.getState().error).toBe('Test error');

      store.setError(null);
      expect(useArchitectureStore.getState().error).toBeNull();
    });

    it('should mark as saved', () => {
      const store = useArchitectureStore.getState();
      const arch = createMockArchitecture();
      store.setCurrentArchitecture(arch);

      store.updateArchitecture({ name: 'Updated' });
      expect(useArchitectureStore.getState().unsavedChanges).toBe(true);

      store.markSaved();
      expect(useArchitectureStore.getState().unsavedChanges).toBe(false);
    });

    it('should mark as unsaved', () => {
      const store = useArchitectureStore.getState();

      store.markUnsaved();
      expect(useArchitectureStore.getState().unsavedChanges).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete workflow: create, modify, undo, redo, save', () => {
      const store = useArchitectureStore.getState();

      // Create architecture
      const arch = createMockArchitecture();
      arch.name = 'Original';
      store.setCurrentArchitecture(arch);
      expect(store.unsavedChanges).toBe(false);

      // Add node
      const node = createMockNode();
      store.addNode(node);
      expect(useArchitectureStore.getState().current?.diagram.nodes).toHaveLength(1);
      expect(useArchitectureStore.getState().unsavedChanges).toBe(true);

      // Add edge
      const node2 = createMockNode('node-2');
      useArchitectureStore.getState().addNode(node2);
      const edge = createMockEdge('edge-1', 'node-1', 'node-2');
      useArchitectureStore.getState().addEdge(edge);

      // Undo edge addition
      store.undo();
      expect(useArchitectureStore.getState().current?.diagram.edges).toHaveLength(0);

      // Redo edge addition
      store.redo();
      expect(useArchitectureStore.getState().current?.diagram.edges).toHaveLength(1);

      // Save
      store.markSaved();
      expect(useArchitectureStore.getState().unsavedChanges).toBe(false);
    });
  });
});
