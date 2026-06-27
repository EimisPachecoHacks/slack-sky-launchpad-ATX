import { createClient } from '@supabase/supabase-js';

// These would be environment variables in a real application
const supabaseUrl = 'https://your-project.supabase.co';
const supabaseAnonKey = 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// OAuth providers configuration
const oauthProviders = {
  google: {
    provider: 'google' as const,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      scopes: 'email profile'
    }
  },
  github: {
    provider: 'github' as const,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      scopes: 'user:email'
    }
  }
};