import { create } from 'zustand';
import { devtools, subscribeWithSelector, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import equal from 'fast-deep-equal';
import { STORAGE_KEYS, createStorage, createPartialize } from './persistence';
import type {
  Architecture,
  DiagramNode,
  DiagramEdge,
  HistoryEntry,
  UserPreferences,
  ViewportState,
  DragState,
  AppError
} from '../types';

/**
 * Helper function to take snapshot only if state has changed
 * Uses fast-deep-equal for efficient comparison
 */
function takeSnapshotIfChanged(draft: any): void {
  if (!draft.current) return;

  // Clone the current state
  const snapshot = JSON.parse(JSON.stringify(draft.current));

  // Get the last snapshot for comparison
  const lastSnapshot = draft.snapshots[draft.snapshotIndex];

  // Only add snapshot if state has changed (using fast-deep-equal)
  if (!lastSnapshot || !equal(snapshot, lastSnapshot)) {
    // Remove future snapshots if we're not at the end
    draft.snapshots = draft.snapshots.slice(0, draft.snapshotIndex + 1);

    // Add new snapshot
    draft.snapshots.push(snapshot);
    draft.snapshotIndex = draft.snapshots.length - 1;

    // Limit to last 50 snapshots
    if (draft.snapshots.length > 50) {
      draft.snapshots = draft.snapshots.slice(-50);
      draft.snapshotIndex = 49;
    }
  }
}

// Architecture Store
interface ArchitectureStore {
  // State
  current: Architecture | null;
  list: Architecture[];
  history: HistoryEntry[];
  historyIndex: number;
  // Snapshot-based undo/redo
  snapshots: Architecture[];
  snapshotIndex: number;
  loading: boolean;
  error: string | null;
  unsavedChanges: boolean;
  
  // Actions
  setCurrentArchitecture: (architecture: Architecture | null) => void;
  updateArchitecture: (updates: Partial<Architecture>) => void;
  addArchitecture: (architecture: Architecture) => void;
  removeArchitecture: (id: string) => void;
  duplicateArchitecture: (id: string) => void;
  
  // Diagram actions
  addNode: (node: DiagramNode) => void;
  updateNode: (id: string, updates: Partial<DiagramNode>) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: DiagramEdge) => void;
  removeEdge: (id: string) => void;
  
  // History actions
  pushToHistory: (action: string, data: any, description: string) => void;
  takeSnapshot: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;
  
  // Utility actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  markSaved: () => void;
  markUnsaved: () => void;
}

export const useArchitectureStore = create<ArchitectureStore>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
        // Initial state
        current: null,
        list: [],
        history: [],
        historyIndex: -1,
        snapshots: [],
        snapshotIndex: -1,
        loading: false,
        error: null,
        unsavedChanges: false,

        // Architecture actions
        setCurrentArchitecture: (architecture) =>
          set((state) => {
            state.current = architecture;
            state.unsavedChanges = false;
            // Take initial snapshot when architecture is loaded
            if (architecture) {
              state.snapshots = [JSON.parse(JSON.stringify(architecture))];
              state.snapshotIndex = 0;
            }
          }),

        updateArchitecture: (updates) =>
          set((state) => {
            if (state.current) {
              Object.assign(state.current, updates);
              state.current.metadata.lastModified = new Date().toISOString();
              state.unsavedChanges = true;

              // Take snapshot only if state changed
              takeSnapshotIfChanged(state);
            }
          }),

        addArchitecture: (architecture) =>
          set((state) => {
            state.list.push(architecture);
          }),

        removeArchitecture: (id) =>
          set((state) => {
            state.list = state.list.filter(arch => arch.id !== id);
            if (state.current?.id === id) {
              state.current = null;
            }
          }),

        duplicateArchitecture: (id) =>
          set((state) => {
            const original = state.list.find(arch => arch.id === id);
            if (original) {
              const duplicate: Architecture = {
                ...original,
                id: `${original.id}-copy-${Date.now()}`,
                name: `${original.name} (Copy)`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              state.list.push(duplicate);
            }
          }),

        // Diagram actions
        addNode: (node) =>
          set((state) => {
            if (state.current) {
              state.current.diagram.nodes.push(node);
              state.unsavedChanges = true;
              get().pushToHistory('add_node', node, `Added node: ${node.label}`);

              // Take snapshot only if state changed
              takeSnapshotIfChanged(state);
            }
          }),

        updateNode: (id, updates) =>
          set((state) => {
            if (state.current) {
              const nodeIndex = state.current.diagram.nodes.findIndex(n => n.id === id);
              if (nodeIndex >= 0) {
                Object.assign(state.current.diagram.nodes[nodeIndex], updates);
                state.unsavedChanges = true;
                get().pushToHistory('update_node', { id, updates }, `Updated node: ${id}`);

                // Take snapshot only if state changed
                takeSnapshotIfChanged(state);
              }
            }
          }),

        removeNode: (id) =>
          set((state) => {
            if (state.current) {
              const nodeIndex = state.current.diagram.nodes.findIndex(n => n.id === id);
              if (nodeIndex >= 0) {
                const removedNode = state.current.diagram.nodes.splice(nodeIndex, 1)[0];
                // Remove related edges
                state.current.diagram.edges = state.current.diagram.edges.filter(
                  edge => edge.from !== id && edge.to !== id
                );
                state.unsavedChanges = true;
                get().pushToHistory('remove_node', removedNode, `Removed node: ${removedNode.label}`);

                // Take snapshot only if state changed
                takeSnapshotIfChanged(state);
              }
            }
          }),

        addEdge: (edge) =>
          set((state) => {
            if (state.current) {
              state.current.diagram.edges.push(edge);
              state.unsavedChanges = true;
              get().pushToHistory('add_edge', edge, `Added connection: ${edge.from} → ${edge.to}`);

              // Take snapshot only if state changed
              takeSnapshotIfChanged(state);
            }
          }),

        removeEdge: (id) =>
          set((state) => {
            if (state.current) {
              const edgeIndex = state.current.diagram.edges.findIndex(e => e.id === id);
              if (edgeIndex >= 0) {
                const removedEdge = state.current.diagram.edges.splice(edgeIndex, 1)[0];
                state.unsavedChanges = true;
                get().pushToHistory('remove_edge', removedEdge, `Removed connection`);

                // Take snapshot only if state changed
                takeSnapshotIfChanged(state);
              }
            }
          }),

        // History actions
        pushToHistory: (action, data, description) =>
          set((state) => {
            const entry: HistoryEntry = {
              id: `history-${Date.now()}`,
              timestamp: new Date().toISOString(),
              action,
              data,
              description
            };
            
            // Remove any history entries after current index (for when we undo then do new action)
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push(entry);
            state.historyIndex = state.history.length - 1;
            
            // Limit history size
            if (state.history.length > 50) {
              state.history.shift();
              state.historyIndex--;
            }
          }),

        // Take snapshot of current architecture state
        takeSnapshot: () => {
          const state = get();
          if (!state.current) return;

          set((draft) => {
            // Use optimized snapshot helper
            takeSnapshotIfChanged(draft);
          });
        },

        undo: () => {
          const state = get();
          if (state.canUndo()) {
            set((draft) => {
              draft.snapshotIndex--;
              // Restore architecture from snapshot
              draft.current = JSON.parse(JSON.stringify(draft.snapshots[draft.snapshotIndex]));
              draft.unsavedChanges = true;
            });
          }
        },

        redo: () => {
          const state = get();
          if (state.canRedo()) {
            set((draft) => {
              draft.snapshotIndex++;
              // Restore architecture from snapshot
              draft.current = JSON.parse(JSON.stringify(draft.snapshots[draft.snapshotIndex]));
              draft.unsavedChanges = true;
            });
          }
        },

        canUndo: () => {
          const state = get();
          return state.snapshotIndex > 0;
        },

        canRedo: () => {
          const state = get();
          return state.snapshotIndex < state.snapshots.length - 1;
        },

        clearHistory: () =>
          set((state) => {
            state.history = [];
            state.historyIndex = -1;
            state.snapshots = [];
            state.snapshotIndex = -1;
          }),

        // Utility actions
        setLoading: (loading) =>
          set((state) => {
            state.loading = loading;
          }),

        setError: (error) =>
          set((state) => {
            state.error = error;
          }),

        markSaved: () =>
          set((state) => {
            state.unsavedChanges = false;
          }),

        markUnsaved: () =>
          set((state) => {
            state.unsavedChanges = true;
          })
      }))
      ),
      {
        name: STORAGE_KEYS.ARCHITECTURE,
        storage: createStorage(STORAGE_KEYS.ARCHITECTURE),
        partialize: createPartialize<ArchitectureStore>(['loading', 'error']),
      }
    ),
    { name: 'architecture-store' }
  )
);

// UI Store
interface UIStore {
  // State
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  fullscreenMode: boolean;
  activeTab: string;
  selectedNodes: string[];
  dragState: DragState;
  viewport: ViewportState;
  showGrid: boolean;
  snapToGrid: boolean;
  
  // Actions
  setTheme: (theme: 'light' | 'dark') => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setFullscreenMode: (fullscreen: boolean) => void;
  setActiveTab: (tab: string) => void;
  setSelectedNodes: (nodeIds: string[]) => void;
  addSelectedNode: (nodeId: string) => void;
  removeSelectedNode: (nodeId: string) => void;
  clearSelection: () => void;
  setDragState: (dragState: Partial<DragState>) => void;
  setViewport: (viewport: Partial<ViewportState>) => void;
  resetViewport: () => void;
  toggleGrid: () => void;
  toggleSnapToGrid: () => void;
}

export const useUIStore = create<UIStore>()(
  devtools(
    persist(
      immer((set, get) => ({
      // Initial state
      theme: 'dark',
      sidebarOpen: true,
      fullscreenMode: false,
      activeTab: 'resources',
      selectedNodes: [],
      dragState: {
        isDragging: false,
        nodeId: null,
        offset: { x: 0, y: 0 },
        startPosition: { x: 0, y: 0 }
      },
      viewport: {
        zoom: 1,
        pan: { x: 0, y: 0 },
        bounds: { x: 0, y: 0, width: 800, height: 600 }
      },
      showGrid: true,
      snapToGrid: false,

      // Actions
      setTheme: (theme) =>
        set((state) => {
          state.theme = theme;
        }),

      toggleSidebar: () =>
        set((state) => {
          state.sidebarOpen = !state.sidebarOpen;
        }),

      setSidebarOpen: (open) =>
        set((state) => {
          state.sidebarOpen = open;
        }),

      setFullscreenMode: (fullscreen) =>
        set((state) => {
          state.fullscreenMode = fullscreen;
        }),

      setActiveTab: (tab) =>
        set((state) => {
          state.activeTab = tab;
        }),

      setSelectedNodes: (nodeIds) =>
        set((state) => {
          state.selectedNodes = nodeIds;
        }),

      addSelectedNode: (nodeId) =>
        set((state) => {
          if (!state.selectedNodes.includes(nodeId)) {
            state.selectedNodes.push(nodeId);
          }
        }),

      removeSelectedNode: (nodeId) =>
        set((state) => {
          state.selectedNodes = state.selectedNodes.filter(id => id !== nodeId);
        }),

      clearSelection: () =>
        set((state) => {
          state.selectedNodes = [];
        }),

      setDragState: (dragState) =>
        set((state) => {
          Object.assign(state.dragState, dragState);
        }),

      setViewport: (viewport) =>
        set((state) => {
          Object.assign(state.viewport, viewport);
        }),

      resetViewport: () =>
        set((state) => {
          state.viewport = {
            zoom: 1,
            pan: { x: 0, y: 0 },
            bounds: { x: 0, y: 0, width: 800, height: 600 }
          };
        }),

      toggleGrid: () =>
        set((state) => {
          state.showGrid = !state.showGrid;
        }),

      toggleSnapToGrid: () =>
        set((state) => {
          state.snapToGrid = !state.snapToGrid;
        })
    })),
      {
        name: STORAGE_KEYS.UI,
        storage: createStorage(STORAGE_KEYS.UI),
        partialize: createPartialize<UIStore>(['selectedNodes', 'dragState']),
      }
    ),
    { name: 'ui-store' }
  )
);

// Performance Store
interface PerformanceStore {
  metrics: {
    renderTime: number;
    fps: number;
    nodeCount: number;
    edgeCount: number;
  };
  optimizations: {
    useVirtualization: boolean;
    debounceInterval: number;
    maxRenderNodes: number;
  };
  
  updateMetrics: (metrics: Partial<PerformanceStore['metrics']>) => void;
  setOptimizations: (optimizations: Partial<PerformanceStore['optimizations']>) => void;
}

export const usePerformanceStore = create<PerformanceStore>()(
  devtools(
    immer((set) => ({
      metrics: {
        renderTime: 0,
        fps: 0,
        nodeCount: 0,
        edgeCount: 0
      },
      optimizations: {
        useVirtualization: true,
        debounceInterval: 16,
        maxRenderNodes: 100
      },

      updateMetrics: (metrics) =>
        set((state) => {
          Object.assign(state.metrics, metrics);
        }),

      setOptimizations: (optimizations) =>
        set((state) => {
          Object.assign(state.optimizations, optimizations);
        })
    })),
    { name: 'performance-store' }
  )
);

// Error Store
interface ErrorStore {
  errors: AppError[];
  
  addError: (error: AppError) => void;
  removeError: (id: string) => void;
  clearErrors: () => void;
}

export const useErrorStore = create<ErrorStore>()(
  devtools(
    immer((set) => ({
      errors: [],

      addError: (error) =>
        set((state) => {
          state.errors.push(error);
        }),

      removeError: (id) =>
        set((state) => {
          state.errors = state.errors.filter(error => error.code !== id);
        }),

      clearErrors: () =>
        set((state) => {
          state.errors = [];
        })
    })),
    { name: 'error-store' }
  )
);

// Preferences Store
interface PreferencesStore {
  preferences: UserPreferences;
  
  updatePreferences: (updates: Partial<UserPreferences>) => void;
  resetPreferences: () => void;
}

const defaultPreferences: UserPreferences = {
  optimizationPreference: 'balanced',
  defaultProvider: 'aws',
  currency: 'USD',
  notifications: {
    costAlerts: true,
    performanceAlerts: true,
    securityAlerts: true,
    maintenanceUpdates: false
  },
  ui: {
    theme: 'dark',
    compactMode: false,
    showGrid: true,
    snapToGrid: false,
    autoSave: true,
    animationsEnabled: true
  }
};

export const usePreferencesStore = create<PreferencesStore>()(
  devtools(
    persist(
      immer((set) => ({
        preferences: defaultPreferences,

        updatePreferences: (updates) =>
          set((state) => {
            Object.assign(state.preferences, updates);
          }),

        resetPreferences: () =>
          set((state) => {
            state.preferences = { ...defaultPreferences };
          })
      })),
      {
        name: STORAGE_KEYS.PREFERENCES,
        storage: createStorage(STORAGE_KEYS.PREFERENCES),
      }
    ),
    { name: 'preferences-store' }
  )
);