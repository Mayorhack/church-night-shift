import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/** Only these accounts may create or edit schedules (lowercase). */
export const OWNER_EMAILS: readonly string[] = [
  "sodipomayowa7@gmail.com",
  "okusanyatemilade1@gmail.com",
];

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  /** True when the signed-in user owns the schedule (see OWNER_EMAILS). */
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
      isOwner: OWNER_EMAILS.includes(
        session?.user?.email?.trim().toLowerCase() ?? "",
      ),
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
