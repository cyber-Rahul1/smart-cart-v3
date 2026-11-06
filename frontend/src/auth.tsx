import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";

import { api, getRefreshToken, saveTokens, setSignedOutHandler } from "@/src/api";
import { queryClient } from "@/src/query-client";

export type User = {
  id: string;
  phone: string;
  name: string;
  role: string;
  referral_code: string;
  delivery_credits: number;
  referred_by?: string | null;
};

type Ctx = {
  user: User | null;
  loading: boolean;
  signIn: (tokens: { access_token: string; refresh_token: string }, user: User) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: User) => void;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setUser(await api<User>("/auth/me"));
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    setSignedOutHandler(() => setUser(null));
    (async () => {
      if (await getRefreshToken()) await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const signIn = useCallback(async (tokens: { access_token: string; refresh_token: string }, u: User) => {
    await saveTokens(tokens.access_token, tokens.refresh_token);
    setUser(u);
  }, []);

  const signOut = useCallback(async () => {
    const rt = await getRefreshToken();
    if (rt) await api("/auth/logout", { method: "POST", body: { refresh_token: rt }, auth: false }).catch(() => null);
    await saveTokens(null, null);
    queryClient.clear();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, signIn, signOut, refresh, setUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}
