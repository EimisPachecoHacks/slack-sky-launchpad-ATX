/**
 * Environment Configuration Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock import.meta.env before importing
vi.mock('import.meta.env', () => ({
  VITE_API_URL: 'http://localhost:8000',
  DEV: true,
  PROD: false,
}));

describe('Environment Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('URL Validation', () => {
    it('should validate http URLs', async () => {
      const { __testing__ } = await import('../env');
      expect(__testing__.isValidUrl('http://localhost:8000')).toBe(true);
    });

    it('should validate https URLs', async () => {
      const { __testing__ } = await import('../env');
      expect(__testing__.isValidUrl('https://api.example.com')).toBe(true);
    });

    it('should reject invalid URLs', async () => {
      const { __testing__ } = await import('../env');
      expect(__testing__.isValidUrl('not-a-url')).toBe(false);
      expect(__testing__.isValidUrl('ftp://invalid')).toBe(false);
      expect(__testing__.isValidUrl('')).toBe(false);
    });
  });

  describe('Environment Export', () => {
    it('should export env object with required fields', async () => {
      // Set up valid environment
      vi.stubEnv('VITE_API_URL', 'http://localhost:8000');

      const { env } = await import('../env');

      expect(env).toBeDefined();
      expect(env.apiUrl).toBe('http://localhost:8000');
      expect(env.isDevelopment).toBeDefined();
      expect(env.isProduction).toBeDefined();
    });
  });

  describe('Configuration Validation', () => {
    it('should accept valid configuration', async () => {
      vi.stubEnv('VITE_API_URL', 'http://localhost:8000');

      const { validateConfig } = await import('../env');

      expect(() => validateConfig()).not.toThrow();
    });

    it('should warn about localhost in production', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn');

      vi.stubEnv('VITE_API_URL', 'http://localhost:8000');
      vi.stubEnv('DEV', false);
      vi.stubEnv('PROD', true);

      // Re-import to get updated env
      vi.resetModules();
      const { validateConfig } = await import('../env');

      validateConfig();

      // Should warn about localhost in production
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe('Supabase Configuration', () => {
    it('should handle optional Supabase config', async () => {
      vi.stubEnv('VITE_API_URL', 'http://localhost:8000');
      vi.stubEnv('VITE_SUPABASE_URL', '');
      vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

      vi.resetModules();
      const { env } = await import('../env');

      expect(env.supabase).toBeUndefined();
    });

    it('should include Supabase config when both values provided', async () => {
      vi.stubEnv('VITE_API_URL', 'http://localhost:8000');
      vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co');
      vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-123');

      vi.resetModules();
      const { env } = await import('../env');

      expect(env.supabase).toBeDefined();
      expect(env.supabase?.url).toBe('https://project.supabase.co');
      expect(env.supabase?.anonKey).toBe('anon-key-123');
    });
  });
});
