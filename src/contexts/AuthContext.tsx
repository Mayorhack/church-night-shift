import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/** Only this account may create or edit schedules. */
export const OWNER_EMAIL = "sodipomayowa7@gmail.com";

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  /** True when the signed-in user owns the schedule (see OWNER_EMAIL). */
  isOwner: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  isOwner: false,
});

export function AuthProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo(
    () => ({
      session,
      loading,
      isOwner:
        session?.user?.email?.trim().toLowerCase() === OWNER_EMAIL,
    }),
    [session, loading],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
