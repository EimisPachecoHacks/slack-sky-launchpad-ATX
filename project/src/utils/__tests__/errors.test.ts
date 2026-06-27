/**
 * Error Utilities Tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
  AppError,
  APIError,
  AuthError,
  RateLimitError,
  ValidationError,
  NetworkError,
  parseAPIError,
  parseNetworkError,
  handleError,
  getUserErrorMessage,
  isRecoverableError,
  requiresUserAction,
} from '../errors';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create an AppError with correct properties', () => {
      const error = new AppError('Test error', 'TEST_CODE', 'User message', 500);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.userMessage).toBe('User message');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('AppError');
    });
  });

  describe('APIError', () => {
    it('should create an APIError with status code', () => {
      const error = new APIError('API failed', 404, 'Not found');

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(APIError);
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('API_ERROR');
      expect(error.userMessage).toBe('Not found');
    });

    it('should use default message if not provided', () => {
      const error = new APIError('API failed', 500);

      expect(error.userMessage).toBe('Failed to communicate with the server. Please try again.');
    });
  });

  describe('AuthError', () => {
    it('should create an AuthError with 401 status', () => {
      const error = new AuthError('Unauthorized');

      expect(error).toBeInstanceOf(AuthError);
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('AUTH_ERROR');
    });
  });

  describe('RateLimitError', () => {
    it('should include retryAfter seconds', () => {
      const error = new RateLimitError('Too many requests', 60);

      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.statusCode).toBe(429);
      expect(error.retryAfter).toBe(60);
      expect(error.userMessage).toContain('60 seconds');
    });
  });

  describe('ValidationError', () => {
    it('should include field-level errors', () => {
      const fields = { email: 'Invalid email', password: 'Too short' };
      const error = new ValidationError('Validation failed', fields);

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.statusCode).toBe(400);
      expect(error.fields).toEqual(fields);
    });
  });

  describe('NetworkError', () => {
    it('should create a NetworkError', () => {
      const error = new NetworkError('Connection failed');

      expect(error).toBeInstanceOf(NetworkError);
      expect(error.statusCode).toBe(0);
      expect(error.code).toBe('NETWORK_ERROR');
    });
  });
});

describe('parseAPIError', () => {
  it('should parse 401 as AuthError', () => {
    const response = {
      status: 401,
      headers: new Headers(),
    } as Response;

    const error = parseAPIError(response, { detail: 'Unauthorized' });

    expect(error).toBeInstanceOf(AuthError);
    expect(error.userMessage).toBe('Unauthorized');
  });

  it('should parse 429 as RateLimitError', () => {
    const headers = new Headers();
    headers.set('Retry-After', '30');

    const response = {
      status: 429,
      headers,
    } as Response;

    const error = parseAPIError(response, { detail: 'Rate limited' });

    expect(error).toBeInstanceOf(RateLimitError);
    expect((error as RateLimitError).retryAfter).toBe(30);
  });

  it('should parse 422 as ValidationError with field details', () => {
    const response = {
      status: 422,
      headers: new Headers(),
    } as Response;

    const body = {
      detail: [
        { loc: ['body', 'email'], msg: 'Invalid email' },
        { loc: ['body', 'password'], msg: 'Too short' },
      ],
    };

    const error = parseAPIError(response, body);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).fields).toEqual({
      email: 'Invalid email',
      password: 'Too short',
    });
  });

  it('should parse other status codes as APIError', () => {
    const response = {
      status: 500,
      headers: new Headers(),
    } as Response;

    const error = parseAPIError(response, { detail: 'Server error' });

    expect(error).toBeInstanceOf(APIError);
    expect(error.statusCode).toBe(500);
  });
});

describe('parseNetworkError', () => {
  it('should create a NetworkError from Error', () => {
    const originalError = new Error('Network failed');
    const error = parseNetworkError(originalError);

    expect(error).toBeInstanceOf(NetworkError);
    expect(error.message).toBe('Network failed');
  });
});

describe('handleError', () => {
  it('should return AppError as-is', () => {
    const originalError = new APIError('Test', 500);
    const error = handleError(originalError);

    expect(error).toBe(originalError);
  });

  it('should convert Error to AppError', () => {
    const originalError = new Error('Test error');
    const error = handleError(originalError);

    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('UNKNOWN_ERROR');
  });

  it('should convert unknown types to AppError', () => {
    const error = handleError('string error');

    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe('string error');
  });
});

describe('getUserErrorMessage', () => {
  it('should return userMessage from AppError', () => {
    const error = new APIError('Internal', 500, 'User-friendly message');
    expect(getUserErrorMessage(error)).toBe('User-friendly message');
  });

  it('should return message from regular Error', () => {
    const error = new Error('Error message');
    expect(getUserErrorMessage(error)).toBe('Error message');
  });

  it('should return default message for unknown error', () => {
    expect(getUserErrorMessage('unknown')).toBe('An unexpected error occurred. Please try again.');
  });
});

describe('isRecoverableError', () => {
  it('should return true for NetworkError', () => {
    const error = new NetworkError('Network failed');
    expect(isRecoverableError(error)).toBe(true);
  });

  it('should return true for RateLimitError', () => {
    const error = new RateLimitError('Rate limited', 60);
    expect(isRecoverableError(error)).toBe(true);
  });

  it('should return true for 5xx APIError', () => {
    const error = new APIError('Server error', 500);
    expect(isRecoverableError(error)).toBe(true);
  });

  it('should return false for 4xx APIError', () => {
    const error = new APIError('Bad request', 400);
    expect(isRecoverableError(error)).toBe(false);
  });
});

describe('requiresUserAction', () => {
  it('should return true for AuthError', () => {
    const error = new AuthError('Unauthorized');
    expect(requiresUserAction(error)).toBe(true);
  });

  it('should return true for ValidationError', () => {
    const error = new ValidationError('Invalid input', {});
    expect(requiresUserAction(error)).toBe(true);
  });

  it('should return false for NetworkError', () => {
    const error = new NetworkError('Network failed');
    expect(requiresUserAction(error)).toBe(false);
  });
});
