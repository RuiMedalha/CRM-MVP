import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { getDirectusTokenForRequest, getDirectusRefreshToken } from "@/integrations/directus/client";
import { directusLogin, directusLogout, directusMe, directusRefreshSession } from "@/integrations/directus/auth";

interface AuthContextType {
  user: { id: string; email?: string | null; first_name?: string | null; last_name?: string | null; role?: string | null } | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: { message: string } | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthContextType["user"]>(null);
  const location = useLocation();

  // Public routes skip auth entirely (no token checks, no refresh)
  const isPublicRoute = location.pathname.startsWith("/p/");

  // Bootstrap session from stored token (or fallback token if still configured)
  useEffect(() => {
    if (isPublicRoute) {
      setLoading(false);
      setUser(null);
      return;
    }

    let active = true;
    (async () => {
      setLoading(true);
      try {
        // DEV ONLY: bypass de login para pre-visualizar a UI sem Directus.
        // Inerte em producao (so corre com import.meta.env.DEV + flag explicita).
        if (import.meta.env.DEV && import.meta.env.VITE_DEV_FAKE_AUTH === "true") {
          if (active) {
            setUser({ id: "dev-preview", email: "dev@hotelequip.pt", first_name: "Dev", last_name: "Preview", role: null });
          }
          return;
        }
        const token = getDirectusTokenForRequest();
        if (!token) {
          if (active) setUser(null);
          return;
        }
        const me = await directusMe();
        if (!active) return;
        setUser(me?.data || null);
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPublicRoute]);

  // Keep session alive while the tab is open (prevents random logouts).
  useEffect(() => {
    if (isPublicRoute) return; // Never refresh on public pages

    let active = true;
    let interval: any = null;

    const tick = async () => {
      try {
        if (!active) return;
        if (!user) return;
        const rt = getDirectusRefreshToken();
        if (!rt) return;

        // pause when tab hidden
        if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
        await directusRefreshSession();
      } catch {
        // best-effort: não forçar logout aqui (rede pode falhar)
      }
    };

    const onFocus = () => tick();
    const onVisibility = () => tick();

    // a cada 10 min é suficiente (access token costuma ser curto)
    if (user) {
      tick();
      interval = setInterval(tick, 10 * 60 * 1000);
      window.addEventListener("focus", onFocus);
      window.addEventListener("visibilitychange", onVisibility);
    }

    return () => {
      active = false;
      if (interval) clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user]);

  const signIn: AuthContextType["signIn"] = async (email, password) => {
    // DEV ONLY: aceita qualquer credencial para pre-visualizar a UI sem Directus.
    if (import.meta.env.DEV && import.meta.env.VITE_DEV_FAKE_AUTH === "true") {
      setUser({ id: "dev-preview", email: email || "dev@hotelequip.pt", first_name: "Dev", last_name: "Preview", role: null });
      return { error: null };
    }
    try {
      await directusLogin(email, password);
      const me = await directusMe();
      setUser(me?.data || null);
      return { error: null };
    } catch (e: any) {
      return { error: { message: e?.message || "Erro no login" } };
    }
  };

  const signOut: AuthContextType["signOut"] = async () => {
    await directusLogout().catch(() => undefined);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
