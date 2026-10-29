'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types';

interface SupabaseContextType {
  supabase: SupabaseClient<Database>;
  user: User | null;
  loading: boolean;
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(
  undefined,
);

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const nextUser = user ?? null;
      setUser((currentUser) =>
        currentUser?.id === nextUser?.id ? currentUser : nextUser,
      );
      setLoading(false);
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser((currentUser) =>
        currentUser?.id === nextUser?.id ? currentUser : nextUser,
      );
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  return (
    <SupabaseContext.Provider value={{ supabase, user, loading }}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (!context)
    throw new Error('useSupabase must be used within SupabaseProvider');
  return context;
}
