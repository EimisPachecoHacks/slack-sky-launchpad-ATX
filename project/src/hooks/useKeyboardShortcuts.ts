import { useEffect, useCallback, useRef, useState } from 'react';
import { useArchitectureStore, useUIStore } from '../store';
import type { KeyboardShortcut } from '../types';

// Default keyboard shortcuts
const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  { key: 's', ctrl: true, action: 'save', description: 'Save diagram' },
  { key: 'z', ctrl: true, action: 'undo', description: 'Undo last action' },
  { key: 'y', ctrl: true, action: 'redo', description: 'Redo last action' },
  { key: 'z', ctrl: true, shift: true, action: 'redo', description: 'Redo last action (alternative)' },
  { key: 'a', ctrl: true, action: 'select_all', description: 'Select all nodes' },
  { key: 'Delete', action: 'delete_selected', description: 'Delete selected nodes' },
  { key: 'Backspace', action: 'delete_selected', description: 'Delete selected nodes' },
  { key: 'Escape', action: 'clear_selection', description: 'Clear selection' },
  { key: 'c', ctrl: true, action: 'copy', description: 'Copy selected nodes' },
  { key: 'v', ctrl: true, action: 'paste', description: 'Paste nodes' },
  { key: 'x', ctrl: true, action: 'cut', description: 'Cut selected nodes' },
  { key: 'd', ctrl: true, action: 'duplicate', description: 'Duplicate selected nodes' },
  { key: 'g', ctrl: true, action: 'toggle_grid', description: 'Toggle grid visibility' },
  { key: 'g', ctrl: true, shift: true, action: 'toggle_snap', description: 'Toggle snap to grid' },
  { key: 'f', ctrl: true, action: 'fit_to_screen', description: 'Fit diagram to screen' },
  { key: 'F11', action: 'toggle_fullscreen', description: 'Toggle fullscreen mode' },
  { key: '+', ctrl: true, action: 'zoom_in', description: 'Zoom in' },
  { key: '-', ctrl: true, action: 'zoom_out', description: 'Zoom out' },
  { key: '0', ctrl: true, action: 'reset_zoom', description: 'Reset zoom to 100%' },
  { key: 'ArrowUp', action: 'move_up', description: 'Move selected nodes up' },
  { key: 'ArrowDown', action: 'move_down', description: 'Move selected nodes down' },
  { key: 'ArrowLeft', action: 'move_left', description: 'Move selected nodes left' },
  { key: 'ArrowRight', action: 'move_right', description: 'Move selected nodes right' }
];

interface UseKeyboardShortcutsOptions {
  shortcuts?: KeyboardShortcut[];
  enabled?: boolean;
  preventDefault?: boolean;
}

export const useKeyboardShortcuts = (options: UseKeyboardShortcutsOptions = {}) => {
  const {
    shortcuts = DEFAULT_SHORTCUTS,
    enabled = true,
    preventDefault = true
  } = options;

  const architectureStore = useArchitectureStore();
  const uiStore = useUIStore();
  const clipboardRef = useRef<any[]>([]);

  // Action handlers
  const actionHandlers = {
    save: () => {
      console.log('Save triggered by keyboard shortcut');
      // This would typically call a save function passed as prop
    },

    undo: () => {
      architectureStore.undo();
    },

    redo: () => {
      architectureStore.redo();
    },

    select_all: () => {
      if (architectureStore.current) {
        const allNodeIds = architectureStore.current.diagram.nodes.map(node => node.id);
        uiStore.setSelectedNodes(allNodeIds);
      }
    },

    delete_selected: () => {
      const { selectedNodes } = uiStore;
      selectedNodes.forEach(nodeId => {
        architectureStore.removeNode(nodeId);
      });
      uiStore.clearSelection();
    },

    clear_selection: () => {
      uiStore.clearSelection();
    },

    copy: () => {
      const { current } = architectureStore;
      const { selectedNodes } = uiStore;
      
      if (current && selectedNodes.length > 0) {
        const nodesToCopy = current.diagram.nodes.filter(node => 
          selectedNodes.includes(node.id)
        );
        clipboardRef.current = JSON.parse(JSON.stringify(nodesToCopy));
        console.log(`Copied ${nodesToCopy.length} nodes to clipboard`);
      }
    },

    paste: () => {
      if (clipboardRef.current.length > 0) {
        const { current } = architectureStore;
        if (current) {
          clipboardRef.current.forEach(node => {
            const newNode = {
              ...node,
              id: `${node.id}-copy-${Date.now()}`,
              x: node.x + 20, // Offset to avoid overlap
              y: node.y + 20
            };
            architectureStore.addNode(newNode);
          });
          console.log(`Pasted ${clipboardRef.current.length} nodes`);
        }
      }
    },

    cut: () => {
      // Copy then delete
      actionHandlers.copy();
      actionHandlers.delete_selected();
    },

    duplicate: () => {
      actionHandlers.copy();
      actionHandlers.paste();
    },

    toggle_grid: () => {
      uiStore.toggleGrid();
    },

    toggle_snap: () => {
      uiStore.toggleSnapToGrid();
    },

    fit_to_screen: () => {
      // Reset viewport to fit all nodes
      uiStore.resetViewport();
    },

    toggle_fullscreen: () => {
      const { fullscreenMode } = uiStore;
      uiStore.setFullscreenMode(!fullscreenMode);
      
      if (!fullscreenMode) {
        document.documentElement.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    },

    zoom_in: () => {
      const { viewport } = uiStore;
      const newZoom = Math.min(viewport.zoom * 1.2, 5);
      uiStore.setViewport({ zoom: newZoom });
    },

    zoom_out: () => {
      const { viewport } = uiStore;
      const newZoom = Math.max(viewport.zoom * 0.8, 0.1);
      uiStore.setViewport({ zoom: newZoom });
    },

    reset_zoom: () => {
      uiStore.setViewport({ zoom: 1 });
    },

    move_up: () => {
      const { selectedNodes } = uiStore;
      selectedNodes.forEach(nodeId => {
        const node = architectureStore.current?.diagram.nodes.find(n => n.id === nodeId);
        if (node) {
          architectureStore.updateNode(nodeId, { y: Math.max(0, node.y - 10) });
        }
      });
    },

    move_down: () => {
      const { selectedNodes } = uiStore;
      selectedNodes.forEach(nodeId => {
        const node = architectureStore.current?.diagram.nodes.find(n => n.id === nodeId);
        if (node) {
          architectureStore.updateNode(nodeId, { y: node.y + 10 });
        }
      });
    },

    move_left: () => {
      const { selectedNodes } = uiStore;
      selectedNodes.forEach(nodeId => {
        const node = architectureStore.current?.diagram.nodes.find(n => n.id === nodeId);
        if (node) {
          architectureStore.updateNode(nodeId, { x: Math.max(0, node.x - 10) });
        }
      });
    },

    move_right: () => {
      const { selectedNodes } = uiStore;
      selectedNodes.forEach(nodeId => {
        const node = architectureStore.current?.diagram.nodes.find(n => n.id === nodeId);
        if (node) {
          architectureStore.updateNode(nodeId, { x: node.x + 10 });
        }
      });
    }
  };

  // Check if a key combination matches a shortcut
  const matchesShortcut = useCallback((event: KeyboardEvent, shortcut: KeyboardShortcut): boolean => {
    const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
    const ctrlMatches = Boolean(event.ctrlKey || event.metaKey) === Boolean(shortcut.ctrl);
    const altMatches = Boolean(event.altKey) === Boolean(shortcut.alt);
    const shiftMatches = Boolean(event.shiftKey) === Boolean(shortcut.shift);

    return keyMatches && ctrlMatches && altMatches && shiftMatches;
  }, []);

  // Handle keyboard events
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // Don't trigger shortcuts when typing in input fields
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
      return;
    }

    for (const shortcut of shortcuts) {
      if (matchesShortcut(event, shortcut)) {
        if (preventDefault) {
          event.preventDefault();
        }
        
        const handler = actionHandlers[shortcut.action as keyof typeof actionHandlers];
        if (handler) {
          handler();
        } else {
          console.warn(`No handler found for action: ${shortcut.action}`);
        }
        break;
      }
    }
  }, [enabled, shortcuts, preventDefault, matchesShortcut, actionHandlers]);

  // Attach/detach event listeners
  useEffect(() => {
    if (enabled) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [enabled, handleKeyDown]);

  return {
    shortcuts,
    actionHandlers
  };
};

// Hook for displaying keyboard shortcuts help
export const useShortcutsHelp = () => {
  const [showHelp, setShowHelp] = useState(false);

  const toggleHelp = useCallback(() => {
    setShowHelp(prev => !prev);
  }, []);

  const closeHelp = useCallback(() => {
    setShowHelp(false);
  }, []);

  return {
    showHelp,
    toggleHelp,
    closeHelp
  };
};