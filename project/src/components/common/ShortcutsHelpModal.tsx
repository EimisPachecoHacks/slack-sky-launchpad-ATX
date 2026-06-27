import React from 'react';
import type { KeyboardShortcut } from '../../types';

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

interface ShortcutsHelpModalProps {
  show: boolean;
  onClose: () => void;
}

const ShortcutsHelpModal: React.FC<ShortcutsHelpModalProps> = ({ show, onClose }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background-card rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden border border-border-secondary">
        <div className="p-6 border-b border-border-secondary">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-text-primary">
              Keyboard Shortcuts
            </h2>
            <button
              onClick={onClose}
              className="text-text-tertiary hover:text-text-secondary"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-96">
          <div className="grid gap-4">
            {DEFAULT_SHORTCUTS.map((shortcut, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-border-secondary last:border-b-0">
                <span className="text-sm text-text-secondary">
                  {shortcut.description}
                </span>
                <div className="flex items-center space-x-1">
                  {shortcut.ctrl && (
                    <kbd className="px-2 py-1 text-xs font-semibold text-text-primary bg-background-secondary border border-border-secondary rounded">
                      Ctrl
                    </kbd>
                  )}
                  {shortcut.shift && (
                    <kbd className="px-2 py-1 text-xs font-semibold text-text-primary bg-background-secondary border border-border-secondary rounded">
                      Shift
                    </kbd>
                  )}
                  {shortcut.alt && (
                    <kbd className="px-2 py-1 text-xs font-semibold text-text-primary bg-background-secondary border border-border-secondary rounded">
                      Alt
                    </kbd>
                  )}
                  <kbd className="px-2 py-1 text-xs font-semibold text-text-primary bg-background-secondary border border-border-secondary rounded">
                    {shortcut.key}
                  </kbd>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShortcutsHelpModal;