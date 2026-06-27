/**
 * API Client with Request/Response Interceptors
 *
 * Features:
 * - Centralized error handling
 * - Request/response logging
 * - Authentication token management
 * - Retry logic for failed requests
 * - Rate limit handling
 */

import {
  APIError,
  parseAPIError,
  parseNetworkError,
  logError,
  AppError,
} from './errors';
import { env } from '../config/env';

/**
 * Request interceptor function type
 */
type RequestInterceptor = (
  url: string,
  options: RequestInit
) => Promise<{ url: string; options: RequestInit }> | { url: string; options: RequestInit };

/**
 * Response interceptor function type
 */
type ResponseInterceptor = (response: Response) => Promise<Response> | Response;

/**
 * Error interceptor function type
 */
type ErrorInterceptor = (error: AppError) => Promise<void> | void;

/**
 * API Client Configuration
 */
interface APIClientConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
  retryAttempts?: number;
  retryDelay?: number;
}

/**
 * API Client with interceptors
 */
export class APIClient {
  private baseURL: string;
  private timeout: number;
  private defaultHeaders: Record<string, string>;
  private retryAttempts: number;
  private retryDelay: number;

  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private errorInterceptors: ErrorInterceptor[] = [];

  constructor(config: APIClientConfig) {
    this.baseURL = config.baseURL;
    this.timeout = config.timeout || 30000; // 30 seconds default
    this.defaultHeaders = config.headers || {};
    this.retryAttempts = config.retryAttempts || 2;
    this.retryDelay = config.retryDelay || 1000;

    // Add default interceptors
    this.addDefaultInterceptors();
  }

  /**
   * Add default request/response interceptors
   */
  private addDefaultInterceptors(): void {
    // Request: Add authentication token
    this.addRequestInterceptor((url, options) => {
      const token = this.getAuthToken();
      if (token) {
        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${token}`,
        };
      }
      return { url, options };
    });

    // Request: Add API key if configured
    this.addRequestInterceptor((url, options) => {
      const apiKey = this.getAPIKey();
      if (apiKey) {
        options.headers = {
          ...options.headers,
          'X-API-Key': apiKey,
        };
      }
      return { url, options };
    });

    // Request: Log requests in development
    if (env.isDevelopment) {
      this.addRequestInterceptor((url, options) => {
        console.log(`[API] ${options.method || 'GET'} ${url}`);
        return { url, options };
      });
    }

    // Response: Log responses in development
    if (env.isDevelopment) {
      this.addResponseInterceptor((response) => {
        console.log(`[API] ${response.status} ${response.url}`);
        return response;
      });
    }

    // Error: Log all errors
    this.addErrorInterceptor((error) => {
      logError(error, { source: 'APIClient' });
    });
  }

  /**
   * Add request interceptor
   */
  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  /**
   * Add response interceptor
   */
  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  /**
   * Add error interceptor
   */
  addErrorInterceptor(interceptor: ErrorInterceptor): void {
    this.errorInterceptors.push(interceptor);
  }

  /**
   * Get auth token from storage
   */
  private getAuthToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  /**
   * Get API key from storage or environment
   */
  private getAPIKey(): string | null {
    return localStorage.getItem('api_key') || null;
  }

  /**
   * Apply request interceptors
   */
  private async applyRequestInterceptors(
    url: string,
    options: RequestInit
  ): Promise<{ url: string; options: RequestInit }> {
    let currentUrl = url;
    let currentOptions = options;

    for (const interceptor of this.requestInterceptors) {
      const result = await interceptor(currentUrl, currentOptions);
      currentUrl = result.url;
      currentOptions = result.options;
    }

    return { url: currentUrl, options: currentOptions };
  }

  /**
   * Apply response interceptors
   */
  private async applyResponseInterceptors(response: Response): Promise<Response> {
    let currentResponse = response;

    for (const interceptor of this.responseInterceptors) {
      currentResponse = await interceptor(currentResponse);
    }

    return currentResponse;
  }

  /**
   * Apply error interceptors
   */
  private async applyErrorInterceptors(error: AppError): Promise<void> {
    for (const interceptor of this.errorInterceptors) {
      await interceptor(error);
    }
  }

  /**
   * Make HTTP request with interceptors and retry logic
   */
  async request<T = any>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    // Set default headers
    options.headers = {
      'Content-Type': 'application/json',
      ...this.defaultHeaders,
      ...options.headers,
    };

    try {
      // Apply request interceptors
      const { url: interceptedUrl, options: interceptedOptions } =
        await this.applyRequestInterceptors(url, options);

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      interceptedOptions.signal = controller.signal;

      // Make request
      let response = await fetch(interceptedUrl, interceptedOptions);

      clearTimeout(timeoutId);

      // Apply response interceptors
      response = await this.applyResponseInterceptors(response);

      // Handle response
      if (!response.ok) {
        const body = await this.parseResponseBody(response);
        const error = parseAPIError(response, body);

        // Apply error interceptors
        await this.applyErrorInterceptors(error);

        // Retry on server errors (500+)
        if (response.status >= 500 && retryCount < this.retryAttempts) {
          await this.delay(this.retryDelay * (retryCount + 1));
          return this.request<T>(endpoint, options, retryCount + 1);
        }

        throw error;
      }

      // Parse and return response
      return await this.parseResponseBody(response);
    } catch (error) {
      // Network error (fetch failed)
      if (error instanceof TypeError) {
        const networkError = parseNetworkError(error as Error);
        await this.applyErrorInterceptors(networkError);

        // Retry on network errors
        if (retryCount < this.retryAttempts) {
          await this.delay(this.retryDelay * (retryCount + 1));
          return this.request<T>(endpoint, options, retryCount + 1);
        }

        throw networkError;
      }

      // Timeout error
      if ((error as Error).name === 'AbortError') {
        const timeoutError = new APIError(
          'Request timeout',
          408,
          'Request timed out. Please try again.'
        );
        await this.applyErrorInterceptors(timeoutError);
        throw timeoutError;
      }

      // Re-throw if already an AppError
      if (error instanceof AppError) {
        throw error;
      }

      // Unknown error
      const unknownError = new APIError(
        String(error),
        500,
        'An unexpected error occurred'
      );
      await this.applyErrorInterceptors(unknownError);
      throw unknownError;
    }
  }

  /**
   * Parse response body
   */
  private async parseResponseBody(response: Response): Promise<any> {
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      return await response.json();
    }

    return await response.text();
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Convenience methods
   */

  async get<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T = any>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T = any>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  async patch<T = any>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
}

/**
 * Default API client instance
 */
export const apiClient = new APIClient({
  baseURL: env.apiUrl,
  timeout: 30000,
  retryAttempts: 2,
  retryDelay: 1000,
});

/**
 * Export for use in services
 */
export default apiClient;
