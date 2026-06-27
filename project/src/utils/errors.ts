/**
 * Custom Error Classes and Error Handling Utilities
 */

/**
 * Base application error class
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public userMessage: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * API communication errors
 */
export class APIError extends AppError {
  constructor(
    message: string,
    statusCode: number,
    userMessage?: string
  ) {
    super(
      message,
      'API_ERROR',
      userMessage || 'Failed to communicate with the server. Please try again.',
      statusCode
    );
    this.name = 'APIError';
    Object.setPrototypeOf(this, APIError.prototype);
  }
}

/**
 * Authentication/Authorization errors
 */
export class AuthError extends AppError {
  constructor(message: string, userMessage?: string) {
    super(
      message,
      'AUTH_ERROR',
      userMessage || 'Authentication failed. Please log in again.',
      401
    );
    this.name = 'AuthError';
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends AppError {
  constructor(
    message: string,
    public retryAfter: number,
    userMessage?: string
  ) {
    super(
      message,
      'RATE_LIMIT_ERROR',
      userMessage || `Too many requests. Please wait ${retryAfter} seconds and try again.`,
      429
    );
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Validation errors
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    public fields: Record<string, string>,
    userMessage?: string
  ) {
    super(
      message,
      'VALIDATION_ERROR',
      userMessage || 'Please check your input and try again.',
      400
    );
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Network errors (no connection)
 */
export class NetworkError extends AppError {
  constructor(message: string, userMessage?: string) {
    super(
      message,
      'NETWORK_ERROR',
      userMessage || 'Network error. Please check your internet connection.',
      0
    );
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * Parse error response from API and create appropriate error
 */
export function parseAPIError(response: Response, body?: any): AppError {
  const statusCode = response.status;

  // Extract error message from response
  let message = 'An error occurred';
  let userMessage = 'Something went wrong. Please try again.';

  if (body) {
    if (typeof body === 'string') {
      message = body;
      userMessage = body;
    } else if (body.detail) {
      message = Array.isArray(body.detail)
        ? body.detail.map((d: any) => d.msg).join(', ')
        : body.detail;
      userMessage = message;
    } else if (body.message) {
      message = body.message;
      userMessage = message;
    }
  }

  // Create specific error based on status code
  switch (statusCode) {
    case 401:
    case 403:
      return new AuthError(message, userMessage);

    case 429:
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
      return new RateLimitError(message, retryAfter, userMessage);

    case 422:
      // Validation error with field details
      const fields: Record<string, string> = {};
      if (Array.isArray(body?.detail)) {
        body.detail.forEach((error: any) => {
          const field = error.loc?.[error.loc.length - 1] || 'unknown';
          fields[field] = error.msg;
        });
      }
      return new ValidationError(message, fields, userMessage);

    default:
      return new APIError(message, statusCode, userMessage);
  }
}

/**
 * Parse network error (fetch failed)
 */
export function parseNetworkError(error: Error): NetworkError {
  return new NetworkError(
    error.message,
    'Cannot connect to server. Please check your internet connection and try again.'
  );
}

/**
 * Global error handler
 */
export function handleError(error: unknown): AppError {
  // Already an AppError
  if (error instanceof AppError) {
    return error;
  }

  // Regular Error
  if (error instanceof Error) {
    return new AppError(
      error.message,
      'UNKNOWN_ERROR',
      'An unexpected error occurred. Please try again.',
      500
    );
  }

  // Unknown error type
  return new AppError(
    String(error),
    'UNKNOWN_ERROR',
    'An unexpected error occurred. Please try again.',
    500
  );
}

/**
 * Log error to console (development) or error tracking service (production)
 */
export function logError(error: AppError, context?: Record<string, any>): void {
  if (import.meta.env.DEV) {
    // Development: Log to console
    console.error(`[${error.code}] ${error.name}:`, error.message, {
      userMessage: error.userMessage,
      statusCode: error.statusCode,
      context,
      stack: error.stack,
    });
  } else {
    // Production: Send to error tracking service (e.g., Sentry)
    // TODO: Integrate with error tracking service
    console.error(`[${error.code}]`, error.userMessage);

    // Example Sentry integration:
    // Sentry.captureException(error, {
    //   tags: { code: error.code },
    //   extra: { context, userMessage: error.userMessage },
    // });
  }
}

/**
 * Get user-friendly error message
 */
export function getUserErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.userMessage;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Check if error is recoverable (user can retry)
 */
export function isRecoverableError(error: AppError): boolean {
  // Network errors, rate limits, and server errors are recoverable
  return (
    error instanceof NetworkError ||
    error instanceof RateLimitError ||
    (error instanceof APIError && error.statusCode! >= 500)
  );
}

/**
 * Check if error requires user action
 */
export function requiresUserAction(error: AppError): boolean {
  // Auth errors and validation errors require user action
  return error instanceof AuthError || error instanceof ValidationError;
}
