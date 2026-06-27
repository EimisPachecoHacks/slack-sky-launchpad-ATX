/**
 * Frontend Environment Variable Validation
 *
 * Validates all required environment variables at build time
 * Prevents runtime errors due to missing configuration
 */

interface EnvironmentConfig {
  apiUrl: string;
  supabase?: {
    url: string;
    anonKey: string;
  };
  isDevelopment: boolean;
  isProduction: boolean;
}

class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

/**
 * Validate and parse environment variables
 */
function validateEnvironment(): EnvironmentConfig {
  const errors: string[] = [];

  // Required: API URL
  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) {
    errors.push('VITE_API_URL is required');
  } else if (!isValidUrl(apiUrl)) {
    errors.push('VITE_API_URL must be a valid URL');
  }

  // Optional: Supabase configuration
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  let supabase: { url: string; anonKey: string } | undefined;

  if (supabaseUrl || supabaseAnonKey) {
    // If one is provided, both must be provided
    if (!supabaseUrl) {
      errors.push('VITE_SUPABASE_URL is required when using Supabase');
    } else if (!isValidUrl(supabaseUrl)) {
      errors.push('VITE_SUPABASE_URL must be a valid URL');
    }

    if (!supabaseAnonKey) {
      errors.push('VITE_SUPABASE_ANON_KEY is required when using Supabase');
    }

    if (supabaseUrl && supabaseAnonKey) {
      supabase = { url: supabaseUrl, anonKey: supabaseAnonKey };
    }
  }

  // Throw if validation errors
  if (errors.length > 0) {
    const errorMessage = [
      '❌ Environment Configuration Errors:',
      '',
      ...errors.map(err => `  - ${err}`),
      '',
      '🔧 Fix these issues in your .env.local file or environment variables',
      '',
      'Required variables:',
      '  VITE_API_URL=http://localhost:8000',
      '',
      'Optional variables (for auth):',
      '  VITE_SUPABASE_URL=https://your-project.supabase.co',
      '  VITE_SUPABASE_ANON_KEY=your_anon_key',
    ].join('\n');

    throw new ConfigValidationError(errorMessage);
  }

  return {
    apiUrl: apiUrl!,
    supabase,
    isDevelopment: import.meta.env.DEV,
    isProduction: import.meta.env.PROD,
  };
}

/**
 * Simple URL validation
 */
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Export validated environment configuration
 * This will throw at module load time if configuration is invalid
 */
export const env = validateEnvironment();

/**
 * Log configuration in development
 */
if (env.isDevelopment) {
  console.log('✅ Environment configuration loaded:', {
    apiUrl: env.apiUrl,
    hasSupabase: !!env.supabase,
    mode: env.isDevelopment ? 'development' : 'production',
  });
}

/**
 * Validate environment configuration is loaded
 * Call this in your main entry point to fail fast
 */
export function validateConfig(): void {
  if (!env.apiUrl) {
    throw new ConfigValidationError('Environment configuration not loaded properly');
  }

  if (env.isProduction) {
    // Additional production checks
    if (env.apiUrl.includes('localhost')) {
      console.warn(
        '⚠️  Warning: Using localhost API URL in production build. ' +
        'Make sure to set VITE_API_URL to your production API URL.'
      );
    }
  }
}

// Export for testing/debugging
export const __testing__ = {
  validateEnvironment,
  isValidUrl,
};
