import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/auth';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already "logged in" via localStorage for demo
    const demoUser = localStorage.getItem('demoUser');
    if (demoUser) {
      const mockUser = JSON.parse(demoUser) as User;
      setUser(mockUser);
      setLoading(false);
      return;
    }

    // Get initial session (real Supabase auth)
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Mock sign in function for demo
  const mockSignIn = (email: string = 'demo@skyrchitect.com') => {
    const mockUser = {
      id: 'demo-user-' + Date.now(),
      email: email,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      aud: 'authenticated',
      role: 'authenticated',
      user_metadata: {
        full_name: email.split('@')[0]
      }
    } as User;
    
    setUser(mockUser);
    localStorage.setItem('demoUser', JSON.stringify(mockUser));
    setLoading(false);
  };

  // Mock sign out function for demo
  const mockSignOut = () => {
    setUser(null);
    setSession(null);
    localStorage.removeItem('demoUser');
  };

  return {
    user,
    session,
    loading,
    isAuthenticated: !!user,
    mockSignIn,
    mockSignOut,
  };
};