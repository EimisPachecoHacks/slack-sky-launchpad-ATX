/**
 * API Client Tests
 * Tests for request/response interceptors, retry logic, and error handling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { APIClient } from '../apiClient';
import { APIError, AuthError, RateLimitError, NetworkError } from '../errors';

describe('APIClient', () => {
  let client: APIClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create fresh client for each test
    client = new APIClient({
      baseURL: 'http://localhost:8000',
      timeout: 5000,
      retryAttempts: 2,
      retryDelay: 100,
    });

    // Mock fetch
    fetchMock = vi.fn();
    global.fetch = fetchMock;

    // Mock localStorage
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Requests', () => {
    it('should make GET request', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: 'test' }),
      });

      const result = await client.get('/api/test');

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:8000/api/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(result).toEqual({ data: 'test' });
    });

    it('should make POST request with data', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ id: 123 }),
      });

      const postData = { name: 'test' };
      const result = await client.post('/api/test', postData);

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:8000/api/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(postData),
        })
      );
      expect(result).toEqual({ id: 123 });
    });

    it('should make PUT request', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ updated: true }),
      });

      await client.put('/api/test/123', { name: 'updated' });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'PUT',
        })
      );
    });

    it('should make DELETE request', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 204,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: async () => '',
        json: async () => ({}),
      });

      await client.delete('/api/test/123');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('should make PATCH request', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ patched: true }),
      });

      await client.patch('/api/test/123', { field: 'value' });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'PATCH',
        })
      );
    });
  });

  describe('Request Interceptors', () => {
    it('should apply custom request interceptor', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      });

      // Add custom interceptor
      client.addRequestInterceptor((url, options) => {
        return {
          url,
          options: {
            ...options,
            headers: {
              ...options.headers,
              'X-Custom-Header': 'test-value',
            },
          },
        };
      });

      await client.get('/api/test');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom-Header': 'test-value',
          }),
        })
      );
    });

    it('should add auth token from localStorage', async () => {
      // Mock localStorage with auth token
      const mockLocalStorage = {
        getItem: vi.fn((key: string) => {
          if (key === 'auth_token') return 'test-token-123';
          return null;
        }),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      };
      Object.defineProperty(global, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
      });

      const authClient = new APIClient({
        baseURL: 'http://localhost:8000',
      });

      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      });

      await authClient.get('/api/test');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-123',
          }),
        })
      );
    });

    it('should add API key from localStorage', async () => {
      // Mock localStorage with API key
      const mockLocalStorage = {
        getItem: vi.fn((key: string) => {
          if (key === 'api_key') return 'api-key-456';
          return null;
        }),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      };
      Object.defineProperty(global, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
      });

      const apiKeyClient = new APIClient({
        baseURL: 'http://localhost:8000',
      });

      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      });

      await apiKeyClient.get('/api/test');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'api-key-456',
          }),
        })
      );
    });
  });

  describe('Response Interceptors', () => {
    it('should apply custom response interceptor', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: 'original' }),
      });

      let interceptorCalled = false;
      client.addResponseInterceptor((response) => {
        interceptorCalled = true;
        return response;
      });

      await client.get('/api/test');

      expect(interceptorCalled).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should throw APIError on 404', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ detail: 'Not found' }),
      });

      await expect(client.get('/api/test')).rejects.toThrow(APIError);
    });

    it('should throw AuthError on 401', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ detail: 'Unauthorized' }),
      });

      await expect(client.get('/api/test')).rejects.toThrow(AuthError);
    });

    it('should throw RateLimitError on 429', async () => {
      const headers = new Headers({
        'content-type': 'application/json',
        'Retry-After': '60',
      });

      fetchMock.mockResolvedValue({
        ok: false,
        status: 429,
        headers,
        json: async () => ({ detail: 'Rate limited' }),
      });

      await expect(client.get('/api/test')).rejects.toThrow(RateLimitError);
    });

    it('should apply error interceptors', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ detail: 'Server error' }),
      });

      let errorInterceptorCalled = false;
      client.addErrorInterceptor((error) => {
        errorInterceptorCalled = true;
        expect(error).toBeInstanceOf(APIError);
      });

      // Retry attempts = 2, so total calls = 3 (initial + 2 retries)
      await expect(client.get('/api/test')).rejects.toThrow();

      expect(errorInterceptorCalled).toBe(true);
    });
  });

  describe('Retry Logic', () => {
    it('should retry on 500 error', async () => {
      let callCount = 0;
      fetchMock.mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          return {
            ok: false,
            status: 500,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({ detail: 'Server error' }),
          };
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ data: 'success' }),
        };
      });

      const result = await client.get('/api/test');

      expect(callCount).toBe(3); // Initial + 2 retries
      expect(result).toEqual({ data: 'success' });
    });

    it('should retry on network error', async () => {
      let callCount = 0;
      fetchMock.mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          throw new TypeError('Network error');
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ data: 'success' }),
        };
      });

      const result = await client.get('/api/test');

      expect(callCount).toBe(3);
      expect(result).toEqual({ data: 'success' });
    });

    it('should not retry on 4xx errors', async () => {
      let callCount = 0;
      fetchMock.mockImplementation(async () => {
        callCount++;
        return {
          ok: false,
          status: 400,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ detail: 'Bad request' }),
        };
      });

      await expect(client.get('/api/test')).rejects.toThrow();

      expect(callCount).toBe(1); // No retries
    });

    it('should throw after max retries exceeded', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ detail: 'Server error' }),
      });

      await expect(client.get('/api/test')).rejects.toThrow(APIError);

      // Initial + 2 retries = 3 total calls
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout after specified duration', async () => {
      const shortTimeoutClient = new APIClient({
        baseURL: 'http://localhost:8000',
        timeout: 100,
      });

      fetchMock.mockImplementation(
        (url, options: any) =>
          new Promise((resolve, reject) => {
            // Simulate abort
            if (options?.signal) {
              const abortHandler = () => {
                const error = new Error('Aborted');
                error.name = 'AbortError';
                reject(error);
              };
              options.signal.addEventListener('abort', abortHandler);
            }

            setTimeout(() => {
              resolve({
                ok: true,
                status: 200,
                headers: new Headers({ 'content-type': 'application/json' }),
                json: async () => ({}),
              });
            }, 200); // Longer than timeout
          })
      );

      await expect(shortTimeoutClient.get('/api/test')).rejects.toThrow(APIError);
    });
  });

  describe('Response Parsing', () => {
    it('should parse JSON response', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: 'test', count: 42 }),
      });

      const result = await client.get('/api/test');

      expect(result).toEqual({ data: 'test', count: 42 });
    });

    it('should parse text response', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: async () => 'plain text response',
      });

      const result = await client.get('/api/test');

      expect(result).toBe('plain text response');
    });
  });

  describe('Network Errors', () => {
    it('should handle network errors', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(client.get('/api/test')).rejects.toThrow(NetworkError);
    });

    it('should retry network errors', async () => {
      let callCount = 0;
      fetchMock.mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          throw new TypeError('Network error');
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ recovered: true }),
        };
      });

      const result = await client.get('/api/test');

      expect(callCount).toBe(3);
      expect(result).toEqual({ recovered: true });
    });
  });

  describe('Configuration', () => {
    it('should use custom base URL', async () => {
      const customClient = new APIClient({
        baseURL: 'https://api.example.com',
      });

      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      });

      await customClient.get('/test');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.any(Object)
      );
    });

    it('should use custom headers', async () => {
      const customClient = new APIClient({
        baseURL: 'http://localhost:8000',
        headers: {
          'X-Custom': 'custom-value',
        },
      });

      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      });

      await customClient.get('/test');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom': 'custom-value',
          }),
        })
      );
    });
  });
});
