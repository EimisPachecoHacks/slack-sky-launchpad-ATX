/**
 * State Persistence Utilities
 * Handles localStorage persistence for Zustand stores with versioning and migration
 */

import { StateStorage } from 'zustand/middleware';

/**
 * Storage version for managing migrations
 */
const STORAGE_VERSION = 1;

/**
 * Storage keys for different stores
 */
export const STORAGE_KEYS = {
  ARCHITECTURE: 'skyrchitect-architecture-store',
  PREFERENCES: 'skyrchitect-preferences-store',
  UI: 'skyrchitect-ui-store',
} as const;

/**
 * Custom storage implementation with error handling
 */
export const createStorage = (storageKey: string): StateStorage => {
  return {
    getItem: (name: string): string | null => {
      try {
        const item = localStorage.getItem(name);
        if (!item) return null;

        // Parse and validate version
        const parsed = JSON.parse(item);
        if (parsed.version !== STORAGE_VERSION) {
          console.warn(
            `Storage version mismatch for ${storageKey}. Expected ${STORAGE_VERSION}, got ${parsed.version}. Clearing outdated data.`
          );
          localStorage.removeItem(name);
          return null;
        }

        return item;
      } catch (error) {
        console.error(`Error reading from localStorage (${storageKey}):`, error);
        return null;
      }
    },

    setItem: (name: string, value: string): void => {
      try {
        // Add version to stored data
        const parsed = JSON.parse(value);
        const versionedData = {
          ...parsed,
          version: STORAGE_VERSION,
        };
        localStorage.setItem(name, JSON.stringify(versionedData));
      } catch (error) {
        console.error(`Error writing to localStorage (${storageKey}):`, error);
      }
    },

    removeItem: (name: string): void => {
      try {
        localStorage.removeItem(name);
      } catch (error) {
        console.error(`Error removing from localStorage (${storageKey}):`, error);
      }
    },
  };
};

/**
 * Storage migration utilities
 */
export const migrateStorage = (
  storageKey: string,
  fromVersion: number,
  toVersion: number
): void => {
  console.log(`Migrating ${storageKey} from v${fromVersion} to v${toVersion}`);

  // Add migration logic here as needed
  // For now, we just clear old data
  if (fromVersion < toVersion) {
    localStorage.removeItem(storageKey);
  }
};

/**
 * Clear all persisted state
 */
export const clearAllPersistedState = (): void => {
  Object.values(STORAGE_KEYS).forEach((key) => {
    localStorage.removeItem(key);
  });
  console.log('All persisted state cleared');
};

/**
 * Get total storage usage
 */
export const getStorageUsage = (): {
  total: number;
  byStore: Record<string, number>;
} => {
  const byStore: Record<string, number> = {};
  let total = 0;

  Object.entries(STORAGE_KEYS).forEach(([storeName, key]) => {
    const item = localStorage.getItem(key);
    const size = item ? new Blob([item]).size : 0;
    byStore[storeName] = size;
    total += size;
  });

  return { total, byStore };
};

/**
 * Partialize function to exclude fields from persistence
 */
export const createPartialize = <T extends object>(
  excludeKeys: (keyof T)[]
) => {
  return (state: T): Partial<T> => {
    const persistedState: Partial<T> = {};

    Object.keys(state).forEach((key) => {
      if (!excludeKeys.includes(key as keyof T)) {
        persistedState[key as keyof T] = state[key as keyof T];
      }
    });

    return persistedState;
  };
};

/**
 * Merge persisted state with default state
 */
export const mergePersistedState = <T extends object>(
  persistedState: Partial<T> | null,
  defaultState: T
): T => {
  if (!persistedState) return defaultState;

  return {
    ...defaultState,
    ...persistedState,
  };
};

/**
 * Debounced save to prevent excessive writes
 */
export const createDebouncedSave = (delay: number = 500) => {
  let timeoutId: NodeJS.Timeout | null = null;

  return (saveFn: () => void) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      saveFn();
      timeoutId = null;
    }, delay);
  };
};
